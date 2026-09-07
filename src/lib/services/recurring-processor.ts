import type { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { revalidateTag } from 'next/cache';
import { decryptValue, encryptValue } from '@/lib/crypto';
import { getUserKey } from '@/lib/key-cache';
import { prisma } from '@/lib/prisma';

type ProcessRecurringResult = {
  ruleId: string;
  name: string;
  success: boolean;
  error?: string;
  nextDueDate?: Date;
  skipped?: boolean;
};

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

type ProcessDueRecurringOptions = {
  userId?: string;
  derivedKey?: string | null;
};

async function processDueRecurring(options: ProcessDueRecurringOptions = {}) {
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
    } catch (error) {
      results.push({
        ruleId: candidate.id,
        name: candidate.name,
        success: false,
        error: error instanceof Error ? error.message : '周期任务处理失败',
      });
    }
  }

  const userIds = [...new Set(dueRules.map((rule) => rule.userId))];
  for (const userId of userIds) {
    revalidateTag(`user-${userId}`, 'default');
  }

  return { success: true, data: results };
}

export async function processAllDueRecurring() {
  return processDueRecurring();
}

export async function processDueRecurringForUser(userId: string, derivedKey: string) {
  return processDueRecurring({ userId, derivedKey });
}
