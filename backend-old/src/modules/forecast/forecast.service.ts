import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

export interface CashflowInput {
  monthlyIncome: Decimal;
  monthlyExpense: Decimal;
  essentialExpense?: Decimal;
  months?: number;
  incomeAdjustment?: number;
  oneOffExpenses?: { month: number; amount: Decimal }[];
}

export interface CashflowMonth {
  month: string;
  projectedIncome: Decimal;
  projectedExpense: Decimal;
  projectedSurplus: Decimal;
  cumulativeSurplus: Decimal;
}

export interface CashflowForecast {
  months: CashflowMonth[];
  runwayMonths: number;
  minSurplusMonth: string;
  warningLevel: 'green' | 'yellow' | 'red';
}

@Injectable()
export class ForecastService {
  calculateWACR(liabilities: { balance: Decimal; rate: Decimal }[]): Decimal {
    let totalBalance = new Decimal(0);
    let weightedRate = new Decimal(0);
    for (const l of liabilities) {
      totalBalance = totalBalance.plus(l.balance);
      weightedRate = weightedRate.plus(l.balance.mul(l.rate));
    }
    if (totalBalance.isZero()) return new Decimal(0);
    return weightedRate.div(totalBalance);
  }

  simulateCashflow(input: CashflowInput): CashflowForecast {
    const months = input.months || 12;
    const incomeAdj = 1 + (input.incomeAdjustment || 0);
    const baseIncome = input.monthlyIncome.mul(incomeAdj);
    const baseExpense = input.monthlyExpense;
    const now = new Date();
    const result: CashflowMonth[] = [];
    let cumulative = new Decimal(0);
    let minSurplus = new Decimal(Infinity);
    let minSurplusMonth = '';

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      let income = baseIncome;
      let expense = baseExpense;
      const oneOff = (input.oneOffExpenses || []).find((e) => e.month === i + 1);
      if (oneOff) expense = expense.plus(oneOff.amount);
      const surplus = income.minus(expense);
      cumulative = cumulative.plus(surplus);
      result.push({ month: monthKey, projectedIncome: income, projectedExpense: expense, projectedSurplus: surplus, cumulativeSurplus: cumulative });
      if (surplus.lt(minSurplus)) { minSurplus = surplus; minSurplusMonth = monthKey; }
    }

    const avgSurplusRate = baseIncome.gt(0)
      ? result.reduce((sum, m) => sum.plus(m.projectedSurplus), new Decimal(0)).div(months).div(baseIncome)
      : new Decimal(0);
    let warningLevel: 'green' | 'yellow' | 'red' = 'green';
    if (avgSurplusRate.lt(0.1)) warningLevel = 'red';
    else if (avgSurplusRate.lt(0.2)) warningLevel = 'yellow';
    const runwayMonths = this.calculateRunway(result);
    return { months: result, runwayMonths, minSurplusMonth, warningLevel };
  }

  private calculateRunway(months: CashflowMonth[]): number {
    for (let i = 0; i < months.length; i++) {
      if (months[i].cumulativeSurplus.lt(0)) return i;
    }
    return months.length;
  }
}
