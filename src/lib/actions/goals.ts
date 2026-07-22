'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserKey } from '@/lib/key-cache';
import { decryptValue, encryptValue } from '@/lib/crypto';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { isGoalDepositAccountCategory } from '@/lib/goal-deposit';

export async function getGoals() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
  });

  const data = goals.map((g) => ({
    id: g.id,
    userId: g.userId,
    name: g.name,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    assetId: g.assetId,
    deadline: g.deadline,
    icon: g.icon,
    color: g.color,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    asset: g.asset,
  }));

  return { success: true, data };
}

export async function createGoal(data: {
  name: string;
  targetAmount: string;
  currentAmount?: string;
  assetId?: string;
  deadline?: string;
  icon?: string;
  color?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const goal = await prisma.savingsGoal.create({
      data: {
        name: data.name,
        targetAmount: new Decimal(data.targetAmount),
        currentAmount: data.currentAmount ? new Decimal(data.currentAmount) : new Decimal(0),
        assetId: data.assetId || null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        icon: data.icon,
        color: data.color,
        userId,
      },
      include: { asset: true },
    });

    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        ...goal,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGoalProgress(id: string, currentAmount: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.savingsGoal.updateMany({
      where: { id, userId },
      data: { currentAmount: new Decimal(currentAmount) },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

type AddGoalSavingsResult =
  | { success: true; transactionId: string; currentAmount: number }
  | { success: false; error: string };

export async function addGoalSavings(data: {
  goalId: string;
  sourceAssetId?: string;
  amount: string;
}): Promise<AddGoalSavingsResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: '请先登录后再存入' };

  const derivedKey = session?.user?.derivedKey || await getUserKey(userId);
  if (!derivedKey) return { success: false, error: '会话密钥已过期，请退出重新登录' };

  try {
    const rawAmount = data.amount.trim();
    if (!rawAmount) return { success: false, error: '请选择或输入存入金额' };

    const amount = new Decimal(rawAmount);
    if (!amount.isFinite() || !amount.isPositive()) {
      return { success: false, error: '存入金额必须大于 0' };
    }
    if (amount.decimalPlaces() > 2) {
      return { success: false, error: '存入金额最多保留两位小数' };
    }
    const sourceAssetId = data.sourceAssetId?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const [goal] = await tx.$queryRaw<{
        id: string;
        name: string;
        assetId: string | null;
      }[]>`
        SELECT id, name, asset_id as "assetId"
        FROM "SavingsGoal"
        WHERE id = ${data.goalId} AND user_id = ${userId}
        FOR UPDATE
      `;

      if (!goal) throw new Error('储蓄目标不存在');
      if (!goal.assetId) throw new Error('请先为这个目标关联一个储蓄账户');
      if (sourceAssetId === goal.assetId) throw new Error('转出账户不能与目标账户相同');

      const lockedAssets = await tx.$queryRaw<{
        id: string;
        name: string;
        category: string;
        balance: string;
        currency: string;
      }[]>`
        SELECT id, name, category, balance, currency
        FROM "Asset"
        WHERE user_id = ${userId}
          AND (id = ${sourceAssetId} OR id = ${goal.assetId})
        ORDER BY id
        FOR UPDATE
      `;
      const sourceAsset = sourceAssetId
        ? lockedAssets.find((asset) => asset.id === sourceAssetId)
        : null;
      const targetAsset = lockedAssets.find((asset) => asset.id === goal.assetId);

      if (sourceAssetId && !sourceAsset) throw new Error('转出账户不存在');
      if (!targetAsset) throw new Error('目标账户不存在，请重新关联');
      if (sourceAsset && !isGoalDepositAccountCategory(sourceAsset.category)) {
        throw new Error('请选择现金或银行活期账户作为转出账户');
      }
      if (!isGoalDepositAccountCategory(targetAsset.category)) {
        throw new Error('目标需关联现金或银行活期账户后才能直接存入');
      }
      if (sourceAsset && sourceAsset.currency.toUpperCase() !== targetAsset.currency.toUpperCase()) {
        throw new Error('转出账户与目标账户币种不同');
      }

      const targetBalance = new Decimal(decryptValue(targetAsset.balance, derivedKey, userId));
      if (sourceAsset) {
        const sourceBalance = new Decimal(decryptValue(sourceAsset.balance, derivedKey, userId));
        if (sourceBalance.lt(amount)) throw new Error(`${sourceAsset.name}余额不足`);
        await tx.asset.update({
          where: { id: sourceAsset.id },
          data: {
            balance: encryptValue(sourceBalance.minus(amount).toFixed(4), derivedKey, userId),
            isEncrypted: true,
          },
        });
      }
      await tx.asset.update({
        where: { id: targetAsset.id },
        data: {
          balance: encryptValue(targetBalance.plus(amount).toFixed(4), derivedKey, userId),
          isEncrypted: true,
        },
      });

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: { increment: amount } },
        select: { currentAmount: true },
      });
      const transaction = await tx.transaction.create({
        data: {
          type: 'TRANSFER',
          amount,
          currency: targetAsset.currency,
          fromAccountId: sourceAsset?.id || null,
          toAccountId: targetAsset.id,
          description: `存入储蓄目标 · ${goal.name}`,
          occurredAt: new Date(),
          userId,
        },
        select: { id: true },
      });

      return {
        transactionId: transaction.id,
        currentAmount: Number(updatedGoal.currentAmount),
      };
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, ...result };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '存入失败，请稍后重试',
    };
  }
}

export async function updateGoal(
  id: string,
  data: Partial<{
    name: string;
    targetAmount: string;
    currentAmount: string;
    assetId: string;
    deadline: string;
    icon: string;
    color: string;
  }>
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const updateData: {
      name?: string;
      targetAmount?: Decimal;
      currentAmount?: Decimal;
      assetId?: string | null;
      deadline?: Date | null;
      icon?: string | null;
      color?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.targetAmount !== undefined) updateData.targetAmount = new Decimal(data.targetAmount);
    if (data.currentAmount !== undefined) updateData.currentAmount = new Decimal(data.currentAmount);
    if (data.assetId !== undefined) updateData.assetId = data.assetId || null;
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.icon !== undefined) updateData.icon = data.icon || null;
    if (data.color !== undefined) updateData.color = data.color || null;

    await prisma.savingsGoal.updateMany({
      where: { id, userId },
      data: updateData,
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGoal(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.savingsGoal.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
