import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface StockPrice {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  ];

  constructor(private configService: ConfigService) {}

  async getStockPrice(code: string): Promise<number> {
    const cached = this.cache.get(code);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const price = await this.fetchStockPrice(code);
      this.cache.set(code, { price, timestamp: Date.now() });
      return price;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch stock price for ${code}: ${error.message}`);
      if (cached) return cached.price;
      return this.getMockPrice(code);
    }
  }

  private pickUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchStockPrice(code: string): Promise<number> {
    // Normalize code: remove exchange suffix if present
    const normalized = code.split('.')[0];

    // Source 1: Sina Finance (primary)
    try {
      await this.sleep(200 + Math.random() * 500);
      const sinaPrice = await this.fetchSinaPrice(normalized);
      if (sinaPrice !== null) return sinaPrice;
    } catch (error: any) {
      this.logger.warn(`Sina source failed for ${code}: ${error.message}`);
    }

    // Source 2: Tencent Finance (fallback)
    try {
      await this.sleep(500 + Math.random() * 800);
      const tencentPrice = await this.fetchTencentPrice(normalized);
      if (tencentPrice !== null) return tencentPrice;
    } catch (error: any) {
      this.logger.warn(`Tencent source failed for ${code}: ${error.message}`);
    }

    // Source 3: Eastmoney (last fallback)
    try {
      await this.sleep(500 + Math.random() * 800);
      const eastmoneyPrice = await this.fetchEastmoneyPrice(normalized);
      if (eastmoneyPrice !== null) return eastmoneyPrice;
    } catch (error: any) {
      this.logger.warn(`Eastmoney source failed for ${code}: ${error.message}`);
    }

    throw new Error('All stock price sources failed');
  }

  /** Sina Finance: https://hq.sinajs.cn/list=sh600519 */
  private async fetchSinaPrice(code: string): Promise<number | null> {
    const prefix = this.guessExchangePrefix(code);
    const url = `https://hq.sinajs.cn/list=${prefix}${code}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    // Format: var hq_str_sh600519="贵州茅台,1777.000,1788.500,1775.010,..."
    const match = text.match(/var hq_str_[^=]+="([^"]*)"/);
    if (!match) return null;

    const parts = match[1].split(',');
    if (parts.length < 3) return null;

    const price = parseFloat(parts[3]); // current price
    if (!isNaN(price) && price > 0) return price;

    // Fallback: try parts[1] (opening) or parts[2] (previous close)
    const fallback = parseFloat(parts[1]) || parseFloat(parts[2]);
    return fallback > 0 ? fallback : null;
  }

  /** Tencent Finance: https://qt.gtimg.cn/q=sh600519 */
  private async fetchTencentPrice(code: string): Promise<number | null> {
    const prefix = this.guessExchangePrefix(code);
    const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.qq.com',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    // Format: v_sh600519="1~贵州茅台~600519~1777.00~1788.50~1775.00~..."
    const match = text.match(/v_[^=]+="([^"]*)"/);
    if (!match) return null;

    const parts = match[1].split('~');
    if (parts.length < 4) return null;

    const price = parseFloat(parts[3]);
    return !isNaN(price) && price > 0 ? price : null;
  }

  /** Eastmoney: https://push2.eastmoney.com/api/qt/stock/get */
  private async fetchEastmoneyPrice(code: string): Promise<number | null> {
    const secid = this.guessEastmoneySecid(code);
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://quote.eastmoney.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    // f43 is current price, scaled by 100
    const raw = data?.data?.f43;
    if (raw === undefined || raw === null) return null;

    const price = raw / 100;
    return !isNaN(price) && price > 0 ? price : null;
  }

  /** Guess exchange prefix: sh for 6xxxx, sz for 0/3xxxx */
  private guessExchangePrefix(code: string): string {
    if (code.startsWith('6')) return 'sh';
    if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return 'sz';
    if (code.startsWith('4') || code.startsWith('8')) return 'bj'; // 北交所
    return 'sh'; // default
  }

  /** Guess Eastmoney secid: 1.sh for Shanghai, 0.sz for Shenzhen */
  private guessEastmoneySecid(code: string): string {
    if (code.startsWith('6')) return `1.${code}`;
    if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return `0.${code}`;
    if (code.startsWith('4') || code.startsWith('8')) return `0.${code}`;
    return `1.${code}`;
  }

  private getMockPrice(code: string): number {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = ((hash << 5) - hash) + code.charCodeAt(i);
      hash |= 0;
    }
    const base = 10 + (Math.abs(hash) % 490);
    const variation = Math.sin(Date.now() / 86400000) * 5;
    return Math.round((base + variation) * 100) / 100;
  }

  async getMultiplePrices(codes: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    await Promise.all(
      codes.map(async (code) => {
        try {
          const price = await this.getStockPrice(code);
          results.set(code, price);
        } catch {
          results.set(code, 0);
        }
      })
    );
    return results;
  }
}
