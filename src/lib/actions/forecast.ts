'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import { fetchForexRates } from '@/lib/services/price/sources/forex';

type CashflowMonth = {
  month: string;
  projectedIncome: string;
  projectedExpense: string;
  projectedSurplus: string;
  cumulativeSurplus: string;
};

export async function simulateCashflow(data: {
  monthlyIncome: string;
  monthlyExpense: string;
  months?: number;
  incomeAdjustment?: number;
  oneOffExpenses?: { month: number; amount: string }[];
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

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

    const oneOff = (data.oneOffExpenses || []).find((e) => e.month === i + 1);
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
    ? result.reduce((sum, m) => sum.plus(new Decimal(m.projectedSurplus)), new Decimal(0)).div(months).div(baseIncome)
    : new Decimal(0);

  let warningLevel: 'green' | 'yellow' | 'red' = 'green';
  if (avgSurplusRate.lt(0.1)) warningLevel = 'red';
  else if (avgSurplusRate.lt(0.2)) warningLevel = 'yellow';

  return { success: true, data: { months: result, warningLevel } };
}

/**
 * Auto-derive monthly income/expense from recent transaction history.
 */
export async function getAutoForecast(_months: number = 12) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  void _months;
  const forexRatesPromise = fetchForexRates();
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

  // Calculate monthly averages
  const monthSet = new Set<string>();
  for (const tx of recentTxs) {
    const m = `${tx.occurredAt.getFullYear()}-${tx.occurredAt.getMonth()}`;
    monthSet.add(m);
    if (tx.type === 'INCOME') totalIncome = totalIncome.plus(tx.amount);
    else totalExpense = totalExpense.plus(tx.amount);
  }

  const activeMonths = Math.max(monthSet.size, 1);
  const avgIncome = totalIncome.div(activeMonths);
  const avgExpense = totalExpense.div(activeMonths);

  // Use averages if available, otherwise default to 20000/15000
  const monthlyIncome = avgIncome.gt(0) ? avgIncome.toFixed(2) : '20000';
  const monthlyExpense = avgExpense.gt(0) ? avgExpense.toFixed(2) : '15000';

  // Detect recurring transactions (same amount, same category, multiple occurrences)
  const descCounts = new Map<string, { count: number; amount: Decimal }>();
  for (const tx of recentTxs) {
    if (tx.type === 'EXPENSE') {
      const amt = tx.amount.toString();
      const key = amt; // group by exact amount
      const existing = descCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        descCounts.set(key, { count: 1, amount: tx.amount });
      }
    }
  }

  const recurring = Array.from(descCounts.entries())
    .filter(([, v]) => v.count >= 3) // appeared 3+ times in last 3 months
    .map(([, v]) => ({ amount: v.amount.toFixed(2), occurrences: v.count }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);
  const forexRates = await forexRatesPromise;

  return {
    success: true,
    forexRates,
    data: {
      monthlyIncome,
      monthlyExpense,
      activeMonths,
      recurringExpenses: recurring,
    },
  };
}
