'use server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { fetchGoldPrice } from '@/lib/services/price/sources/gold';
import { upsertMarketPrice } from '@/lib/services/price';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export async function getCurrentGoldPrice() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

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
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const rateLimit = await consumeRateLimit({
      scope: 'gold-price-refresh',
      identifier: userId,
      limit: 5,
      windowMs: 60 * 1_000,
    });
    if (!rateLimit.allowed) {
      return { success: false, error: '刷新过于频繁，请稍后重试' };
    }

    const result = await fetchGoldPrice();
    await upsertMarketPrice(result);
    return { success: true, data: { ...result, price: result.price } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
