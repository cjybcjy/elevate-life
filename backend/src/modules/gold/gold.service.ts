import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoldPrice } from './gold.entity';

@Injectable()
export class GoldService {
  private readonly logger = new Logger(GoldService.name);
  private lastValidPrice: number | null = null;

  constructor(
    @InjectRepository(GoldPrice) private repo: Repository<GoldPrice>,
    private configService: ConfigService,
  ) {}

  @Cron('0 * * * *')
  async fetchGoldPrice(): Promise<void> {
    try {
      const apiUrl = this.configService.get('GOLD_API_URL');
      if (!apiUrl) {
        this.logger.warn('GOLD_API_URL not configured');
        return;
      }
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const newPrice = parseFloat(data.price);
      if (isNaN(newPrice) || newPrice <= 0) throw new Error('Invalid price');
      if (this.isAnomalous(newPrice, this.lastValidPrice)) {
        this.logger.warn(`Price anomaly: ${this.lastValidPrice} -> ${newPrice}`);
        return;
      }
      this.lastValidPrice = newPrice;
      await this.repo.save(
        this.repo.create({
          assetType: 'gold_au9999',
          price: newPrice,
          dataSource: apiUrl,
          recordedAt: new Date(),
        }),
      );
      this.logger.log(`Gold price: ${newPrice}`);
    } catch (error) {
      this.logger.error(`Failed: ${error.message}`);
    }
  }

  isAnomalous(newPrice: number, lastPrice: number | null): boolean {
    if (!lastPrice) return false;
    return Math.abs(newPrice - lastPrice) / lastPrice > 0.05;
  }

  async getCurrentPrice(): Promise<{ price: number; lastSync: Date | null }> {
    const latest = await this.repo.findOne({
      where: { assetType: 'gold_au9999' },
      order: { recordedAt: 'DESC' },
    });
    return { price: latest?.price || 0, lastSync: latest?.recordedAt || null };
  }

  async getHistory(days: number = 30): Promise<GoldPrice[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.repo.find({
      where: { assetType: 'gold_au9999', recordedAt: since },
      order: { recordedAt: 'DESC' },
    });
  }
}
