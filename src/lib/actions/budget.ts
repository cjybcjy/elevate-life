'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidateTag } from 'next/cache';
import Decimal from 'decimal.js';
import { budgetIncludesExpense } from '@/lib/budget-progress';

function serializeBudget(b: any) {
  const result: any = {
    id: b.id, userId: b.userId, name: b.name,
    categoryId: b.categoryId,
    amount: b.amount.toFixed(4),
    startDate: b.startDate, endDate: b.endDate,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
    category: b.category ? {
      id: b.category.id, userId: b.category.userId,
      name: b.category.name, type: b.category.type,
      isEssential: b.category.isEssential,
      essentialRatio: b.category.essentialRatio.toNumber(),
      icon: b.category.icon, color: b.category.color,
      createdAt: b.category.createdAt, updatedAt: b.category.updatedAt,
    } : null,
  };
  return result;
}

export async function getBudgets(date?: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const where: any = { userId };
  if (date) {
    const targetDate = new Date(date);
    where.startDate = { lte: targetDate };
    where.endDate = { gte: targetDate };
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });

  const data = budgets.map(serializeBudget);
  return { success: true, data };
}

export async function createBudget(data: {
  name: string;
  categoryId?: string;
  amount: string;
  startDate: string;
  endDate: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const budget = await prisma.budget.create({
      data: {
        name: data.name,
        categoryId: data.categoryId || null,
        amount: new Decimal(data.amount),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        userId,
      },
      include: { category: true },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: serializeBudget(budget) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBudget(id: string, data: {
  name?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    await prisma.budget.updateMany({
      where: { id, userId },
      data: updateData,
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBudget(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.budget.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getBudgetProgress(date: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const targetDate = new Date(date);

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    include: { category: true },
  });

  if (budgets.length === 0) return { success: true, data: [] };

  // Get transactions within any budget's date range
  const allStarts = budgets.map(b => b.startDate.getTime());
  const allEnds = budgets.map(b => b.endDate.getTime());
  const minStart = new Date(Math.min(...allStarts));
  const maxEnd = new Date(Math.max(...allEnds));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      occurredAt: { gte: minStart, lte: maxEnd },
    },
    select: { budgetId: true, categoryId: true, amount: true, occurredAt: true },
  });

  const progress = budgets.map(b => {
    let spent = new Decimal(0);
    for (const t of transactions) {
      if (budgetIncludesExpense(b, t)) spent = spent.plus(t.amount);
    }

    const budgetAmount = Number(b.amount);
    const spentNum = spent.toNumber();
    const pct = budgetAmount > 0 ? (spentNum / budgetAmount * 100) : 0;

    return {
      id: b.id,
      name: b.name,
      categoryId: b.categoryId,
      categoryName: b.category?.name || '总计',
      categoryColor: b.category?.color || null,
      budgetAmount,
      spent: spentNum,
      remaining: budgetAmount - spentNum,
      pct: Math.min(pct, 100),
      isOverBudget: spentNum > budgetAmount,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
    };
  });

  return { success: true, data: progress };
}

export async function getBudgetsForCategory(date: string, categoryId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const targetDate = new Date(date);
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      categoryId,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  });

  return { success: true, data: budgets };
}
