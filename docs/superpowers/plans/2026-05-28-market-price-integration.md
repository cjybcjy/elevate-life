# Market Price Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fetch market prices for gold/stock/fund assets from public APIs, compute market value from quantity × unit price, and refresh on login + manual trigger.

**Architecture:** New `MarketPrice` table caches fetched prices. `PriceService` class with per-market fetchers + anti-crawl measures. `getAssets()` enriches assets with latest prices from DB. A `<PriceRefresher />` client component triggers async refresh when prices are stale. Manual refresh button and hourly cron provide additional update paths.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, React 19, TypeScript, Decimal.js, native fetch

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields to Asset model and create MarketPrice model**

Replace the Asset model fields (lines 23-42) and the GoldPrice + StockPrice models (lines 121-139) with:

```prisma
model Asset {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  name            String
  category        String
  balance         String   @default("0")
  currency        String   @default("CNY")
  valuationMethod String?  @map("valuation_method")
  liquidityTier   String?  @map("liquidity_tier")
  isEncrypted     Boolean  @default(false) @map("is_encrypted")
  costPrice       String?  @map("cost_price")
  quantity        Decimal?  @db.Decimal(18, 4)
  stockCode       String?  @map("stock_code")
  market          String?
  costUnitPrice   Decimal?  @db.Decimal(18, 4) @map("cost_unit_price")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactionsFrom Transaction[] @relation("fromAsset")
  transactionsTo   Transaction[] @relation("toAsset")

  @@index([userId, category])
  @@index([stockCode, market])
}
```

Replace GoldPrice and StockPrice models with:

```prisma
model MarketPrice {
  id        String   @id @default(uuid())
  code      String
  market    String
  name      String
  price     Decimal  @db.Decimal(18, 4)
  source    String?
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([code, market])
  @@index([market])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /home/kyrie/workspace/elevate-life && npx prisma migrate dev --name add_market_price_fields
```

Expected: Migration creates new columns and MarketPrice table, drops GoldPrice and StockPrice tables.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add quantity/stockCode/market/costUnitPrice to Asset, replace GoldPrice/StockPrice with MarketPrice"
```

---

### Task 2: Anti-Crawl Utilities

**Files:**
- Create: `src/lib/services/price/anti-crawl.ts`

- [ ] **Step 1: Create anti-crawl utility**

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(): number {
  return 1000 + Math.random() * 2000; // 1-3 seconds
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchResult {
  ok: boolean;
  text: string;
  status: number;
}

export async function fetchWithAntiCrawl(url: string, referer?: string): Promise<FetchResult> {
  await sleep(randomDelay());

  const headers: Record<string, string> = {
    'User-Agent': randomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  };

  if (referer) {
    headers['Referer'] = referer;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      const text = await response.text();
      return { ok: response.ok, text, status: response.status };
    } catch (error) {
      if (attempt === 2) throw error;
      const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(backoff);
    }
  }

  throw new Error('fetchWithAntiCrawl: unreachable');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/anti-crawl.ts
git commit -m "feat: add anti-crawl fetch utility with UA rotation and retry"
```

---

### Task 3: Gold Price Fetcher

**Files:**
- Create: `src/lib/services/price/sources/gold.ts`

- [ ] **Step 1: Create gold price fetcher**

```typescript
import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

export async function fetchGoldPrice(): Promise<PriceResult> {
  // Sina finance gold API - AU9999
  const url = 'https://hq.sinajs.cn/list=au9999';
  const { text } = await fetchWithAntiCrawl(url, 'https://finance.sina.com.cn/');

  // Response format: var hq_str_au9999="..."
  // Fields are comma-separated, price is typically field index 3
  const match = text.match(/"([^"]+)"/);
  if (!match) {
    throw new Error(`Failed to parse gold price response`);
  }

  const fields = match[1].split(',');
  const price = parseFloat(fields[3]); // Current price field
  if (isNaN(price)) {
    throw new Error(`Invalid gold price: ${fields[3]}`);
  }

  return {
    code: 'AU9999',
    name: '黄金9999',
    price,
    market: 'commodity',
    source: 'sina',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/sources/gold.ts
git commit -m "feat: add gold price fetcher from Sina finance"
```

---

### Task 4: A-Share Stock Fetcher

**Files:**
- Create: `src/lib/services/price/sources/cn-stock.ts`

