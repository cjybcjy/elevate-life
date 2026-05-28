'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { isMarketPriced, isStale, upsertMarketPrice } from '@/lib/services/price';

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
    where: codesToFetch.length > 0 ? {
      OR: codesToFetch.map((c) => ({ code: c.code, market: c.market })),
    } : undefined,
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
      balance: marketValue,
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
        try {
          const { fetchGoldPrice } = await import('@/lib/services/price/sources/gold');
          const result = await fetchGoldPrice();
          await upsertMarketPrice(result);
          currentPrice = new Decimal(result.price);
        } catch {
          const cached = await prisma.marketPrice.findUnique({
            where: { code_market: { code: 'AU9999', market: 'commodity' } },
          });
          currentPrice = cached ? new Decimal(cached.price.toString()) : new Decimal(0);
        }
        balanceStr = quantityDec.times(currentPrice).toFixed(4);
      } else if ((data.category === 'stock' || data.category === 'fund') && data.stockCode && data.market) {
        try {
          const { fetchSinglePrice } = await import('@/lib/services/price');
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
