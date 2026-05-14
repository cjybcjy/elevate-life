import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { GoldPrice } from './gold.entity';

interface PriceSource {
  name: string;
  fetch: () => Promise<{ price: number; currency: string } | null>;
}

@Injectable()
export class GoldService {
  private readonly logger = new Logger(GoldService.name);
  private lastValidPrice: number | null = null;
  private readonly userAgents: string[];
  private readonly priceSources: PriceSource[];

  constructor(
    @InjectRepository(GoldPrice) private repo: Repository<GoldPrice>,
    private configService: ConfigService,
  ) {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    ];

    // All sources use free public APIs, no key needed
    this.priceSources = [
      { name: 'eastmoney_gc', fetch: () => this.fetchEastmoneyGC() },
      { name: 'sina_xau', fetch: () => this.fetchSinaXAU() },
      { name: 'sina_gc', fetch: () => this.fetchSinaGC() },
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

  /** Eastmoney COMEX Gold (GC00Y) - USD per ounce. f43 is price * 100. */
  private async fetchEastmoneyGC(): Promise<{ price: number; currency: string } | null> {
    const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=101.GC00Y&fields=f43,f58';
    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://quote.eastmoney.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });

    const data = await response.json();
    const raw = data?.data?.f43;
    if (raw === undefined || raw === null) return null;

    const price = raw / 100;
    if (isNaN(price) || price <= 0) return null;
    return { price, currency: 'USD' };
  }

  /** Sina Spot Gold (XAU) - likely USD per ounce. parts[0] is latest price. */
  private async fetchSinaXAU(): Promise<{ price: number; currency: string } | null> {
    const url = 'https://hq.sinajs.cn/list=hf_XAU';
    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    // Sina returns GBK-encoded text; numeric fields are ASCII-safe
    const text = await response.text();
    const match = text.match(/var hq_str_hf_XAU="([^"]*)"/);
    if (!match) return null;

    const parts = match[1].split(',');
    if (parts.length < 2) return null;

    const price = parseFloat(parts[0]);
    if (isNaN(price) || price <= 0) return null;
    return { price, currency: 'USD' };
  }

  /** Sina COMEX Gold (GC) - likely USD per ounce. parts[0] is latest price. */
  private async fetchSinaGC(): Promise<{ price: number; currency: string } | null> {
    const url = 'https://hq.sinajs.cn/list=hf_GC';
    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    const text = await response.text();
    const match = text.match(/var hq_str_hf_GC="([^"]*)"/);
    if (!match) return null;

    const parts = match[1].split(',');
    if (parts.length < 2) return null;

    const price = parseFloat(parts[0]);
    if (isNaN(price) || price <= 0) return null;
    return { price, currency: 'USD' };
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

  @Cron('0 * * * *')
  async fetchGoldPrice(): Promise<void> {
    if (await this.hasTodayData()) {
      this.logger.debug('Today already has gold price data, skipping fetch');
      return;
    }

    for (const source of this.priceSources) {
      try {
        await this.sleep(500 + Math.random() * 1500);
        const result = await source.fetch();

        if (!result) {
          this.logger.warn(`Source ${source.name} returned empty data`);
          continue;
        }

        let newPrice = result.price;
        if (result.currency === 'USD') {
          newPrice = this.convertUSDPerOzToCNYPerGram(newPrice);
        }

        if (isNaN(newPrice) || newPrice <= 0) {
          this.logger.warn(`Source ${source.name} returned invalid price: ${newPrice}`);
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
        this.logger.log(`Gold price from ${source.name}: ${newPrice} CNY/g`);
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

  /**
   * Get gold price in CNY per gram.
   * Sources are already converted to CNY/g during fetch and stored in DB.
   */
  async getCurrentPriceCNYPerGram(): Promise<{ price: number; lastSync: Date | null }> {
    return this.getCurrentPrice();
  }

  private convertUSDPerOzToCNYPerGram(usdPerOz: number): number {
    const exchangeRate = this.configService.get<number>('GOLD_EXCHANGE_RATE', 7.2);
    const gramsPerOz = 31.1035;
    const cnyPerGram = (usdPerOz * exchangeRate) / gramsPerOz;
    return Math.round(cnyPerGram * 100) / 100;
  }
}
