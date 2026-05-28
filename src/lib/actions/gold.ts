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
