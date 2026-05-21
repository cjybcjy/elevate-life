'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';

export async function getAssets() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  const assets = await prisma.asset.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const decrypted = assets.map((a) => ({
    ...a,
    balance: decryptValue(a.balance, derivedKey, userId),
    costPrice: a.costPrice ? decryptValue(a.costPrice, derivedKey, userId) : null,
  }));

  return { success: true, data: decrypted };
}

export async function createAsset(data: {
  name: string;
  category: string;
  balance: string;
  currency?: string;
  valuationMethod?: string;
  liquidityTier?: string;
  costPrice?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  try {
    const balanceStr = new Decimal(data.balance).toFixed(4);
    const encryptedBalance = encryptValue(balanceStr, derivedKey, userId);
    const encryptedCostPrice = data.costPrice
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
        userId,
      },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: asset };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateAsset(id: string, data: Partial<{ name: string; balance: string; costPrice: string }>) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  try {
    const updateData: any = { ...data };
    if (data.balance !== undefined) {
      updateData.balance = encryptValue(new Decimal(data.balance).toFixed(4), derivedKey, userId);
      updateData.isEncrypted = true;
    }
    if (data.costPrice !== undefined) {
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
