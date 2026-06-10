'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { isMarketPriced, isStale, upsertMarketPrice, fetchSinglePrice } from '@/lib/services/price';
import { fetchGoldPrice } from '@/lib/services/price/sources/gold';

function detectMarket(stockCode?: string): string | undefined {
  if (!stockCode) return undefined;
  const code = stockCode.trim();
  // A-share: 6xxxxx (Shanghai), 0xxxxx/3xxxxx (Shenzhen)
  if (/^[036]\d{5}$/.test(code)) return 'cn';
  // HK: 4-5 digit numeric code
  if (/^\d{4,5}$/.test(code)) return 'hk';
  // US: alphabetic ticker
  if (/^[A-Za-z]{1,5}$/.test(code)) return 'us';
  return undefined;
}

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
  const prices = codesToFetch.length > 0
    ? await prisma.marketPrice.findMany({
        where: { OR: codesToFetch.map((c) => ({ code: c.code, market: c.market })) },
      })
    : [];
  const priceMap = new Map<string, { price: number; name: string; currency: string; updatedAt: Date }>();
  for (const p of prices) {
    priceMap.set(`${p.code}|${p.market}`, { price: Number(p.price), name: p.name, currency: p.currency, updatedAt: p.updatedAt });
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
    try {
      const balance = decryptValue(a.balance, derivedKey, userId);
      const costPrice = a.costPrice ? decryptValue(a.costPrice, derivedKey, userId) : null;

      // Compute market value for market-priced assets
      let currentUnitPrice: number | null = null;
      let currentValue: string | null = null;
      let marketValue: string = balance;
      let priceCurrency: string | null = null;

      if (a.category === 'gold_physical' || a.category === 'gold_paper') {
        const priceData = priceMap.get('AU9999|commodity');
        if (priceData && a.quantity) {
          currentUnitPrice = priceData.price;
          marketValue = new Decimal(a.quantity.toString()).times(priceData.price).toFixed(4);
          currentValue = marketValue;
          priceCurrency = priceData.currency;
        }
      } else if ((a.category === 'stock' || a.category === 'fund') && a.stockCode && a.market && a.quantity) {
        const priceData = priceMap.get(`${a.stockCode}|${a.market}`);
        if (priceData) {
          currentUnitPrice = priceData.price;
          marketValue = new Decimal(a.quantity.toString()).times(priceData.price).toFixed(4);
          currentValue = marketValue;
          priceCurrency = priceData.currency;
        }
      } else {
        // Non-market-priced: apply straight-line depreciation if configured
        currentValue = balance;
        if (a.purchaseDate && a.scrapDate && costPrice !== null) {
          const purchaseDate = new Date(a.purchaseDate);
          const scrapDate = new Date(a.scrapDate);
          const now = new Date();
          const totalDays = (scrapDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
          const elapsedDays = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
          const scrapVal = a.scrapValue ? Number(a.scrapValue) : 0;
          const purchasePrice = parseFloat(costPrice);

          if (totalDays > 0) {
            const ratio = Math.max(0, Math.min(1, elapsedDays / totalDays));
            const depreciatedValue = purchasePrice - (purchasePrice - scrapVal) * ratio;
            const rounded = depreciatedValue.toFixed(4);
            currentValue = rounded;
            marketValue = rounded;
          }
        }
      }

      const quantityNum = a.quantity ? Number(a.quantity) : null;
      const costUnitPriceNum = a.costUnitPrice ? Number(a.costUnitPrice) : null;

      return {
        id: a.id,
        userId: a.userId,
        name: a.name,
        category: a.category,
        balance: marketValue,
        currency: a.currency,
        valuationMethod: a.valuationMethod,
        liquidityTier: a.liquidityTier,
        isEncrypted: a.isEncrypted,
        costPrice,
        quantity: quantityNum,
        stockCode: a.stockCode,
        market: a.market,
        costUnitPrice: costUnitPriceNum,
        unitPrice: currentUnitPrice,
        currentValue,
        priceCurrency,
        purchaseDate: a.purchaseDate,
        scrapDate: a.scrapDate,
        scrapValue: a.scrapValue ? Number(a.scrapValue) : null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    } catch {
      const quantityNum = a.quantity ? Number(a.quantity) : null;
      const costUnitPriceNum = a.costUnitPrice ? Number(a.costUnitPrice) : null;
      return {
        id: a.id,
        userId: a.userId,
        name: a.name,
        category: a.category,
        balance: '[decryption error]',
        currency: a.currency,
        valuationMethod: a.valuationMethod,
        liquidityTier: a.liquidityTier,
        isEncrypted: a.isEncrypted,
        costPrice: null,
        quantity: quantityNum,
        stockCode: a.stockCode,
        market: a.market,
        costUnitPrice: costUnitPriceNum,
        unitPrice: null,
        currentValue: null,
        priceCurrency: null,
        purchaseDate: a.purchaseDate,
        scrapDate: a.scrapDate,
        scrapValue: a.scrapValue ? Number(a.scrapValue) : null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    }
  });

  return { success: true, data: decrypted, pricesStale };
}

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
  purchaseDate?: string;
  scrapDate?: string;
  scrapValue?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  // Auto-detect market from stock code if not provided
  const resolvedMarket = data.market || detectMarket(data.stockCode);

  try {
    // For market-priced assets, fetch initial price and compute balance
    let balanceStr: string;
    let fetchedPrice: Decimal | null = null;
    if (isMarketPriced(data.category) && data.quantity) {
      const quantityDec = new Decimal(data.quantity);
      let currentPrice: Decimal;

      if (data.category === 'gold_physical' || data.category === 'gold_paper') {
        try {
          const result = await fetchGoldPrice();
          await upsertMarketPrice(result);
          currentPrice = new Decimal(result.price);
        } catch (error) {
          console.error('Failed to fetch gold price:', error);
          const cached = await prisma.marketPrice.findUnique({
            where: { code_market: { code: 'AU9999', market: 'commodity' } },
          });
          currentPrice = cached ? new Decimal(cached.price.toString()) : new Decimal(0);
        }
        balanceStr = quantityDec.times(currentPrice).toFixed(4);
        fetchedPrice = currentPrice;
      } else if ((data.category === 'stock' || data.category === 'fund') && data.stockCode && resolvedMarket) {
        try {
          const result = await fetchSinglePrice(data.stockCode, resolvedMarket);
          await upsertMarketPrice(result);
          currentPrice = new Decimal(result.price);
        } catch (error) {
          console.error(`Failed to fetch price for ${data.stockCode} (${resolvedMarket}):`, error);
          const cached = await prisma.marketPrice.findUnique({
            where: { code_market: { code: data.stockCode, market: resolvedMarket } },
          });
          currentPrice = cached ? new Decimal(cached.price.toString()) : new Decimal(0);
        }
        balanceStr = quantityDec.times(currentPrice).toFixed(4);
        fetchedPrice = currentPrice;
      } else {
        balanceStr = new Decimal(data.balance || '0').toFixed(4);
      }
    } else {
      balanceStr = new Decimal(data.balance || '0').toFixed(4);
    }

    const encryptedBalance = encryptValue(balanceStr, derivedKey, userId);

    // Compute costPrice = quantity × costUnitPrice
    // Auto-set costUnitPrice only for gold (commodity), not stocks/funds
    // Stocks have actual purchase prices that differ from market price
    const isGoldCategory = data.category === 'gold_physical' || data.category === 'gold_paper';
    const effectiveCostUnitPrice = data.costUnitPrice
      || (isGoldCategory && fetchedPrice ? fetchedPrice.toString() : undefined);

    let computedCostPrice: string | null = null;
    if (data.quantity && effectiveCostUnitPrice) {
      computedCostPrice = new Decimal(data.quantity).times(new Decimal(effectiveCostUnitPrice)).toFixed(4);
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
        market: resolvedMarket,
        costUnitPrice: effectiveCostUnitPrice ? new Decimal(effectiveCostUnitPrice) : undefined,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        scrapDate: data.scrapDate ? new Date(data.scrapDate) : undefined,
        scrapValue: data.scrapValue ? new Decimal(data.scrapValue) : undefined,
        userId,
      },
    });

    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        ...asset,
        quantity: asset.quantity ? Number(asset.quantity) : null,
        costUnitPrice: asset.costUnitPrice ? Number(asset.costUnitPrice) : null,
        scrapValue: asset.scrapValue ? Number(asset.scrapValue) : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

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
    purchaseDate: string;
    scrapDate: string;
    scrapValue: string;
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
    if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
    if (data.scrapDate !== undefined) updateData.scrapDate = data.scrapDate ? new Date(data.scrapDate) : null;
    if (data.scrapValue !== undefined) updateData.scrapValue = data.scrapValue ? new Decimal(data.scrapValue) : null;

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
    return {
      success: true,
      data: {
        ...asset,
        quantity: asset.quantity ? Number(asset.quantity) : null,
        costUnitPrice: asset.costUnitPrice ? Number(asset.costUnitPrice) : null,
        scrapValue: asset.scrapValue ? Number(asset.scrapValue) : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteAsset(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.asset.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function refreshMyPrices() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

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
