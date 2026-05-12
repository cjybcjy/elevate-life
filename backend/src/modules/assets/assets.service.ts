import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Asset } from './assets.entity';
import { Liability } from '../liabilities/liabilities.entity';
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset) private repo: Repository<Asset>,
    @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
    private encryptionService: EncryptionService,
  ) {}

  async findByUser(userId: string): Promise<Asset[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string, userId: string): Promise<Asset | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async create(userId: string, data: any): Promise<Asset> {
    const balanceStr = new Decimal(data.balance).toFixed(4);
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
    if (data.balance !== undefined) {
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
      const decrypted = this.getDecryptedValue(asset.balance, asset.isEncrypted);
      totalAssets = totalAssets.plus(new Decimal(decrypted));
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