- [ ] **Step 1: Create A-share price fetcher**

```typescript
import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

function detectExchange(code: string): string {
  // Shanghai: 6xxxxx, Shenzhen: 0xxxxx, 3xxxxx (ChiNext)
  if (code.startsWith('6')) return 'sh';
  return 'sz';
}

export async function fetchCnStockPrice(code: string): Promise<PriceResult> {
  const exchange = detectExchange(code);
  const fullCode = `${exchange}${code}`;

  // Sina finance API
  const url = `https://hq.sinajs.cn/list=${fullCode}`;
  const { text } = await fetchWithAntiCrawl(url, 'https://finance.sina.com.cn/');

  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`Stock ${code} not found or delisted`);
  }

  const fields = match[1].split(',');
  const name = fields[0];
  const price = parseFloat(fields[3]); // Current price

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for stock ${code}: ${fields[3]}`);
  }

  return {
    code,
    name,
    price,
    market: 'cn',
    source: 'sina',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/sources/cn-stock.ts
git commit -m "feat: add A-share stock price fetcher from Sina finance"
```

---

### Task 5: HK Stock Fetcher

**Files:**
- Create: `src/lib/services/price/sources/hk-stock.ts`

- [ ] **Step 1: Create HK stock price fetcher**

```typescript
import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

function padCode(code: string): string {
  // HK stock codes are 5 digits: 00700, 09988
  return code.padStart(5, '0');
}

export async function fetchHkStockPrice(code: string): Promise<PriceResult> {
  const paddedCode = padCode(code);

  // Tencent finance API
  const url = `https://qt.gtimg.cn/q=hk${paddedCode}`;
  const { text } = await fetchWithAntiCrawl(url, 'https://gu.qq.com/');

  // Response format: v_hk00700="..."
  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`HK stock ${code} not found`);
  }

  const fields = match[1].split('~');
  // Fields: [0] unknown, [1] name, [2] price, [3] change, ...
  const name = fields[1];
  const price = parseFloat(fields[3]); // Current price

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for HK stock ${code}: ${fields[3]}`);
  }

  return {
    code,
    name,
    price,
    market: 'hk',
    source: 'tencent',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/sources/hk-stock.ts
git commit -m "feat: add HK stock price fetcher from Tencent finance"
```

---

### Task 6: US Stock Fetcher

**Files:**
- Create: `src/lib/services/price/sources/us-stock.ts`

- [ ] **Step 1: Create US stock price fetcher**

```typescript
import { fetchWithAntiCrawl } from '../anti-crawl';

interface PriceResult {
  code: string;
  name: string;
  price: number;
  market: string;
  source: string;
}

export async function fetchUsStockPrice(code: string): Promise<PriceResult> {
  const upperCode = code.toUpperCase();

  // Sina finance US stock API
  const url = `https://hq.sinajs.cn/list=gb_${upperCode.toLowerCase()}`;
  const { text } = await fetchWithAntiCrawl(url, 'https://finance.sina.com.cn/');

  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error(`US stock ${upperCode} not found`);
  }

  const fields = match[1].split(',');
  const name = fields[0];
  const price = parseFloat(fields[1]); // Current price in USD

  if (isNaN(price) || price === 0) {
    throw new Error(`Invalid price for US stock ${upperCode}: ${fields[1]}`);
  }

  return {
    code: upperCode,
    name,
    price,
    market: 'us',
    source: 'sina',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/sources/us-stock.ts
git commit -m "feat: add US stock price fetcher from Sina finance"
```

---

### Task 7: PriceService Entry Point

**Files:**
- Create: `src/lib/services/price/index.ts`

- [ ] **Step 1: Create PriceService unified entry point**

```typescript
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
  source: string;
}

const MARKET_PRICED_CATEGORIES = ['gold_physical', 'gold_paper', 'stock', 'fund'];

export function isMarketPriced(category: string): boolean {
  return MARKET_PRICED_CATEGORIES.includes(category);
}

