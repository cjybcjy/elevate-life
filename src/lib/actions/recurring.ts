'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { processDueRecurringForUser } from '@/lib/services/recurring-processor';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';

export async function getRecurringRules() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const rules = await prisma.recurringRule.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { nextDueDate: 'asc' },
  });

  const data = rules.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    type: r.type,
    amount: r.amount.toFixed(4),
    currency: r.currency,
    categoryId: r.categoryId,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    description: r.description,
    frequency: r.frequency,
    interval: r.interval,
    nextDueDate: r.nextDueDate,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: r.category
      ? {
          id: r.category.id,
          userId: r.category.userId,
          name: r.category.name,
          type: r.category.type,
          isEssential: r.category.isEssential,
          essentialRatio: r.category.essentialRatio.toNumber(),
          icon: r.category.icon,
          color: r.category.color,
          createdAt: r.category.createdAt,
          updatedAt: r.category.updatedAt,
        }
      : null,
  }));
  return { success: true, data };
}

export async function createRecurringRule(data: {
  name: string;
  type: string;
  amount: string;
  currency?: string;
  categoryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  description?: string;
  frequency: string;
  interval?: number;
  startDate: string;
  isActive?: boolean;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const rule = await prisma.recurringRule.create({
      data: {
        name: data.name,
        type: data.type,
        amount: new Decimal(data.amount),
        currency: data.currency || 'CNY',
        categoryId: data.categoryId || null,
        fromAccountId: data.fromAccountId || null,
        toAccountId: data.toAccountId || null,
        description: data.description,
        frequency: data.frequency,
        interval: data.interval ?? 1,
        nextDueDate: new Date(data.startDate),
        isActive: data.isActive ?? true,
        userId,
      },
    });

    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        id: rule.id,
        userId: rule.userId,
        name: rule.name,
        type: rule.type,
        amount: rule.amount.toFixed(4),
        currency: rule.currency,
        categoryId: rule.categoryId,
        fromAccountId: rule.fromAccountId,
        toAccountId: rule.toAccountId,
        description: rule.description,
        frequency: rule.frequency,
        interval: rule.interval,
        nextDueDate: rule.nextDueDate,
        isActive: rule.isActive,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateRecurringRule(
  id: string,
  data: Partial<{
    name: string;
    amount: string;
    frequency: string;
    interval: number;
    nextDueDate: string;
    categoryId: string;
    fromAccountId: string;
    toAccountId: string;
  }>
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.interval !== undefined) updateData.interval = data.interval;
    if (data.nextDueDate !== undefined) updateData.nextDueDate = new Date(data.nextDueDate);
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.fromAccountId !== undefined) updateData.fromAccountId = data.fromAccountId || null;
    if (data.toAccountId !== undefined) updateData.toAccountId = data.toAccountId || null;

    await prisma.recurringRule.updateMany({
      where: { id, userId },
      data: updateData,
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleRecurringRule(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
    if (!rule) return { success: false, error: 'Rule not found' };

    await prisma.recurringRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteRecurringRule(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.recurringRule.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function processMyDueRecurring() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录后再自动记录' };

  return processDueRecurringForUser(userId, derivedKey);
}
