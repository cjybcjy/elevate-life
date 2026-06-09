'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';

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
