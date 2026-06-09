'use server';
import { prisma } from '@/lib/prisma';
import { fetchGoldPrice } from '@/lib/services/price/sources/gold';
import { upsertMarketPrice } from '@/lib/services/price';

export async function getCurrentGoldPrice() {
  const latest = await prisma.marketPrice.findFirst({
    where: { code: 'AU9999', market: 'commodity' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!latest) return { success: true, data: null };
  return {
    success: true,
    data: { ...latest, price: Number(latest.price), currency: latest.currency },
  };
}

export async function fetchAndStoreGoldPrice() {
  try {
    const result = await fetchGoldPrice();
    await upsertMarketPrice(result);
    return { success: true, data: { ...result, price: result.price } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
