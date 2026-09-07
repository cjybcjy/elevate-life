'use server';

import { after } from 'next/server';
import Decimal from 'decimal.js';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCachedForexRates,
  refreshForexRates,
  type ForexRates,
} from '@/lib/services/price/sources/forex';

type CashflowMonth = {
  month: string;
  projectedIncome: string;
  projectedExpense: string;
  projectedSurplus: string;
  cumulativeSurplus: string;
};

type CashflowInput = {
  monthlyIncome: string;
  monthlyExpense: string;
  months?: number;
  incomeAdjustment?: number;
  oneOffExpenses?: { month: number; amount: string }[];
};

type AutoForecastData = {
  monthlyIncome: string;
  monthlyExpense: string;
  activeMonths: number;
  recurringExpenses: { amount: string; occurrences: number }[];
};

function buildCashflow(data: CashflowInput) {
  const months = data.months || 12;
  const incomeAdj = 1 + (data.incomeAdjustment || 0);
  const baseIncome = new Decimal(data.monthlyIncome).mul(incomeAdj);
  const baseExpense = new Decimal(data.monthlyExpense);

  const result: CashflowMonth[] = [];
  let cumulative = new Decimal(0);
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const income = baseIncome;
    let expense = baseExpense;

    const oneOff = (data.oneOffExpenses || []).find((item) => item.month === i + 1);
    if (oneOff) expense = expense.plus(new Decimal(oneOff.amount));

    const surplus = income.minus(expense);
    cumulative = cumulative.plus(surplus);

    result.push({
      month: monthKey,
      projectedIncome: income.toFixed(2),
      projectedExpense: expense.toFixed(2),
      projectedSurplus: surplus.toFixed(2),
      cumulativeSurplus: cumulative.toFixed(2),
    });
  }

  const avgSurplusRate = baseIncome.gt(0)
    ? result.reduce((sum, month) => sum.plus(new Decimal(month.projectedSurplus)), new Decimal(0)).div(months).div(baseIncome)
    : new Decimal(0);

  let warningLevel: 'green' | 'yellow' | 'red' = 'green';
  if (avgSurplusRate.lt(0.1)) warningLevel = 'red';
  else if (avgSurplusRate.lt(0.2)) warningLevel = 'yellow';

  return { months: result, warningLevel };
}

function scheduleForexRefreshIfNeeded(stale: boolean) {
  if (!stale) return;

  after(async () => {
    try {
      await refreshForexRates();
    } catch {
      // The current response already has cached/fallback rates. A later request
      // can retry without turning an upstream quote failure into UI latency.
    }
  });
}

async function loadAutoForecast(userId: string): Promise<{
  data: AutoForecastData;
  forexRates: ForexRates;
}> {
  const forexSnapshot = getCachedForexRates();
  scheduleForexRefreshIfNeeded(forexSnapshot.stale);

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recentTxs = await prisma.transaction.findMany({
    where: {
      userId,
      occurredAt: { gte: threeMonthsAgo },
      type: { in: ['INCOME', 'EXPENSE'] },
    },
    select: { type: true, amount: true, occurredAt: true },
  });

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  const monthSet = new Set<string>();

  for (const tx of recentTxs) {
    monthSet.add(`${tx.occurredAt.getFullYear()}-${tx.occurredAt.getMonth()}`);
    if (tx.type === 'INCOME') totalIncome = totalIncome.plus(tx.amount);
    else totalExpense = totalExpense.plus(tx.amount);
  }

  const activeMonths = Math.max(monthSet.size, 1);
  const avgIncome = totalIncome.div(activeMonths);
  const avgExpense = totalExpense.div(activeMonths);
  const monthlyIncome = avgIncome.gt(0) ? avgIncome.toFixed(2) : '20000';
  const monthlyExpense = avgExpense.gt(0) ? avgExpense.toFixed(2) : '15000';

  const recurringCounts = new Map<string, { count: number; amount: Decimal }>();
  for (const tx of recentTxs) {
    if (tx.type !== 'EXPENSE') continue;
    const key = tx.amount.toString();
    const existing = recurringCounts.get(key);
    if (existing) existing.count += 1;
    else recurringCounts.set(key, { count: 1, amount: tx.amount });
  }

  const recurringExpenses = Array.from(recurringCounts.values())
    .filter((entry) => entry.count >= 3)
    .map((entry) => ({ amount: entry.amount.toFixed(2), occurrences: entry.count }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  return {
    forexRates: forexSnapshot.rates,
    data: {
      monthlyIncome,
      monthlyExpense,
      activeMonths,
      recurringExpenses,
    },
  };
}

export async function simulateCashflow(data: CashflowInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  return { success: true, data: buildCashflow(data) };
}

/** Auto-derive monthly income/expense from recent transaction history. */
export async function getAutoForecast(_months: number = 12) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  void _months;
  const result = await loadAutoForecast(userId);
  return { success: true, ...result };
}

/**
 * Dashboard read model for forecast data. It authenticates once and calculates
 * the projection in-process, avoiding the prior two-Server-Action waterfall.
 */
export async function getForecastSnapshot(months: number = 12) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const autoForecast = await loadAutoForecast(userId);
  const forecast = buildCashflow({
    monthlyIncome: autoForecast.data.monthlyIncome,
    monthlyExpense: autoForecast.data.monthlyExpense,
    months,
  });

  return {
    success: true,
    data: {
      autoForecast: autoForecast.data,
      forecast,
      forexRates: autoForecast.forexRates,
    },
  };
}
