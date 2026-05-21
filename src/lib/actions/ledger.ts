'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';

export async function getTransactions() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: {
      category: true,
      fromAsset: true,
      toAsset: true,
      liability: true,
    },
    orderBy: { occurredAt: 'desc' },
  });

  const decrypted = transactions.map((t) => ({
    ...t,
    amount: t.amount.toFixed(4),
    fromAsset: t.fromAsset
      ? {
          ...t.fromAsset,
          balance: decryptValue(t.fromAsset.balance, derivedKey, userId),
          costPrice: t.fromAsset.costPrice
            ? decryptValue(t.fromAsset.costPrice, derivedKey, userId)
            : null,
        }
      : null,
    toAsset: t.toAsset
      ? {
          ...t.toAsset,
          balance: decryptValue(t.toAsset.balance, derivedKey, userId),
          costPrice: t.toAsset.costPrice
            ? decryptValue(t.toAsset.costPrice, derivedKey, userId)
            : null,
        }
      : null,
    liability: t.liability
      ? {
          ...t.liability,
          principal: decryptValue(t.liability.principal, derivedKey, userId),
          currentBalance: decryptValue(
            t.liability.currentBalance,
            derivedKey,
            userId,
          ),
          monthlyPayment: t.liability.monthlyPayment
            ? decryptValue(t.liability.monthlyPayment, derivedKey, userId)
            : null,
        }
      : null,
  }));

  return { success: true, data: decrypted };
}

export async function createTransaction(data: {
  type: string;
  amount: string;
  categoryId?: string;
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

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  const amount = new Decimal(data.amount);

  try {
    await prisma.$transaction(async (tx) => {
      if (data.type === 'EXPENSE' && data.fromAccountId) {
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

      if (data.type === 'INCOME' && data.toAccountId) {
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

      if (data.type === 'TRANSFER') {
        if (!data.fromAccountId || !data.toAccountId) {
          throw new Error('TRANSFER requires both from and to accounts');
        }

        const [fromAsset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${data.fromAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        const [toAsset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${data.toAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!fromAsset) throw new Error('Source asset not found');
        if (!toAsset) throw new Error('Target asset not found');

        const fromBalance = new Decimal(
          decryptValue(fromAsset.balance, derivedKey, userId),
        );
        const toBalance = new Decimal(
          decryptValue(toAsset.balance, derivedKey, userId),
        );

        const newFromBalance = fromBalance.minus(amount);
        if (newFromBalance.isNegative()) {
          throw new Error('Insufficient balance');
        }
        const newToBalance = toBalance.plus(amount);

        await tx.asset.update({
          where: { id: fromAsset.id },
          data: {
            balance: encryptValue(
              newFromBalance.toFixed(4),
              derivedKey,
              userId,
            ),
            isEncrypted: true,
          },
        });
        await tx.asset.update({
          where: { id: toAsset.id },
          data: {
            balance: encryptValue(
              newToBalance.toFixed(4),
              derivedKey,
              userId,
            ),
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
          categoryId: data.categoryId || null,
          fromAccountId: data.fromAccountId || null,
          toAccountId: data.toAccountId || null,
          liabilityId: data.liabilityId || null,
          description: data.description,
          occurredAt: new Date(data.occurredAt),
          isEssential: data.isEssential ?? false,
          userId,
        },
      });
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTransaction(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const derivedKey = await getUserKey(userId);
  if (!derivedKey) return { success: false, error: 'Session expired' };

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) return { success: false, error: 'Transaction not found' };

    const amount = existing.amount;

    await prisma.$transaction(async (tx) => {
      if (existing.type === 'EXPENSE' && existing.fromAccountId) {
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

      if (existing.type === 'INCOME' && existing.toAccountId) {
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
          throw new Error('Insufficient balance to reverse income');
        }

        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: encryptValue(newBalance.toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }

      if (existing.type === 'TRANSFER') {
        if (!existing.fromAccountId || !existing.toAccountId) {
          throw new Error('TRANSFER requires both from and to accounts');
        }

        const [fromAsset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${existing.fromAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        const [toAsset] = await tx.$queryRaw<
          { id: string; balance: string }[]
        >`
          SELECT id, balance FROM "Asset"
          WHERE id = ${existing.toAccountId} AND user_id = ${userId}
          FOR UPDATE
        `;
        if (!fromAsset) throw new Error('Source asset not found');
        if (!toAsset) throw new Error('Target asset not found');

        const fromBalance = new Decimal(
          decryptValue(fromAsset.balance, derivedKey, userId),
        );
        const toBalance = new Decimal(
          decryptValue(toAsset.balance, derivedKey, userId),
        );

        const newFromBalance = fromBalance.plus(amount);
        const newToBalance = toBalance.minus(amount);
        if (newToBalance.isNegative()) {
          throw new Error('Insufficient balance to reverse transfer');
        }

        await tx.asset.update({
          where: { id: fromAsset.id },
          data: {
            balance: encryptValue(
              newFromBalance.toFixed(4),
              derivedKey,
              userId,
            ),
            isEncrypted: true,
          },
        });
        await tx.asset.update({
          where: { id: toAsset.id },
          data: {
            balance: encryptValue(
              newToBalance.toFixed(4),
              derivedKey,
              userId,
            ),
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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
