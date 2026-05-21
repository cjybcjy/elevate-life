'use server';
import { prisma } from '@/lib/prisma';

export async function getCurrentGoldPrice() {
  const latest = await prisma.goldPrice.findFirst({
    where: { assetType: 'gold_au9999' },
    orderBy: { recordedAt: 'desc' },
  });
  return { success: true, data: latest };
}

export async function fetchGoldPrice() {
  try {
    // Simplified gold price fetching
    // In production, this would call actual gold price APIs
    const mockPrice = 450 + Math.random() * 50;
    await prisma.goldPrice.create({
      data: {
        assetType: 'gold_au9999',
        price: mockPrice,
        dataSource: 'mock',
        recordedAt: new Date(),
      },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
