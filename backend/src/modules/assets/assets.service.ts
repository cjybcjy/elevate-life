import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Asset } from './assets.entity';
import { Liability } from '../liabilities/liabilities.entity';
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
    private encryptionService: EncryptionService,
    private goldService: GoldService,
    private stockService: StockService,
  ) {}

  async findByUser(userId: string): Promise<AssetWithValue[]> {
    const assets = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });

    // Get gold price once for all gold assets
    let goldPrice: number | null = null;
    const hasGold = assets.some(a => a.category === 'gold');
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
    if (!['gold', 'stock'].includes(asset.category)) {
      const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
      return { currentValue: decrypted, unitPrice: null };
    }

    // Gold: quantity (grams) * gold price
    if (asset.category === 'gold') {
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
    // For manual assets, balance is required
    // For gold/stock, quantity is required, balance is optional (will be auto-calculated)
    const isAutoValued = ['gold', 'stock'].includes(data.category);

    let balanceStr: string;
    if (data.balance !== undefined && data.balance !== null && data.balance !== '') {
      balanceStr = new Decimal(data.balance).toFixed(4);
    } else if (isAutoValued && data.quantity) {
      // Auto-calculate initial balance for gold/stock
      balanceStr = new Decimal(data.quantity).toFixed(4);
    } else {
      balanceStr = '0';
    }

    const shouldEncrypt = this.encryptionService.shouldEncrypt(balanceStr);
    const asset = this.repo.create({
      ...data,
      balance: shouldEncrypt ? this.encryptionService.encrypt(balanceStr) : balanceStr,
      isEncrypted: shouldEncrypt,
      userId,
    });
    const saved = await this.repo.save(asset);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async update(id: string, userId: string, data: any): Promise<Asset> {
    if (data.balance !== undefined && data.balance !== null && data.balance !== '') {
      const balanceStr = new Decimal(data.balance).toFixed(4);
      data.balance = this.encryptionService.shouldEncrypt(balanceStr) ? this.encryptionService.encrypt(balanceStr) : balanceStr;
      data.isEncrypted = this.encryptionService.shouldEncrypt(balanceStr);
    }
    await this.repo.update({ id, userId }, data);
    return this.repo.findOneOrFail({ where: { id, userId } });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
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
