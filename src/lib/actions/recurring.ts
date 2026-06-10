'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { createTransaction } from './ledger';

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

function computeNextDueDate(current: Date, frequency: string, interval: number): Date {
  const next = new Date(current);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * interval);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
  }
  return next;
}

export async function processDueRecurring() {
  const now = new Date();

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: now },
    },
  });

  const results: { ruleId: string; name: string; success: boolean; error?: string }[] = [];

  for (const rule of dueRules) {
    try {
      const nextDue = computeNextDueDate(rule.nextDueDate, rule.frequency, rule.interval);

      await prisma.$transaction(async (tx) => {
        // Deduct from source account
        if (rule.fromAccountId) {
          const [asset] = await tx.$queryRawUnsafe<{ id: string; balance: string; is_encrypted: boolean }[]>(
            `SELECT id, balance, is_encrypted FROM "Asset" WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            rule.fromAccountId, rule.userId
          );
          if (asset) {
            const current = new Decimal(asset.balance);
            const newBalance = current.minus(rule.amount);
            if (!newBalance.isNegative()) {
              await tx.$executeRawUnsafe(
                `UPDATE "Asset" SET balance = $1 WHERE id = $2`,
                newBalance.toFixed(4), asset.id
              );
            }
          }
        }
        // Add to target account
        if (rule.toAccountId) {
          const [asset] = await tx.$queryRawUnsafe<{ id: string; balance: string }[]>(
            `SELECT id, balance FROM "Asset" WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            rule.toAccountId, rule.userId
          );
          if (asset) {
            const current = new Decimal(asset.balance);
            const newBalance = current.plus(rule.amount);
            await tx.$executeRawUnsafe(
              `UPDATE "Asset" SET balance = $1 WHERE id = $2`,
              newBalance.toFixed(4), asset.id
            );
          }
        }
        await tx.transaction.create({
          data: {
            type: rule.type,
            amount: rule.amount,
            categoryId: rule.categoryId,
            fromAccountId: rule.fromAccountId,
            toAccountId: rule.toAccountId,
            description: rule.description || `[周期] ${rule.name}`,
            occurredAt: now,
            currency: rule.currency,
            userId: rule.userId,
          },
        });
        // Advance nextDueDate atomically — prevents duplicates
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { nextDueDate: nextDue },
        });
      });

      results.push({ ruleId: rule.id, name: rule.name, success: true });
    } catch (error: any) {
      results.push({ ruleId: rule.id, name: rule.name, success: false, error: error.message });
    }
  }

  // Revalidate all affected users
  const userIds = [...new Set(dueRules.map(r => r.userId))];
  for (const uid of userIds) {
    revalidateTag(`user-${uid}`, 'default');
  }

  return { success: true, data: results };
}
