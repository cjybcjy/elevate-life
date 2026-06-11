import { fetchWithAntiCrawl } from '../anti-crawl';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ForexRates {
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

function loadCache(): ForexRates | null {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = readFileSync(CACHE_FILE, 'utf-8');
      const entry = JSON.parse(data) as CacheEntry;
      // Discard if older than 1 hour
      if (Date.now() - entry.ts > CACHE_TTL) return null;
      return entry.rates;
    }
  } catch {}
  return null;
}

function saveCache(rates: ForexRates): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ rates, ts: Date.now() }), 'utf-8');
  } catch {}
}

export async function fetchForexRates(): Promise<ForexRates> {
  const cached = loadCache();

  try {
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

    // Only save if both rates are valid
    if (rates.usdToCny > 0 && rates.hkdToCny > 0) {
      saveCache(rates);
      return rates;
    }
  } catch {
    // API failed, fall through to cache/fallback
  }

  return cached || FALLBACK;
}
