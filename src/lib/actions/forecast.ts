'use server';
import { auth } from '@/lib/auth';
import Decimal from 'decimal.js';

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

  const result: any[] = [];
  let cumulative = new Decimal(0);
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    let income = baseIncome;
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
