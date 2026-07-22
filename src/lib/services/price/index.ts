import { prisma } from '@/lib/prisma';
import { fetchGoldPrice } from './sources/gold';
import { fetchCnStockPrice } from './sources/cn-stock';
import { fetchHkStockPrice } from './sources/hk-stock';
import { fetchUsStockPrice } from './sources/us-stock';

export interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  currency: string;
  source: string;
}

const MARKET_PRICED_CATEGORIES = ['gold_physical', 'gold_paper', 'stock', 'fund'];
const DEFAULT_STALE_MS = 60 * 60 * 1000;
const ACTIVE_CN_MARKET_STALE_MS = 5 * 60 * 1000;

export function isMarketPriced(category: string): boolean {
  return MARKET_PRICED_CATEGORIES.includes(category);
}

function getBeijingWeekdayAndMinute(date: Date) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    weekday: beijing.getUTCDay(),
    minuteOfDay: beijing.getUTCHours() * 60 + beijing.getUTCMinutes(),
  };
}

function isCnMarketActive(now: Date) {
  const { weekday, minuteOfDay } = getBeijingWeekdayAndMinute(now);
  if (weekday === 0 || weekday === 6) return false;

  const morningOpen = 9 * 60 + 25;
  const morningClose = 11 * 60 + 35;
  const afternoonOpen = 12 * 60 + 55;
  const afternoonClose = 15 * 60 + 5;

  return (
    (minuteOfDay >= morningOpen && minuteOfDay <= morningClose) ||
    (minuteOfDay >= afternoonOpen && minuteOfDay <= afternoonClose)
  );
}

export function isStale(updatedAt: Date, market?: string, now = new Date()): boolean {
  const staleMs = market === 'cn' && isCnMarketActive(now)
    ? ACTIVE_CN_MARKET_STALE_MS
    : DEFAULT_STALE_MS;

  return now.getTime() - updatedAt.getTime() > staleMs;
}

export async function fetchSinglePrice(code: string, market: string): Promise<PriceResult> {
  switch (market) {
    case 'commodity':
      return fetchGoldPrice();
    case 'cn':
      return fetchCnStockPrice(code);
    case 'hk':
      return fetchHkStockPrice(code);
    case 'us':
      return fetchUsStockPrice(code);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function upsertMarketPrice(result: PriceResult): Promise<void> {
  await prisma.marketPrice.upsert({
    where: { code_market: { code: result.code, market: result.market } },
    create: {
      code: result.code,
      market: result.market,
      name: result.name,
      price: result.price,
      currency: result.currency,
      source: result.source,
    },
    update: {
      name: result.name,
      price: result.price,
      currency: result.currency,
      source: result.source,
    },
  });
}

export async function refreshPricesForItems(
  items: { code: string; market: string }[]
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Deduplicate by code+market
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.code}|${item.market}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fetch sequentially with anti-crawl delays (built into fetchWithAntiCrawl)
  for (const item of unique) {
    try {
      const result = await fetchSinglePrice(item.code, item.market);
      await upsertMarketPrice(result);
    } catch (error: any) {
      errors.push(`${item.market}:${item.code} - ${error.message}`);
    }
  }

  return { success: errors.length === 0, errors };
}

interface AssetWithCodes {
  stockCode?: string | null;
  market?: string | null;
  category: string;
}

export async function extractPriceItems(assets: AssetWithCodes[]) {
  const items: { code: string; market: string }[] = [];

  for (const asset of assets) {
    if (asset.category === 'gold_physical' || asset.category === 'gold_paper') {
      items.push({ code: 'AU9999', market: 'commodity' });
    } else if ((asset.category === 'stock' || asset.category === 'fund') && asset.stockCode && asset.market) {
      items.push({ code: asset.stockCode, market: asset.market });
    }
  }

  return items;
}