export function isStale(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() > 60 * 60 * 1000; // 1 hour
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
      source: result.source,
    },
    update: {
      name: result.name,
      price: result.price,
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/price/index.ts
git commit -m "feat: add PriceService unified entry point with batch refresh"
```

---

### Task 8: Update getAssets to Enrich Prices

**Files:**
- Modify: `src/lib/actions/assets.ts`

- [ ] **Step 1: Update getAssets to attach market prices and compute market value**

In `src/lib/actions/assets.ts`, replace the existing `getAssets` function with:

```typescript
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { isMarketPriced, isStale } from '@/lib/services/price';

export async function getAssets() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const assets = await prisma.asset.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // Collect all market-priced asset codes to batch-fetch prices
  const codesToFetch: { code: string; market: string }[] = [];
  for (const a of assets) {
    if (a.category === 'gold_physical' || a.category === 'gold_paper') {
      codesToFetch.push({ code: 'AU9999', market: 'commodity' });
    } else if ((a.category === 'stock' || a.category === 'fund') && a.stockCode && a.market) {
      codesToFetch.push({ code: a.stockCode, market: a.market });
    }
  }

  // Fetch all relevant prices from cache
  const prices = await prisma.marketPrice.findMany({
    where: {
      OR: codesToFetch.map((c) => ({ code: c.code, market: c.market })),
    },
  });
  const priceMap = new Map<string, { price: number; name: string; updatedAt: Date }>();
  for (const p of prices) {
    priceMap.set(`${p.code}|${p.market}`, { price: Number(p.price), name: p.name, updatedAt: p.updatedAt });
  }

  // Check if any price is stale
  let pricesStale = false;
  for (const p of prices) {
    if (isStale(p.updatedAt)) {
      pricesStale = true;
      break;
    }
  }
  // Also stale if we have market-priced assets with no cached price at all
  for (const c of codesToFetch) {
    if (!priceMap.has(`${c.code}|${c.market}`)) {
      pricesStale = true;
      break;
    }
  }

  const decrypted = assets.map((a) => {
    const balance = decryptValue(a.balance, derivedKey, userId);
    const costPrice = a.costPrice ? decryptValue(a.costPrice, derivedKey, userId) : null;

    // Compute market value for market-priced assets
    let currentUnitPrice: number | null = null;
    let currentValue: string | null = null;
    let marketValue: string = balance;

    if (a.category === 'gold_physical' || a.category === 'gold_paper') {
      const priceData = priceMap.get('AU9999|commodity');
      if (priceData && a.quantity) {
        currentUnitPrice = priceData.price;
        marketValue = new Decimal(a.quantity.toString()).times(priceData.price).toFixed(4);
        currentValue = marketValue;
      }
    } else if ((a.category === 'stock' || a.category === 'fund') && a.stockCode && a.market && a.quantity) {
      const priceData = priceMap.get(`${a.stockCode}|${a.market}`);
      if (priceData) {
        currentUnitPrice = priceData.price;
        marketValue = new Decimal(a.quantity.toString()).times(priceData.price).toFixed(4);
        currentValue = marketValue;
      }
    } else {
      // Non-market-priced: balance stays as-is
      currentValue = balance;
    }

    const quantityNum = a.quantity ? Number(a.quantity) : null;
    const costUnitPriceNum = a.costUnitPrice ? Number(a.costUnitPrice) : null;

    return {
      ...a,
      balance: marketValue,     // Now reflects market value for market-priced assets
      costPrice,
      quantity: quantityNum,
      stockCode: a.stockCode,
      market: a.market,
      costUnitPrice: costUnitPriceNum,
      unitPrice: currentUnitPrice,
      currentValue,
    };
  });

  return { success: true, data: decrypted, pricesStale };
}
```

- [ ] **Step 2: Update createAsset to accept new fields and compute initial balance**

Replace the `createAsset` function signature and body:

```typescript
export async function createAsset(data: {
  name: string;
  category: string;
  balance?: string;
  currency?: string;
  valuationMethod?: string;
  liquidityTier?: string;
  costPrice?: string;
  quantity?: string;
  stockCode?: string;
  market?: string;
  costUnitPrice?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    // For market-priced assets, fetch initial price and compute balance
    let balanceStr: string;
    if (isMarketPriced(data.category) && data.quantity) {
      const quantityDec = new Decimal(data.quantity);
      let currentPrice: Decimal;

      if (data.category === 'gold_physical' || data.category === 'gold_paper') {
        // Try to fetch gold price; fall back to 0 if unavailable
        try {
          const { fetchGoldPrice } = await import('@/lib/services/price/sources/gold');
          const result = await fetchGoldPrice();
          await upsertMarketPriceFromResult(result);
          currentPrice = new Decimal(result.price);
        } catch {
          // Fallback: check if we have a cached price
          const cached = await prisma.marketPrice.findUnique({
            where: { code_market: { code: 'AU9999', market: 'commodity' } },
          });
          currentPrice = cached ? new Decimal(cached.price.toString()) : new Decimal(0);
        }
        balanceStr = quantityDec.times(currentPrice).toFixed(4);
      } else if ((data.category === 'stock' || data.category === 'fund') && data.stockCode && data.market) {
        try {
          const { fetchSinglePrice, upsertMarketPrice } = await import('@/lib/services/price');
          const result = await fetchSinglePrice(data.stockCode, data.market);
          await upsertMarketPrice(result);
          currentPrice = new Decimal(result.price);
        } catch {
          const cached = await prisma.marketPrice.findUnique({
            where: { code_market: { code: data.stockCode, market: data.market } },
          });
          currentPrice = cached ? new Decimal(cached.price.toString()) : new Decimal(0);
        }
        balanceStr = quantityDec.times(currentPrice).toFixed(4);
      } else {
        balanceStr = new Decimal(data.balance || '0').toFixed(4);
      }
    } else {
      balanceStr = new Decimal(data.balance || '0').toFixed(4);
    }

    const encryptedBalance = encryptValue(balanceStr, derivedKey, userId);

    // Compute costPrice = quantity × costUnitPrice
    let computedCostPrice: string | null = null;
    if (data.quantity && data.costUnitPrice) {
      computedCostPrice = new Decimal(data.quantity).times(new Decimal(data.costUnitPrice)).toFixed(4);
    }

    const encryptedCostPrice = computedCostPrice
      ? encryptValue(computedCostPrice, derivedKey, userId)
      : data.costPrice
        ? encryptValue(new Decimal(data.costPrice).toFixed(4), derivedKey, userId)
        : null;

    const asset = await prisma.asset.create({
      data: {
        name: data.name,
        category: data.category,
        balance: encryptedBalance,
        currency: data.currency || 'CNY',
        valuationMethod: data.valuationMethod,
        liquidityTier: data.liquidityTier,
        isEncrypted: true,
        costPrice: encryptedCostPrice,
        quantity: data.quantity ? new Decimal(data.quantity) : undefined,
        stockCode: data.stockCode,
        market: data.market,
        costUnitPrice: data.costUnitPrice ? new Decimal(data.costUnitPrice) : undefined,
        userId,
      },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: asset };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Helper for createAsset
import { upsertMarketPrice } from '@/lib/services/price';
import type { PriceResult } from '@/lib/services/price';

async function upsertMarketPriceFromResult(result: { code: string; name: string; price: number; market: string; source: string }) {
  await prisma.marketPrice.upsert({
    where: { code_market: { code: result.code, market: result.market } },
    create: {
      code: result.code,
      market: result.market,
      name: result.name,
      price: result.price,
      source: result.source,
    },
    update: {
      name: result.name,
      price: result.price,
      source: result.source,
    },
  });
}
```

- [ ] **Step 3: Add refreshMyPrices server action**

Append to `src/lib/actions/assets.ts`:

```typescript
export async function refreshMyPrices() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const assets = await prisma.asset.findMany({
    where: { userId },
    select: { category: true, stockCode: true, market: true },
  });

  const { extractPriceItems, refreshPricesForItems } = await import('@/lib/services/price');
  const items = await extractPriceItems(assets);

  if (items.length === 0) {
    return { success: true, message: '无需要刷新的资产' };
  }

  const result = await refreshPricesForItems(items);
  revalidateTag(`user-${userId}`, 'default');
  return result;
}
```

- [ ] **Step 4: Update updateAsset to accept new fields**

Replace the `updateAsset` function:

```typescript
export async function updateAsset(
  id: string,
  data: Partial<{
    name: string;
    balance: string;
    costPrice: string;
    quantity: string;
    stockCode: string;
    market: string;
    costUnitPrice: string;
  }>
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.stockCode !== undefined) updateData.stockCode = data.stockCode;
    if (data.market !== undefined) updateData.market = data.market;
    if (data.quantity !== undefined) updateData.quantity = new Decimal(data.quantity);
    if (data.costUnitPrice !== undefined) updateData.costUnitPrice = new Decimal(data.costUnitPrice);

    // Recompute costPrice if quantity or costUnitPrice changed
    if (data.quantity !== undefined || data.costUnitPrice !== undefined) {
      const asset = await prisma.asset.findUnique({ where: { id, userId } });
      if (asset) {
        const qty = data.quantity !== undefined ? new Decimal(data.quantity) : new Decimal(asset.quantity?.toString() || '0');
        const cup = data.costUnitPrice !== undefined ? new Decimal(data.costUnitPrice) : new Decimal(asset.costUnitPrice?.toString() || '0');
        updateData.costPrice = encryptValue(qty.times(cup).toFixed(4), derivedKey, userId);
      }
    }

    if (data.balance !== undefined) {
      updateData.balance = encryptValue(new Decimal(data.balance).toFixed(4), derivedKey, userId);
      updateData.isEncrypted = true;
    }
    if (data.costPrice !== undefined && updateData.costPrice === undefined) {
      updateData.costPrice = encryptValue(new Decimal(data.costPrice).toFixed(4), derivedKey, userId);
    }

    const asset = await prisma.asset.update({
      where: { id, userId },
      data: updateData,
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: asset };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/assets.ts
git commit -m "feat: enrich getAssets with market prices, update createAsset/updateAsset for new fields, add refreshMyPrices"
```

---

### Task 9: Cron Endpoint for Prices

**Files:**
- Create: `src/app/api/cron/prices/route.ts`

- [ ] **Step 1: Create cron endpoint**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractPriceItems, refreshPricesForItems } from '@/lib/services/price';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Collect all unique stockCode+market from all users' market-priced assets
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { category: { in: ['gold_physical', 'gold_paper'] } },
          { category: { in: ['stock', 'fund'] }, stockCode: { not: null }, market: { not: null } },
        ],
      },
      select: { category: true, stockCode: true, market: true },
    });

    const items = await extractPriceItems(assets);
    const result = await refreshPricesForItems(items);

    if (!result.success) {
      return NextResponse.json({ success: true, warnings: result.errors }, { status: 200 });
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/prices/route.ts
git commit -m "feat: add cron endpoint for batch price refresh"
```

---

### Task 10: PriceRefresher Client Component

**Files:**
- Create: `src/components/widgets/PriceRefresher.tsx`

- [ ] **Step 1: Create PriceRefresher component**

```typescript
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshMyPrices } from '@/lib/actions/assets';

export function PriceRefresher({ pricesStale }: { pricesStale: boolean }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-refresh on mount if prices are stale
  useEffect(() => {
    if (pricesStale) {
      doRefresh();
    }
  }, []);

  async function doRefresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const result = await refreshMyPrices();
      if (result.success) {
        setMessage('价格已更新');
        startTransition(() => router.refresh());
      } else {
        setMessage('部分价格更新失败');
      }
    } catch {
      setMessage('价格更新失败');
    } finally {
      setRefreshing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={doRefresh}
        disabled={refreshing}
        className="px-3 py-1.5 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <span className={`inline-block w-3.5 h-3.5 border-2 border-ledger-muted border-t-transparent rounded-full ${refreshing ? 'animate-spin' : 'hidden'}`} />
        刷新价格
      </button>
      {message && (
        <span className={`text-xs ${message.includes('失败') ? 'text-ledger-danger' : 'text-ledger-success'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/PriceRefresher.tsx
git commit -m "feat: add PriceRefresher client component for auto/manual refresh"
```

---

### Task 11: Update Asset Management Page UI

**Files:**
- Modify: `src/app/management/assets/page.tsx`

- [ ] **Step 1: Rewrite the asset management page with dynamic form and new columns**

Replace the entire file with:

```typescript
export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets, createAsset, deleteAsset } from '@/lib/actions/assets';
import { AssetTable } from './AssetTable';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';

export default async function AssetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getAssets();
  if (!res.success) {
    redirect('/login');
  }
  const assets = (res.data ?? []) as any[];
  const pricesStale = (res as any).pricesStale ?? false;

  async function handleCreate(formData: FormData) {
    'use server';
    const category = formData.get('category') as string;
    const isGold = category === 'gold_physical' || category === 'gold_paper';
    const isSecurity = category === 'stock' || category === 'fund';

    const result = await createAsset({
      name: formData.get('name') as string,
      category,
      balance: isGold || isSecurity ? undefined : (formData.get('balance') as string),
      currency: (formData.get('currency') as string) || 'CNY',
      quantity: isGold || isSecurity ? (formData.get('quantity') as string) : undefined,
      stockCode: isSecurity ? (formData.get('stockCode') as string) : undefined,
      market: isSecurity ? (formData.get('market') as string) : undefined,
      costUnitPrice: isGold || isSecurity ? (formData.get('costUnitPrice') as string) : undefined,
    });
    if (result.success) {
      redirect('/management/assets');
    }
    if (result.error?.includes('会话密钥')) {
      redirect('/login');
    }
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const result = await deleteAsset(id);
    if (result.success) {
      redirect('/management/assets');
    }
    if (result.error?.includes('会话密钥')) {
      redirect('/login');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">资产管理</h1>
        <PriceRefresher pricesStale={pricesStale} />
      </div>

      <form
        action={handleCreate}
        className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-ledger-muted mb-1">名称</label>
          <input
            name="name"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="资产名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="category"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">选择分类</option>
            <option value="real_estate">🏠 房产</option>
            <option value="cash">💰 现金</option>
            <option value="gold_physical">🟡 实物黄金</option>
            <option value="gold_paper">📄 纸黄金</option>
            <option value="stock">📈 股票</option>
            <option value="fund">📊 基金</option>
            <option value="bond">📜 债券</option>
            <option value="vehicle">🚗 车辆</option>
            <option value="other">📦 其他</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">市场</label>
          <select
            name="market"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">无需</option>
            <option value="cn">A股</option>
            <option value="hk">港股</option>
            <option value="us">美股</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">代码</label>
          <input
            name="stockCode"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent font-mono"
            placeholder="600519"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">持有数量</label>
          <input
            name="quantity"
            type="number"
            step="0.0001"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="克数/股数"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">成本单价</label>
          <input
            name="costUnitPrice"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="每份买入价"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">余额/金额</label>
          <input
            name="balance"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="手动金额（非黄金/股票类）"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">币种</label>
          <input
            name="currency"
            defaultValue="CNY"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-20"
            placeholder="CNY"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          创建
        </button>
      </form>

      <AssetTable assets={assets} handleDelete={handleDelete} />
    </div>
  );
}
```

- [ ] **Step 2: Create AssetTable client component**

Create `src/app/management/assets/AssetTable.tsx`:

```typescript
'use client';

const categoryLabel: Record<string, string> = {
  real_estate: '房产', cash: '现金', gold_physical: '实物黄金', gold_paper: '纸黄金',
  stock: '股票', fund: '基金', bond: '债券', vehicle: '车辆', other: '其他',
};
const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };

export function AssetTable({ assets, handleDelete }: { assets: any[]; handleDelete: (formData: FormData) => Promise<void> }) {
  return (
    <div className="rounded-xl bg-ledger-surface overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ledger-bg text-left text-ledger-muted">
            <th className="px-4 py-3 font-medium">名称</th>
            <th className="px-4 py-3 font-medium">分类</th>
            <th className="px-4 py-3 font-medium">市场</th>
            <th className="px-4 py-3 font-medium">代码</th>
            <th className="px-4 py-3 font-medium text-right">持有数量</th>
            <th className="px-4 py-3 font-medium text-right">成本单价</th>
            <th className="px-4 py-3 font-medium text-right">当前单价</th>
            <th className="px-4 py-3 font-medium text-right">市场价值</th>
            <th className="px-4 py-3 font-medium text-right">盈亏</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-ledger-muted">暂无资产</td>
            </tr>
          )}
          {assets.map((asset: any) => {
            const marketValue = parseFloat(asset.currentValue || asset.balance || '0');
            const costBasis = asset.quantity && asset.costUnitPrice
              ? asset.quantity * asset.costUnitPrice
              : parseFloat(asset.costPrice || '0');
            const pnl = marketValue - costBasis;
            const pnlPct = costBasis > 0 ? (pnl / costBasis * 100) : 0;
            const isMarketPriced = ['gold_physical', 'gold_paper', 'stock', 'fund'].includes(asset.category);

            return (
              <tr key={asset.id} className="border-b border-ledger-bg last:border-0">
                <td className="px-4 py-3 text-white">{asset.name}</td>
                <td className="px-4 py-3 text-ledger-muted">{categoryLabel[asset.category] || asset.category}</td>
                <td className="px-4 py-3 text-ledger-muted">{asset.market ? (marketLabel[asset.market] || asset.market) : '-'}</td>
                <td className="px-4 py-3 text-ledger-muted font-mono">{asset.stockCode || '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.quantity ?? '-'}</td>
                <td className="px-4 py-3 text-right text-ledger-muted">{asset.costUnitPrice != null ? `¥${Number(asset.costUnitPrice).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.unitPrice != null ? `¥${asset.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white font-medium">¥{marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">
                  {isMarketPriced && costBasis > 0 ? (
                    <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pnl >= 0 ? '+' : ''}¥{pnl.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-ledger-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={asset.id} />
                    <button type="submit" className="text-ledger-danger hover:underline text-xs">删除</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/management/assets/page.tsx src/app/management/assets/AssetTable.tsx
git commit -m "feat: redesign asset management page with market price fields and new table columns"
```

---

### Task 12: Update StockTable for Full Market Data

**Files:**
- Modify: `src/components/widgets/StockTable.tsx`

- [ ] **Step 1: Update StockTable to use real market data**

Replace the file with:

```typescript
'use client';

const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };
const currencySymbol: Record<string, string> = { cn: '¥', hk: 'HK$', us: '$' };
const fmt = (val: number, market?: string) => `${currencySymbol[market || 'cn'] || '¥'}${Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Stock {
  id: string;
  name: string;
  stockCode?: string | null;
  market?: string | null;
  quantity?: number | null;
  costPrice?: string | null;
  costUnitPrice?: number | null;
  currentValue?: string | null;
  balance?: string;
  unitPrice?: number | null;
}

export default function StockTable({ stocks }: { stocks: Stock[] }) {
  // Filter only stocks with market data
  const marketStocks = stocks.filter((s) => s.stockCode && s.market);

  const totalValue = marketStocks.reduce((s, st) => s + parseFloat(st.currentValue || st.balance || '0'), 0);
  const totalCost = marketStocks.reduce((s, st) => {
    const qty = st.quantity || 0;
    const cup = st.costUnitPrice || parseFloat(st.costPrice || '0');
    return s + (cup * qty);
  }, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  if (marketStocks.length === 0) {
    return <div className="py-8 text-center text-ledger-muted">暂无股票持仓，请在资产管理中添加股票资产并填写代码和市场</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-sm mb-3">
        <span className="text-ledger-muted">本金 <span className="text-white font-medium">{fmt(totalCost)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">市值 <span className="text-ledger-success font-medium">{fmt(totalValue)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">浮动盈亏 <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-primary/10 text-ledger-muted">
              <th className="text-left py-2 px-3">名称</th>
              <th className="text-left py-2 px-3">市场</th>
              <th className="text-left py-2 px-3">代码</th>
              <th className="text-right py-2 px-3">数量</th>
              <th className="text-right py-2 px-3">成本价</th>
              <th className="text-right py-2 px-3">现价</th>
              <th className="text-right py-2 px-3">市值</th>
              <th className="text-right py-2 px-3">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {marketStocks.map((s) => {
              const value = parseFloat(s.currentValue || s.balance || '0');
              const qty = s.quantity || 0;
              const cup = s.costUnitPrice || parseFloat(s.costPrice || '0');
              const cost = cup * qty;
              const pnl = value - cost;
              const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;
              const market = s.market || 'cn';
              return (
                <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                  <td className="py-2 px-3 text-white">{s.name}</td>
                  <td className="py-2 px-3"><span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{marketLabel[market] || market}</span></td>
                  <td className="py-2 px-3 text-ledger-muted font-mono">{s.stockCode || '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{qty || '-'}</td>
                  <td className="py-2 px-3 text-right text-ledger-muted">{cup > 0 ? fmt(cup, market) : '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{s.unitPrice ? fmt(s.unitPrice, market) : '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{fmt(value, market)}</td>
                  <td className="py-2 px-3 text-right"><span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{fmt(pnl, market)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/StockTable.tsx
git commit -m "feat: update StockTable to use real market data from Asset fields"
```

---

### Task 13: Integrate PriceRefresher into Dashboard

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Add PriceRefresher to dashboard Stock section**

In the dashboard, add import for PriceRefresher and pass pricesStale to it. Only change the Stock section:

Add import at top:
```typescript
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
```

Extract `pricesStale` from assetsRes:
```typescript
const pricesStale = (assetsRes as any).pricesStale ?? false;
```

Replace the Stock Holdings section header (lines 161-169) with:
```typescript
      {/* Stock Holdings — detail under Assets + Liabilities */}
      <ErrorBoundary name="StockTable">
        <div className="bg-ledger-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">股票持仓</h2>
            <div className="flex items-center gap-3">
              <PriceRefresher pricesStale={pricesStale} />
              <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
          </div>
          <StockTable stocks={stocks} />
        </div>
      </ErrorBoundary>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: integrate PriceRefresher into dashboard stock section"
```

---

### Task 14: Remove Old Gold/Stock Actions and Cron

**Files:**
- Modify: `src/lib/actions/gold.ts`
- Remove: `src/app/api/cron/gold/route.ts`

- [ ] **Step 1: Update gold.ts to use new PriceService**

Replace `src/lib/actions/gold.ts`:

```typescript
'use server';
import { prisma } from '@/lib/prisma';
import { fetchGoldPrice } from '@/lib/services/price/sources/gold';
import { upsertMarketPrice } from '@/lib/services/price';

export async function getCurrentGoldPrice() {
  const latest = await prisma.marketPrice.findFirst({
    where: { code: 'AU9999', market: 'commodity' },
    orderBy: { updatedAt: 'desc' },
  });
  return { success: true, data: latest };
}

export async function fetchAndStoreGoldPrice() {
  try {
    const result = await fetchGoldPrice();
    await upsertMarketPrice(result);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

Delete `src/app/api/cron/gold/route.ts`:

```bash
rm src/app/api/cron/gold/route.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/gold.ts && git rm src/app/api/cron/gold/route.ts
git commit -m "refactor: migrate gold actions to PriceService, remove old gold cron endpoint"
```

---

### Task 15: Seed Update

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update seed to include market-priced assets and MarketPrice data**

Replace the asset creation block (lines 37-42) in `prisma/seed.ts`:

```typescript
  // Create assets (plain text balances for demo)
  const assets = await prisma.asset.createMany({
    data: [
      { name: '现金存款', category: 'cash', balance: '100000.0000', currency: 'CNY', userId: user.id, isEncrypted: false },
      { name: '黄金储备', category: 'gold_physical', balance: '26025.0000', currency: 'CNY', quantity: 50, costUnitPrice: 480, costPrice: '24000.0000', userId: user.id, isEncrypted: false },
      { name: '贵州茅台', category: 'stock', balance: '260000.0000', currency: 'CNY', quantity: 500, stockCode: '600519', market: 'cn', costUnitPrice: 480, costPrice: '240000.0000', userId: user.id, isEncrypted: false },
    ],
  });

  // Seed market prices
  await prisma.marketPrice.upsert({
    where: { code_market: { code: 'AU9999', market: 'commodity' } },
    create: { code: 'AU9999', market: 'commodity', name: '黄金9999', price: 520.50, source: 'seed' },
    update: {},
  });
  await prisma.marketPrice.upsert({
    where: { code_market: { code: '600519', market: 'cn' } },
    create: { code: '600519', market: 'cn', name: '贵州茅台', price: 520.00, source: 'seed' },
    update: {},
  });
```

- [ ] **Step 2: Run seed to verify**

```bash
npx tsx prisma/seed.ts
```

Expected: Seed completes without errors, creating 3 assets and 2 MarketPrice records.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed with market-priced assets and MarketPrice data"
```

---

### Task 16: Build Verification

- [ ] **Step 1: Run type check**

```bash
cd /home/kyrie/workspace/elevate-life && npx tsc --noEmit
```

Expected: No type errors. If any, fix and re-run.

- [ ] **Step 2: Run Prisma generate**

```bash
npx prisma generate
```

Expected: No errors.

- [ ] **Step 3: Start dev server and verify pages load**

```bash
npm run dev
```

Visit:
- `/login` — login works
- `/management/assets` — form shows all fields, table shows new columns
- `/` — dashboard loads, StockTable shows market data

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: type and build fixes for market price integration"
```
