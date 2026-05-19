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

  async getStockPrice(rawCode: string): Promise<number> {
    const code = rawCode.trim().toUpperCase();
    const normalized = this.normalizeCode(code);
    const cached = this.cache.get(normalized);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    const market = this.detectMarket(normalized);
    this.logger.log(`Fetching price for ${code}, detected market: ${market}`);

    try {
      let price: number | null = null;

      // Try Sina first for all markets
      try {
        await this.sleep(800 + Math.random() * 1200);
        price = await this.fetchSinaPrice(normalized, market);
        this.logger.log(`Sina price for ${code} (normalized: ${normalized}): ${price}`);
      } catch (error: any) {
        this.logger.warn(`Sina source failed for ${code}: ${error.message}`);
      }

      // Fallback: Tencent for CN/HK, Eastmoney for all
      if (price === null) {
        try {
          await this.sleep(1500 + Math.random() * 1500);
          if (market === 'us') {
            price = await this.fetchEastmoneyPrice(normalized, market);
          } else {
            price = await this.fetchTencentPrice(normalized, market);
          }
        } catch (error: any) {
          this.logger.warn(`Fallback source failed for ${code}: ${error.message}`);
        }
      }

      if (price !== null && price > 0) {
        this.cache.set(normalized, { price, timestamp: Date.now() });
        return price;
      }

      throw new Error('All stock price sources failed');
    } catch (error: any) {
      this.logger.warn(`Failed to fetch stock price for ${code}: ${error.message}`);
      if (cached) return cached.price;
      return this.getMockPrice(normalized);
    }
  }

  private pickUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
        if (response.ok) return response;
        if (response.status === 429 || response.status >= 500) {
          this.logger.warn(`Retry ${i + 1}/${retries} for ${url}: HTTP ${response.status}`);
          await this.sleep(3000 * Math.pow(2, i) + Math.random() * 2000);
          continue;
        }
        return response;
      } catch (err: any) {
        if (i === retries) throw err;
        this.logger.warn(`Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
        await this.sleep(3000 * Math.pow(2, i) + Math.random() * 2000);
      }
    }
    throw new Error(`Fetch failed after ${retries} retries`);
  }

  /** Sina Finance: supports CN (sh/sz/bj), HK (hk), US (gb_) */
  private async fetchSinaPrice(code: string, market: string): Promise<number | null> {
    const prefix = this.getPrefix(code, market);
    const url = `https://hq.sinajs.cn/list=${prefix}${code}`;
    this.logger.log(`Sina URL: ${url}`);

    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    this.logger.log(`Sina raw for ${code}: ${text.slice(0, 200)}`);
    const match = text.match(/var hq_str_[^=]+="([^"]*)"/);
    if (!match) {
      this.logger.warn(`Sina no match for ${code}`);
      return null;
    }

    const parts = match[1].split(',');
    this.logger.log(`Sina parts for ${code}: length=${parts.length}, parts[6]=${parts[6]}`);

    // CN: name,open,prev,current,high,low,...
    if (market === 'cn') {
      if (parts.length < 4) return null;
      const price = parseFloat(parts[3]);
      if (!isNaN(price) && price > 0) return price;
      const fallback = parseFloat(parts[1]) || parseFloat(parts[2]);
      return fallback > 0 ? fallback : null;
    }

    // HK: name,nameCN,open,high,low,prevClose,current,change,changePct,bid,ask,volume,amount,...
    if (market === 'hk') {
      if (parts.length < 7) return null;
      const price = parseFloat(parts[6]);
      return !isNaN(price) && price > 0 ? price : null;
    }

    // US: gb_aapl="苹果,AAPL,185.64,..."
    if (market === 'us') {
      for (let i = 2; i < parts.length; i++) {
        const price = parseFloat(parts[i]);
        if (!isNaN(price) && price > 0 && price < 100000) return price;
      }
      return null;
    }

    return null;
  }

  /** Tencent Finance: supports CN and HK */
  private async fetchTencentPrice(code: string, market: string): Promise<number | null> {
    const prefix = this.getPrefix(code, market);
    const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.qq.com',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const match = text.match(/v_[^=]+="([^"]*)"/);
    if (!match) return null;

    const parts = match[1].split('~');
    if (parts.length < 4) return null;

    const price = parseFloat(parts[3]);
    return !isNaN(price) && price > 0 ? price : null;
  }

  /** Eastmoney: supports all markets via secid */
  private async fetchEastmoneyPrice(code: string, market: string): Promise<number | null> {
    const secid = this.getEastmoneySecid(code, market);
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43`;

    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://quote.eastmoney.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const raw = data?.data?.f43;
    if (raw === undefined || raw === null) return null;

    const price = raw / 100;
    return !isNaN(price) && price > 0 ? price : null;
  }

  /** Strip common exchange prefixes from user input */
  private normalizeCode(code: string): string {
    if (code.startsWith('HK')) return code.slice(2);
    if (code.startsWith('SH')) return code.slice(2);
    if (code.startsWith('SZ')) return code.slice(2);
    if (code.startsWith('BJ')) return code.slice(2);
    if (code.startsWith('GB_')) return code.slice(3);
    return code;
  }

  /** Detect market from raw stock code */
  private detectMarket(code: string): 'cn' | 'hk' | 'us' {
    const c = code.trim().toUpperCase();
    if (/^[A-Z]+$/.test(c)) return 'us';
    if (/^\d{5}$/.test(c) || (c.startsWith('0') && c.length === 5)) return 'hk';
    if (c.startsWith('6') || c.startsWith('0') || c.startsWith('3') || c.startsWith('2') || c.startsWith('4') || c.startsWith('8')) return 'cn';
    return 'cn'; // default
  }

  /** Build exchange prefix for Sina/Tencent APIs */
  private getPrefix(code: string, market: string): string {
    if (market === 'hk') return 'hk';
    if (market === 'us') return 'gb_';
    if (code.startsWith('6')) return 'sh';
    if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return 'sz';
    if (code.startsWith('4') || code.startsWith('8')) return 'bj';
    return 'sh';
  }

  /** Build Eastmoney secid */
  private getEastmoneySecid(code: string, market: string): string {
    if (market === 'hk') return `116.${code}`;
    if (market === 'us') return `105.${code}`;
    if (code.startsWith('6')) return `1.${code}`;
    return `0.${code}`;
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
    if (codes.length === 0) return results;

    // Try batch Sina first (fastest: one request for all)
    try {
      await this.sleep(300 + Math.random() * 500);
      const batch = await this.fetchSinaBatch(codes);
      for (const [code, price] of batch) {
        results.set(code, price);
      }
    } catch (error: any) {
      this.logger.warn(`Sina batch failed: ${error.message}`);
    }

    // Fallback: individual fetch for missing prices
    const missing = codes.filter((c) => !results.has(c) || results.get(c) === 0);
    for (const code of missing) {
      try {
        await this.sleep(400 + Math.random() * 600);
        const price = await this.getStockPrice(code);
        results.set(code, price);
      } catch {
        results.set(code, 0);
      }
    }
    return results;
  }

  /** Batch fetch from Sina: supports comma-separated codes */
  private async fetchSinaBatch(codes: string[]): Promise<Map<string, number>> {
    const normalizedCodes = codes.map((c) => this.normalizeCode(c.trim().toUpperCase()));
    const codeMarkets = normalizedCodes.map((c) => ({ code: c, market: this.detectMarket(c) }));
    const query = codeMarkets.map(({ code, market }) => `${this.getPrefix(code, market)}${code}`).join(',');
    const url = `https://hq.sinajs.cn/list=${query}`;

    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.pickUserAgent(),
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const results = new Map<string, number>();

    // Parse each var hq_str_xxx="..." line
    const regex = /var hq_str_([a-zA-Z0-9_]+)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const fullKey = m[1]; // e.g. "sh600519" or "hk02015"
      const raw = m[2];
      if (!raw) continue;

      // Find original code that matches this key
      const matched = codeMarkets.find(({ code, market }) => {
        const prefix = this.getPrefix(code, market);
        return `${prefix}${code}`.toLowerCase() === fullKey.toLowerCase();
      });
      if (!matched) continue;

      const parts = raw.split(',');
      let price: number | null = null;

      if (matched.market === 'cn') {
        if (parts.length >= 4) {
          price = parseFloat(parts[3]);
          if (isNaN(price) || price <= 0) {
            price = parseFloat(parts[1]) || parseFloat(parts[2]) || null;
          }
        }
      } else if (matched.market === 'hk') {
        if (parts.length >= 7) {
          price = parseFloat(parts[6]);
          if (isNaN(price) || price <= 0) price = null;
        }
      } else if (matched.market === 'us') {
        for (let i = 2; i < parts.length; i++) {
          const p = parseFloat(parts[i]);
          if (!isNaN(p) && p > 0 && p < 100000) { price = p; break; }
        }
      }

      if (price !== null && price > 0) {
        this.cache.set(matched.code, { price, timestamp: Date.now() });
        // Map back to original (un-normalized) code
        const originalIdx = normalizedCodes.findIndex((c) => c === matched.code);
        if (originalIdx >= 0) {
          results.set(codes[originalIdx], price);
        }
      }
    }

    return results;
  }
}
