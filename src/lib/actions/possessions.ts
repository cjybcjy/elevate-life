'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { decryptValue, encryptValue } from '@/lib/crypto';
import { getUserKey } from '@/lib/key-cache';
import {
  normalizePossessionStatus,
  type PossessionStatus,
} from '@/lib/possession-metrics';
import { prisma } from '@/lib/prisma';

export type PossessionRecord = {
  id: string;
  name: string;
  category: string;
  purchasePrice: number;
  purchaseDate: string;
  status: PossessionStatus;
  soldPrice: number | null;
  soldDate: string | null;
  createdAt: string;
  updatedAt: string;
};

async function requirePossessionSession() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Unauthorized' as const };

  const derivedKey = session.user.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { error: '会话密钥已过期，请退出重新登录' as const };

  return { userId, derivedKey };
}

function refreshPossessionPages() {
  revalidatePath('/me');
  revalidatePath('/possessions');
}

export async function getPossessions() {
  const access = await requirePossessionSession();
  if ('error' in access) return { success: false as const, error: access.error };

  const rows = await prisma.possession.findMany({
    where: { userId: access.userId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  try {
    const data: PossessionRecord[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      purchasePrice: Number(decryptValue(row.purchasePrice, access.derivedKey, access.userId)),
      purchaseDate: row.purchaseDate.toISOString(),
      status: normalizePossessionStatus(row.status),
      soldPrice: row.soldPrice
        ? Number(decryptValue(row.soldPrice, access.derivedKey, access.userId))
        : null,
      soldDate: row.soldDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    return { success: true as const, data };
  } catch {
    return { success: false as const, error: '物品数据解密失败，请退出重新登录' };
  }
}

export async function createPossession(data: {
  name: string;
  category: string;
  purchasePrice: string;
  purchaseDate: string;
}) {
  const access = await requirePossessionSession();
  if ('error' in access) return { success: false as const, error: access.error };

  const name = data.name.trim();
  const category = data.category.trim();
  if (!name || !category || !data.purchaseDate) {
    return { success: false as const, error: '请填写完整的物品信息' };
  }

  let purchasePrice: Decimal;
  try {
    purchasePrice = new Decimal(data.purchasePrice);
  } catch {
    return { success: false as const, error: '购买价格格式不正确' };
  }
  if (purchasePrice.isNegative()) {
    return { success: false as const, error: '购买价格不能为负数' };
  }

  const purchaseDate = new Date(data.purchaseDate);
  if (Number.isNaN(purchaseDate.getTime())) {
    return { success: false as const, error: '购买日期格式不正确' };
  }

  try {
    await prisma.possession.create({
      data: {
        userId: access.userId,
        name,
        category,
        purchasePrice: encryptValue(
          purchasePrice.toDecimalPlaces(2).toFixed(2),
          access.derivedKey,
          access.userId,
        ),
        purchaseDate,
        isEncrypted: true,
      },
    });
    refreshPossessionPages();
    return { success: true as const };
  } catch (error) {
    console.error('Failed to create possession', error);
    return { success: false as const, error: '物品保存失败，请稍后重试' };
  }
}

export async function updatePossessionStatus(data: {
  id: string;
  status: string;
  soldPrice?: string;
  soldDate?: string;
}) {
  const access = await requirePossessionSession();
  if ('error' in access) return { success: false as const, error: access.error };

  const status = normalizePossessionStatus(data.status);
  let soldPrice: string | null = null;
  let soldDate: Date | null = null;

  if (status === 'sold') {
    try {
      const parsed = new Decimal(data.soldPrice || '0');
      if (parsed.isNegative()) return { success: false as const, error: '出售价格不能为负数' };
      soldPrice = encryptValue(
        parsed.toDecimalPlaces(2).toFixed(2),
        access.derivedKey,
        access.userId,
      );
    } catch {
      return { success: false as const, error: '出售价格格式不正确' };
    }
    soldDate = data.soldDate ? new Date(data.soldDate) : new Date();
    if (Number.isNaN(soldDate.getTime())) {
      return { success: false as const, error: '出售日期格式不正确' };
    }
  }

  try {
    const result = await prisma.possession.updateMany({
      where: { id: data.id, userId: access.userId },
      data: { status, soldPrice, soldDate },
    });
    if (result.count === 0) return { success: false as const, error: '未找到该物品' };
    refreshPossessionPages();
    return { success: true as const };
  } catch (error) {
    console.error('Failed to update possession', error);
    return { success: false as const, error: '物品状态更新失败' };
  }
}

export async function deletePossession(id: string) {
  const access = await requirePossessionSession();
  if ('error' in access) return { success: false as const, error: access.error };

  try {
    await prisma.possession.deleteMany({ where: { id, userId: access.userId } });
    refreshPossessionPages();
    return { success: true as const };
  } catch (error) {
    console.error('Failed to delete possession', error);
    return { success: false as const, error: '物品删除失败' };
  }
}
