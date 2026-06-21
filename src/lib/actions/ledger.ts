'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { autoCategorize } from './category-rules';
import type { Prisma } from '@prisma/client';
import { buildTransactionEffectDeltas } from '@/lib/transaction-effects';

type TransactionEffect = {
  amount: Decimal;
  fromAccountId: string | null;
  toAccountId: string | null;
  liabilityId: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

async function adjustAssetBalance(
  tx: Prisma.TransactionClient,
  assetId: string,
  userId: string,
  derivedKey: string,
  delta: Decimal,
  missingMessage: string,
  insufficientMessage: string,
) {
  const [asset] = await tx.$queryRaw<{ id: string; balance: string }[]>`
    SELECT id, balance FROM "Asset"
    WHERE id = ${assetId} AND user_id = ${userId}
    FOR UPDATE
  `;
  if (!asset) throw new Error(missingMessage);

  const currentBalance = new Decimal(
    decryptValue(asset.balance, derivedKey, userId),
  );
  const newBalance = currentBalance.plus(delta);
  if (newBalance.isNegative()) {
    throw new Error(insufficientMessage);
  }

  await tx.asset.update({
    where: { id: asset.id },
    data: {
      balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
      isEncrypted: true,
    },
  });
}

async function adjustLiabilityBalance(
  tx: Prisma.TransactionClient,
  liabilityId: string,
  userId: string,
  derivedKey: string,
  delta: Decimal,
) {
  const [liability] = await tx.$queryRaw<
    { id: string; currentBalance: string }[]
  >`
    SELECT id, current_balance as "currentBalance" FROM "Liability"
    WHERE id = ${liabilityId} AND user_id = ${userId}
    FOR UPDATE
  `;
  if (!liability) throw new Error('Liability not found');

  const currentBalance = new Decimal(
    decryptValue(liability.currentBalance, derivedKey, userId),
  );
  const newBalance = currentBalance.plus(delta);

  await tx.liability.update({
    where: { id: liability.id },
    data: {
      currentBalance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
      isEncrypted: true,
    },
  });
}

export async function getTransactions() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: {
      category: true,
      budget: { select: { id: true, name: true } },
      fromAsset: true,
      toAsset: true,
      liability: true,
    },
    orderBy: { occurredAt: 'desc' },
  });

  const decrypted = transactions.map((t) => ({
    id: t.id,
    userId: t.userId,
    type: t.type,
    amount: t.amount.toFixed(4),
    categoryId: t.categoryId,
    budgetId: t.budgetId,
    fromAccountId: t.fromAccountId,
    toAccountId: t.toAccountId,
    liabilityId: t.liabilityId,
    description: t.description,
    occurredAt: t.occurredAt,
    isEssential: t.isEssential,
    reconciled: t.reconciled,
    currency: t.currency,
    createdAt: t.createdAt,
    budget: t.budget
      ? { id: t.budget.id, name: t.budget.name }
      : null,
    category: t.category
      ? {
          id: t.category.id,
          userId: t.category.userId,
          name: t.category.name,
          type: t.category.type,
          isEssential: t.category.isEssential,
          essentialRatio: t.category.essentialRatio.toNumber(),
          icon: t.category.icon,
          color: t.category.color,
          createdAt: t.category.createdAt,
          updatedAt: t.category.updatedAt,
        }
      : null,
    fromAsset: t.fromAsset
      ? {
          id: t.fromAsset.id,
          name: t.fromAsset.name,
          category: t.fromAsset.category,
          balance: decryptValue(t.fromAsset.balance, derivedKey, userId),
          currency: t.fromAsset.currency,
          liquidityTier: t.fromAsset.liquidityTier,
          isEncrypted: t.fromAsset.isEncrypted,
          costPrice: t.fromAsset.costPrice
            ? decryptValue(t.fromAsset.costPrice, derivedKey, userId)
            : null,
          quantity: t.fromAsset.quantity ? Number(t.fromAsset.quantity) : null,
          stockCode: t.fromAsset.stockCode,
          market: t.fromAsset.market,
          costUnitPrice: t.fromAsset.costUnitPrice ? Number(t.fromAsset.costUnitPrice) : null,
          createdAt: t.fromAsset.createdAt,
          updatedAt: t.fromAsset.updatedAt,
        }
      : null,
    toAsset: t.toAsset
      ? {
          id: t.toAsset.id,
          name: t.toAsset.name,
          category: t.toAsset.category,
          balance: decryptValue(t.toAsset.balance, derivedKey, userId),
          currency: t.toAsset.currency,
          liquidityTier: t.toAsset.liquidityTier,
          isEncrypted: t.toAsset.isEncrypted,
          costPrice: t.toAsset.costPrice
            ? decryptValue(t.toAsset.costPrice, derivedKey, userId)
            : null,
          quantity: t.toAsset.quantity ? Number(t.toAsset.quantity) : null,
          stockCode: t.toAsset.stockCode,
          market: t.toAsset.market,
          costUnitPrice: t.toAsset.costUnitPrice ? Number(t.toAsset.costUnitPrice) : null,
          createdAt: t.toAsset.createdAt,
          updatedAt: t.toAsset.updatedAt,
        }
      : null,
    liability: t.liability
      ? {
          id: t.liability.id,
          name: t.liability.name,
          category: t.liability.category,
          principal: decryptValue(t.liability.principal, derivedKey, userId),
          currentBalance: decryptValue(t.liability.currentBalance, derivedKey, userId),
          interestRate: t.liability.interestRate.toNumber(),
          termMonths: t.liability.termMonths,
          startDate: t.liability.startDate,
          paymentMethod: t.liability.paymentMethod,
          monthlyPayment: t.liability.monthlyPayment
            ? decryptValue(t.liability.monthlyPayment, derivedKey, userId)
            : null,
          isEncrypted: t.liability.isEncrypted,
          createdAt: t.liability.createdAt,
          updatedAt: t.liability.updatedAt,
        }
      : null,
  }));

  return { success: true, data: decrypted };
}

