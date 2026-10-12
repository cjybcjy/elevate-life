interface CashflowTransaction {
  type: string;
  occurredAt: string | Date;
  amount?: string | number | null;
  currency?: string | null;
}

interface MonthlyCashflowOptions {
  transactions: readonly CashflowTransaction[];
  cnyRates: Readonly<Record<string, number>>;
  year: number;
  /** The final displayed month, from 1 to 12. */
  month: number;
}

/** Aggregate the last 12 months using the ledger's UTC timestamps and Beijing dates. */
export function buildDashboardMonthlyCashflow({
  transactions,
  cnyRates,
  year,
  month,
}: MonthlyCashflowOptions) {
  const firstMonth = year * 12 + month - 1 - 11;
  const months = Array.from({ length: 12 }, (_, index) => `${(firstMonth + index) % 12 + 1}月`);
  const incomeData = Array<number>(12).fill(0);
  const expenseData = Array<number>(12).fill(0);

  for (const transaction of transactions) {
    const income = transaction.type === 'INCOME' || transaction.type === 'income';
    const expense = transaction.type === 'EXPENSE' || transaction.type === 'expense';
    if (!income && !expense) continue;

    // Database timestamps without a zone are UTC, matching the existing ledger convention.
    const value = transaction.occurredAt;
    const timestamp = value instanceof Date
      ? value.getTime()
      : new Date(value.endsWith('Z') ? value : `${value}Z`).getTime();
    const beijingDate = new Date(timestamp + 8 * 3600_000);
    const index = beijingDate.getUTCFullYear() * 12 + beijingDate.getUTCMonth() - firstMonth;
    if (!Number.isFinite(index) || index < 0 || index >= 12) continue;

    const amount = parseFloat(String(transaction.amount || '0'))
      * (cnyRates[transaction.currency || 'CNY'] || 1);
    (income ? incomeData : expenseData)[index] += amount;
  }

  return { months, incomeData, expenseData };
}
