import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { GoldPrice } from './gold.entity';

interface PriceSource {
  name: string;
  url: string;
  headers: Record<string, string>;
  parse: (data: any) => number | null;
}

@Injectable()
export class GoldService {
  private readonly logger = new Logger(GoldService.name);
  private lastValidPrice: number | null = null;
  private readonly userAgents: string[];

  private readonly priceSources: PriceSource[] = [
    {
      name: 'gold-api.com',
      url: 'https://gold-api.com/price/spot',
      headers: { Accept: 'application/json' },
      parse: (data) => {
        const p = data?.price ?? data?.gold?.usd ?? data?.rate;
        return typeof p === 'number' ? p : typeof p === 'string' ? parseFloat(p) : null;
      },
    },
    {
      name: 'goldapi.io',
      url: 'https://www.goldapi.io/api/XAU/USD',
      headers: { 'x-access-token': 'goldapi-demo-key' },
      parse: (data) => {
        const p = data?.price ?? data?.ask;
        return typeof p === 'number' ? p : typeof p === 'string' ? parseFloat(p) : null;
      },
    },
    {
      name: 'metals-api',
      url: 'https://metals-api.com/api/latest?base=USD&symbols=XAU',
      headers: {},
      parse: (data) => {
        const p = data?.rates?.XAU ? 1 / data.rates.XAU : data?.rates?.['XAU'];
        return typeof p === 'number' ? p : typeof p === 'string' ? parseFloat(p) : null;
      },
    },
  ];

  constructor(
    @InjectRepository(GoldPrice) private repo: Repository<GoldPrice>,
    private configService: ConfigService,
  ) {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ];
  }

  private pickUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
        if (response.ok) return response;
        if (response.status === 429 || response.status >= 500) {
          this.logger.warn(`Retry ${i + 1}/${retries} for ${url}: HTTP ${response.status}`);
          await this.sleep(2000 * Math.pow(2, i) + Math.random() * 1000);
          continue;
        }
        return response;
      } catch (err: any) {
        if (i === retries) throw err;
        this.logger.warn(`Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
        await this.sleep(2000 * Math.pow(2, i) + Math.random() * 1000);
      }
    }
    throw new Error(`Fetch failed after ${retries} retries`);
  }

  async hasTodayData(): Promise<boolean> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const count = await this.repo.count({
      where: { assetType: 'gold_au9999', recordedAt: Between(start, end) },
    });
    return count > 0;
  }

  @Cron('0 0,12 * * *')
  async fetchGoldPrice(): Promise<void> {
    if (await this.hasTodayData()) {
      this.logger.debug('Today already has gold price data, skipping fetch');
      return;
    }

    for (const source of this.priceSources) {
      try {
        await this.sleep(500 + Math.random() * 1500);
        const response = await this.fetchWithRetry(source.url, {
          headers: {
            'User-Agent': this.pickUserAgent(),
            Accept: 'application/json',
            ...source.headers,
          },
        });

        if (!response.ok) {
          this.logger.warn(`Source ${source.name} returned HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const newPrice = source.parse(data);

        if (newPrice === null || isNaN(newPrice) || newPrice <= 0) {
          this.logger.warn(`Source ${source.name} returned invalid price`);
          continue;
        }

        if (this.isAnomalous(newPrice, this.lastValidPrice)) {
          this.logger.warn(`Price anomaly: ${this.lastValidPrice} -> ${newPrice}`);
          continue;
        }

        this.lastValidPrice = newPrice;
        await this.repo.save(
          this.repo.create({
            assetType: 'gold_au9999',
            price: newPrice,
            dataSource: source.name,
            recordedAt: new Date(),
          }),
        );
        this.logger.log(`Gold price from ${source.name}: ${newPrice}`);
        return;
      } catch (error: any) {
        this.logger.warn(`Source ${source.name} failed: ${error.message}`);
      }
    }

    this.logger.error('All price sources failed');
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
      where: { assetType: 'gold_au9999', recordedAt: Between(since, new Date()) },
      order: { recordedAt: 'DESC' },
    });
  }
}
