'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { decryptValue, encryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';

type ProcessRecurringResult = {
  ruleId: string;
  name: string;
  success: boolean;
  error?: string;
  nextDueDate?: Date;
  skipped?: boolean;
};

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

function computeNextFutureDueDate(current: Date, frequency: string, interval: number, reference: Date): Date {
  let next = computeNextDueDate(current, frequency, interval);
  let guard = 0;

  while (next <= reference && guard < 500) {
    next = computeNextDueDate(next, frequency, interval);
    guard += 1;
  }

  if (guard >= 500) {
    throw new Error('周期规则落后太多，请手动调整下次到期日');
  }

  return next;
}

async function getRecurringUserKey(
  userId: string,
  knownKeys: Map<string, string>,
) {
  const existing = knownKeys.get(userId);
  if (existing) return existing;

  const key = await getUserKey(userId);
  if (key) knownKeys.set(userId, key);
  return key;
}

async function adjustRecurringAssetBalance(
  tx: Prisma.TransactionClient,
  assetId: string,
  userId: string,
  derivedKey: string,
  delta: Decimal,
) {
  const [asset] = await tx.$queryRaw<{ id: string; balance: string }[]>`
    SELECT id, balance FROM "Asset"
    WHERE id = ${assetId} AND user_id = ${userId}
    FOR UPDATE
  `;
  if (!asset) throw new Error('资金账户不存在');

  const currentBalance = new Decimal(decryptValue(asset.balance, derivedKey, userId));
  const newBalance = currentBalance.plus(delta);
  if (newBalance.isNegative()) {
    throw new Error('资金账户余额不足');
  }

  await tx.asset.update({
    where: { id: asset.id },
    data: {
      balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
      isEncrypted: true,
    },
  });
}

async function processDueRecurringForUser(options: {
  userId?: string;
  derivedKey?: string | null;
} = {}) {
  const now = new Date();
  const knownKeys = new Map<string, string>();
  if (options.userId && options.derivedKey) {
    knownKeys.set(options.userId, options.derivedKey);
  }

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: now },
      ...(options.userId ? { userId: options.userId } : {}),
    },
  });

  const results: ProcessRecurringResult[] = [];

  for (const candidate of dueRules) {
    try {
      const needsAccountKey = Boolean(candidate.fromAccountId || candidate.toAccountId);
      const derivedKey = needsAccountKey
        ? await getRecurringUserKey(candidate.userId, knownKeys)
        : null;
      if (needsAccountKey && !derivedKey) {
        throw new Error('会话密钥已过期，请退出重新登录后再自动记录');
      }

      let transactionCreated = false;
      let nextDue: Date | undefined;

      await prisma.$transaction(async (tx) => {
        const [lockedRule] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "RecurringRule"
          WHERE id = ${candidate.id}
          FOR UPDATE
        `;
        if (!lockedRule) throw new Error('周期规则不存在');

        const rule = await tx.recurringRule.findUnique({
          where: { id: candidate.id },
        });
        if (!rule) throw new Error('周期规则不存在');

        if (!rule.isActive || rule.nextDueDate > now) {
          nextDue = rule.nextDueDate;
          return;
        }

        const ruleNeedsAccountKey = Boolean(rule.fromAccountId || rule.toAccountId);
        if (ruleNeedsAccountKey && !derivedKey) {
          throw new Error('会话密钥已过期，请退出重新登录后再自动记录');
        }

        nextDue = computeNextFutureDueDate(rule.nextDueDate, rule.frequency, rule.interval, now);

        if (rule.fromAccountId && derivedKey) {
          await adjustRecurringAssetBalance(
            tx,
            rule.fromAccountId,
            rule.userId,
            derivedKey,
            rule.amount.negated(),
          );
        }

        if (rule.toAccountId && derivedKey) {
          await adjustRecurringAssetBalance(
            tx,
            rule.toAccountId,
            rule.userId,
            derivedKey,
            rule.amount,
          );
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

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { nextDueDate: nextDue },
        });
        transactionCreated = true;
      });

      results.push({
        ruleId: candidate.id,
        name: candidate.name,
        success: true,
        nextDueDate: nextDue,
        skipped: !transactionCreated,
      });
    } catch (error: any) {
      results.push({ ruleId: candidate.id, name: candidate.name, success: false, error: error.message });
    }
  }

  // Revalidate all affected users
  const userIds = [...new Set(dueRules.map(r => r.userId))];
  for (const uid of userIds) {
    revalidateTag(`user-${uid}`, 'default');
  }

  return { success: true, data: results };
}

export async function processDueRecurring() {
  return processDueRecurringForUser();
}

export async function processMyDueRecurring() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录后再自动记录' };

  return processDueRecurringForUser({ userId, derivedKey });
}