export async function createTransaction(data: {
  type: string;
  amount: string;
  currency?: string;
  categoryId?: string;
  budgetId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  liabilityId?: string;
  description?: string;
  occurredAt: string;
  isEssential?: boolean;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  const amount = new Decimal(data.amount);

  // Auto-categorize if no category provided but description is available
  let resolvedCategoryId = data.categoryId || undefined;
  if (!resolvedCategoryId && data.description) {
    const autoCat = await autoCategorize(userId, data.description);
    if (autoCat) resolvedCategoryId = autoCat;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Deduct from source account (if set)
      if (data.fromAccountId) {
        const [asset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${data.fromAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!asset) throw new Error('Source asset not found');

        const currentBalance = new Decimal(
          decryptValue(asset.balance, derivedKey, userId),
        );
        const newBalance = currentBalance.minus(amount);
        if (newBalance.isNegative()) {
          throw new Error('Insufficient balance');
        }

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }

      // Add to target account (if set)
      if (data.toAccountId) {
        const [asset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${data.toAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!asset) throw new Error('Target asset not found');

        const currentBalance = new Decimal(
          decryptValue(asset.balance, derivedKey, userId),
        );
        const newBalance = currentBalance.plus(amount);

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }

      if (data.liabilityId) {
        const [liability] = await tx.$queryRaw<
          { id: string; currentBalance: string }[]
        >`
          SELECT id, current_balance as "currentBalance" FROM "Liability"
          WHERE id = ${data.liabilityId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!liability) throw new Error('Liability not found');

        const currentBalance = new Decimal(
          decryptValue(liability.currentBalance, derivedKey, userId),
        );
        const newBalance = currentBalance.minus(amount);

        await tx.liability.update({
          where: { id: liability.id },
          data: {
            currentBalance: encryptValue(
              newBalance.toFixed(4),
              derivedKey,
              userId,
            ),
            isEncrypted: true,
          },
        });
      }

      await tx.transaction.create({
        data: {
          type: data.type,
          amount,
          categoryId: resolvedCategoryId || null,
          budgetId: data.budgetId || null,
          fromAccountId: data.fromAccountId || null,
          toAccountId: data.toAccountId || null,
          liabilityId: data.liabilityId || null,
          description: data.description,
          occurredAt: new Date(data.occurredAt),
          isEssential: data.isEssential ?? false,
          currency: data.currency || 'CNY',
          userId,
        },
      });
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateTransaction(
  id: string,
  data: Partial<{
    amount: string;
    categoryId: string | null;
    budgetId: string | null;
    fromAccountId: string | null;
    toAccountId: string | null;
    liabilityId: string | null;
    description: string;
    occurredAt: string;
  }>
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) throw new Error('Transaction not found');

      const nextAmount = data.amount !== undefined
        ? new Decimal(data.amount)
        : existing.amount;
      const nextEffect: TransactionEffect = {
        amount: nextAmount,
        fromAccountId: data.fromAccountId !== undefined
          ? data.fromAccountId || null
          : existing.fromAccountId,
        toAccountId: data.toAccountId !== undefined
          ? data.toAccountId || null
          : existing.toAccountId,
        liabilityId: data.liabilityId !== undefined
          ? data.liabilityId || null
          : existing.liabilityId,
      };

      const updateData: {
        amount?: Decimal;
        categoryId?: string | null;
        budgetId?: string | null;
        fromAccountId?: string | null;
        toAccountId?: string | null;
        liabilityId?: string | null;
        description?: string;
        occurredAt?: Date;
      } = {};
      if (data.amount !== undefined) updateData.amount = nextAmount;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
      if (data.budgetId !== undefined) updateData.budgetId = data.budgetId || null;
      if (data.fromAccountId !== undefined) updateData.fromAccountId = data.fromAccountId || null;
      if (data.toAccountId !== undefined) updateData.toAccountId = data.toAccountId || null;
      if (data.liabilityId !== undefined) updateData.liabilityId = data.liabilityId || null;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.occurredAt !== undefined) updateData.occurredAt = new Date(data.occurredAt);

      const effectsChanged =
        data.amount !== undefined ||
        data.fromAccountId !== undefined ||
        data.toAccountId !== undefined ||
        data.liabilityId !== undefined;

      if (effectsChanged) {
        const deltas = buildTransactionEffectDeltas(
          {
            amount: existing.amount,
            fromAccountId: existing.fromAccountId,
            toAccountId: existing.toAccountId,
            liabilityId: existing.liabilityId,
          },
          nextEffect,
        );

        for (const delta of deltas.assetDeltas) {
          await adjustAssetBalance(
            tx,
            delta.id,
            userId,
            derivedKey,
            delta.delta,
            'Asset not found',
            'Insufficient balance',
          );
        }

        for (const delta of deltas.liabilityDeltas) {
          await adjustLiabilityBalance(tx, delta.id, userId, derivedKey, delta.delta);
        }
      }

      await tx.transaction.updateMany({
        where: { id, userId },
        data: updateData,
      });
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateTransactionReconciled(id: string, reconciled: boolean) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.transaction.updateMany({
      where: { id, userId },
      data: { reconciled },
    });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteTransaction(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) return { success: false, error: 'Transaction not found' };

    const amount = existing.amount;

    await prisma.$transaction(async (tx) => {
      // Reverse: add back to source account (if set)
      if (existing.fromAccountId) {
        const [asset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${existing.fromAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!asset) throw new Error('Source asset not found');

        const currentBalance = new Decimal(
          decryptValue(asset.balance, derivedKey, userId),
        );
        const newBalance = currentBalance.plus(amount);

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }

      // Reverse: deduct from target account (if set)
      if (existing.toAccountId) {
        const [asset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${existing.toAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!asset) throw new Error('Target asset not found');

        const currentBalance = new Decimal(
          decryptValue(asset.balance, derivedKey, userId),
        );
        const newBalance = currentBalance.minus(amount);
        if (newBalance.isNegative()) {
          throw new Error('Insufficient balance to reverse');
        }

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }

      if (existing.liabilityId) {
        const [liability] = await tx.$queryRaw<
          { id: string; currentBalance: string }[]
        >`
          SELECT id, current_balance as "currentBalance" FROM "Liability"
          WHERE id = ${existing.liabilityId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!liability) throw new Error('Liability not found');

        const currentBalance = new Decimal(
          decryptValue(liability.currentBalance, derivedKey, userId),
        );
        const newBalance = currentBalance.plus(amount);

        await tx.liability.update({
          where: { id: liability.id },
          data: {
            currentBalance: encryptValue(
              newBalance.toFixed(4),
              derivedKey,
              userId,
            ),
            isEncrypted: true,
          },
        });
      }

      await tx.transaction.delete({
        where: { id: existing.id },
      });
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}
