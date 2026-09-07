import { fetchWithAntiCrawl } from '../anti-crawl';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ForexRates {
  usdToCny: number;
  hkdToCny: number;
  jpyToCny: number;
}

const CACHE_FILE = join(process.cwd(), '.forex-cache.json');
const FALLBACK: ForexRates = { usdToCny: 7.25, hkdToCny: 0.92, jpyToCny: 0.048 };

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  rates: ForexRates;
  ts: number;
}

function loadCacheEntry(): CacheEntry | null {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data) as CacheEntry;
    }
  } catch {}
  return null;
}

function saveCache(rates: ForexRates): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ rates, ts: Date.now() }), 'utf-8');
  } catch {}
}

export function getCachedForexRates(): {
  rates: ForexRates;
  stale: boolean;
  source: 'cache' | 'fallback';
} {
  const entry = loadCacheEntry();
  if (!entry) {
    return { rates: FALLBACK, stale: true, source: 'fallback' };
  }

  return {
    rates: entry.rates,
    stale: Date.now() - entry.ts > CACHE_TTL,
    source: 'cache',
  };
}

let refreshPromise: Promise<ForexRates> | null = null;

export async function refreshForexRates(): Promise<ForexRates> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const [usdRes, hkdRes, jpyRes] = await Promise.all([
      fetchWithAntiCrawl('https://hq.sinajs.cn/list=fx_susdcny', 'https://finance.sina.com.cn/'),
      fetchWithAntiCrawl('https://hq.sinajs.cn/list=fx_shkdcny', 'https://finance.sina.com.cn/'),
      fetchWithAntiCrawl('https://hq.sinajs.cn/list=fx_sjpycny', 'https://finance.sina.com.cn/'),
    ]);

    const parseRate = (text: string): number => {
      const match = text.match(/"([^"]+)"/);
      if (!match) throw new Error('Failed to parse forex rate');
      const fields = match[1].split(',');
      return parseFloat(fields[1]) || parseFloat(fields[2]) || 1;
    };

    const rates: ForexRates = {
      usdToCny: parseRate(usdRes.text),
      hkdToCny: parseRate(hkdRes.text),
      jpyToCny: parseRate(jpyRes.text),
    };

    if (rates.usdToCny <= 0 || rates.hkdToCny <= 0 || rates.jpyToCny <= 0) {
      throw new Error('Invalid forex rates');
    }

    saveCache(rates);
    return rates;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Blocking refresh for explicit background jobs. Request-time rendering should
 * use getCachedForexRates() and schedule refreshForexRates() with after().
 */
export async function fetchForexRates(): Promise<ForexRates> {
  const cached = getCachedForexRates();
  if (!cached.stale) return cached.rates;

  try {
    return await refreshForexRates();
  } catch {
    return cached.rates;
  }
}
