import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Asset } from './assets.entity';
import { Liability } from '../liabilities/liabilities.entity';
import { Transaction } from '../transactions/transactions.entity';
import { EncryptionService } from '../encryption/encryption.service';
import { GoldService } from '../gold/gold.service';
import { StockService } from '../stock/stock.service';

export interface AssetWithValue extends Asset {
  currentValue: string;
  unitPrice: string | null;
}

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset) private repo: Repository<Asset>,
    @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private encryptionService: EncryptionService,
    private goldService: GoldService,
    private stockService: StockService,
  ) {}

  async findByUser(userId: string): Promise<AssetWithValue[]> {
    const assets = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });

    // Get gold price once for all gold assets
    let goldPrice: number | null = null;
    const hasGold = assets.some(a => a.category === 'gold' || a.category === 'gold_physical' || a.category === 'gold_paper');
    if (hasGold) {
      const gp = await this.goldService.getCurrentPriceCNYPerGram();
      goldPrice = gp.price;
    }

    // Get all stock codes
    const stockCodes = assets
      .filter(a => a.category === 'stock' && a.stockCode)
      .map(a => a.stockCode!);
    const stockPrices = stockCodes.length > 0
      ? await this.stockService.getMultiplePrices(stockCodes)
      : new Map<string, number>();

    return Promise.all(
      assets.map(async (asset) => {
        const { currentValue, unitPrice } = await this.calculateCurrentValue(asset, goldPrice, stockPrices);
        return {
          ...asset,
          currentValue,
          unitPrice,
        } as AssetWithValue;
      }),
    );
  }

  private async calculateCurrentValue(
    asset: Asset,
    goldPrice: number | null,
    stockPrices: Map<string, number>,
  ): Promise<{ currentValue: string; unitPrice: string | null }> {
    // Manual assets (real_estate, cash, fund, vehicle, other): use balance directly
    if (!['gold', 'gold_physical', 'gold_paper', 'stock', 'crypto'].includes(asset.category)) {
      const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
      return { currentValue: decrypted, unitPrice: null };
    }

    // Gold (physical & paper): quantity (grams) * gold price
    if (asset.category === 'gold' || asset.category === 'gold_physical' || asset.category === 'gold_paper') {
      if (asset.quantity && goldPrice && goldPrice > 0) {
        const value = new Decimal(asset.quantity).mul(goldPrice).toFixed(2);
        return { currentValue: value, unitPrice: goldPrice.toFixed(2) };
      }
      // Fallback to stored balance
      const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
      return { currentValue: decrypted, unitPrice: goldPrice?.toFixed(2) ?? null };
    }

    // Stock: quantity (shares) * stock price
    if (asset.category === 'stock') {
      if (asset.quantity && asset.stockCode) {
        const stockPrice = stockPrices.get(asset.stockCode) || 0;
        if (stockPrice > 0) {
          const value = new Decimal(asset.quantity).mul(stockPrice).toFixed(2);
          return { currentValue: value, unitPrice: stockPrice.toFixed(2) };
        }
      }
      // Fallback to stored balance
      const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
      return { currentValue: decrypted, unitPrice: null };
    }

    const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
    return { currentValue: decrypted, unitPrice: null };
  }

  async findById(id: string, userId: string): Promise<Asset | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async create(userId: string, data: any): Promise<Asset> {
    const isGold = ['gold', 'gold_physical', 'gold_paper'].includes(data.category);
    const isAutoValued = ['gold', 'gold_physical', 'gold_paper', 'stock', 'crypto'].includes(data.category);

    let balanceStr: string;
    if (data.balance !== undefined && data.balance !== null && data.balance !== '') {
      balanceStr = new Decimal(data.balance).toFixed(4);
    } else if (isGold && data.quantity) {
      const gp = await this.goldService.getCurrentPriceCNYPerGram();
      const goldPrice = gp.price || 0;
      balanceStr = new Decimal(data.quantity).mul(goldPrice).toFixed(4);
    } else if (data.category === 'stock' && data.quantity && data.stockCode) {
      const stockPrice = await this.stockService.getStockPrice(data.stockCode);
      balanceStr = new Decimal(data.quantity).mul(stockPrice).toFixed(4);
    } else if (isAutoValued && data.quantity) {
      balanceStr = new Decimal(data.quantity).toFixed(4);
    } else {
      balanceStr = '0';
    }

    let costBasisStr: string | undefined;
    if (data.costBasis !== undefined && data.costBasis !== null && data.costBasis !== '') {
      costBasisStr = new Decimal(data.costBasis).toFixed(4);
    }

    const shouldEncrypt = this.encryptionService.shouldEncrypt(balanceStr);
    const asset = this.repo.create({
      ...data,
      balance: shouldEncrypt ? this.encryptionService.encrypt(balanceStr) : balanceStr,
      costBasis: costBasisStr ? (this.encryptionService.shouldEncrypt(costBasisStr) ? this.encryptionService.encrypt(costBasisStr) : costBasisStr) : undefined,
      isEncrypted: shouldEncrypt,
      userId,
    });
    const saved = await this.repo.save(asset);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async update(id: string, userId: string, data: any): Promise<Asset> {
    const existing = await this.repo.findOne({ where: { id, userId } });
    const category = data.category || existing?.category;
    const isGold = ['gold', 'gold_physical', 'gold_paper'].includes(category);

    if (data.balance !== undefined && data.balance !== null && data.balance !== '') {
      const balanceStr = new Decimal(data.balance).toFixed(4);
      data.balance = this.encryptionService.shouldEncrypt(balanceStr) ? this.encryptionService.encrypt(balanceStr) : balanceStr;
      data.isEncrypted = this.encryptionService.shouldEncrypt(balanceStr);
    } else if (isGold && data.quantity !== undefined && data.quantity !== null && data.quantity !== '') {
      const gp = await this.goldService.getCurrentPriceCNYPerGram();
      const goldPrice = gp.price || 0;
      const balanceStr = new Decimal(data.quantity).mul(goldPrice).toFixed(4);
      data.balance = this.encryptionService.shouldEncrypt(balanceStr) ? this.encryptionService.encrypt(balanceStr) : balanceStr;
      data.isEncrypted = this.encryptionService.shouldEncrypt(balanceStr);
    } else if (category === 'stock' && data.quantity !== undefined && data.quantity !== null && data.quantity !== '') {
      const stockCode = data.stockCode || existing?.stockCode;
      if (stockCode) {
        const stockPrice = await this.stockService.getStockPrice(stockCode);
        const balanceStr = new Decimal(data.quantity).mul(stockPrice).toFixed(4);
        data.balance = this.encryptionService.shouldEncrypt(balanceStr) ? this.encryptionService.encrypt(balanceStr) : balanceStr;
        data.isEncrypted = this.encryptionService.shouldEncrypt(balanceStr);
      }
    }
    if (data.costBasis !== undefined && data.costBasis !== null && data.costBasis !== '') {
      const costStr = new Decimal(data.costBasis).toFixed(4);
      data.costBasis = this.encryptionService.shouldEncrypt(costStr) ? this.encryptionService.encrypt(costStr) : costStr;
    }
    await this.repo.update({ id, userId }, data);
    return this.repo.findOneOrFail({ where: { id, userId } });
  }

  async delete(id: string, userId: string): Promise<void> {
    const count = await this.txRepo.count({
      where: [
        { fromAccountId: id, userId },
        { toAccountId: id, userId },
      ],
    });
    if (count > 0) {
      throw new ConflictException(`该资产存在 ${count} 笔关联交易，无法删除`);
    }
    await this.repo.delete({ id, userId });
  }

  async adjustBalance(id: string, userId: string, delta: number): Promise<void> {
    const asset = await this.repo.findOne({ where: { id, userId } });
    if (!asset) return;
    const currentBalance = new Decimal(this.getDecryptedValue(asset.balance, asset.isEncrypted));
    const newBalance = currentBalance.plus(delta).toFixed(4);
    const shouldEncrypt = this.encryptionService.shouldEncrypt(newBalance);
    await this.repo.update({ id, userId }, {
      balance: shouldEncrypt ? this.encryptionService.encrypt(newBalance) : newBalance,
      isEncrypted: shouldEncrypt,
    });
  }

  private getDecryptedValue(encryptedValue: string, isEncrypted: boolean): string {
    if (!encryptedValue) return '0'
    if (isEncrypted) {
      return this.encryptionService.decrypt(encryptedValue.slice(4))
    }
    return encryptedValue
  }

  async getSummary(userId: string): Promise<{ totalAssets: string; totalLiabilities: string; netWorth: string }> {
    const assets = await this.findByUser(userId);
    let totalAssets = new Decimal(0);
    for (const asset of assets) {
      totalAssets = totalAssets.plus(new Decimal(asset.currentValue));
    }
    let totalLiabilities = new Decimal(0);
    try {
      const liabilities = await this.liabilityRepo.find({ where: { userId } });
      for (const liability of liabilities) {
        const decrypted = this.getDecryptedValue(liability.currentBalance, liability.isEncrypted);
        totalLiabilities = totalLiabilities.plus(new Decimal(decrypted));
      }
    } catch (error) {
      totalLiabilities = new Decimal(0);
    }
    const netWorth = totalAssets.minus(totalLiabilities);
    return { totalAssets: totalAssets.toFixed(2), totalLiabilities: totalLiabilities.toFixed(2), netWorth: netWorth.toFixed(2) };
  }
}
