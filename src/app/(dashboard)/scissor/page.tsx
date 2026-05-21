import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTransactions } from '@/lib/actions/ledger';
import Decimal from 'decimal.js';

export default async function ScissorPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getTransactions();
  const transactions = (res.success ? res.data : []) ?? [];

  const byMonth: Record<
    string,
    { income: Decimal; expense: Decimal }
  > = {};

  for (const t of transactions) {
    const date = new Date(t.occurredAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { income: new Decimal(0), expense: new Decimal(0) };

    const amount = new Decimal(t.amount || 0);
    if (t.type === 'INCOME') {
      byMonth[key].income = byMonth[key].income.plus(amount);
    } else if (t.type === 'EXPENSE') {
      byMonth[key].expense = byMonth[key].expense.plus(amount);
    }
  }

  const months = Object.keys(byMonth).sort();

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum.plus(new Decimal(t.amount || 0)), new Decimal(0));

  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum.plus(new Decimal(t.amount || 0)), new Decimal(0));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-white">收支剪刀图</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-ledger-surface p-6">
          <p className="text-sm text-ledger-muted">总收入</p>
          <p className="mt-2 text-2xl font-semibold text-ledger-success">
            ¥{totalIncome.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-ledger-surface p-6">
          <p className="text-sm text-ledger-muted">总支出</p>
          <p className="mt-2 text-2xl font-semibold text-ledger-danger">
            ¥{totalExpense.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {months.map((month) => {
          const { income, expense } = byMonth[month];
          const max = Decimal.max(income, expense).toNumber() || 1;
          return (
            <div key={month} className="rounded-xl bg-ledger-surface p-4">
              <p className="mb-3 text-sm font-medium text-white">{month}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs text-ledger-muted">收入</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-ledger-bg">
                    <div
                      className="h-4 rounded-full bg-ledger-success"
                      style={{ width: `${(income.toNumber() / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm text-ledger-success">
                    ¥{income.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs text-ledger-muted">支出</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-ledger-bg">
                    <div
                      className="h-4 rounded-full bg-ledger-danger"
                      style={{ width: `${(expense.toNumber() / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm text-ledger-danger">
                    ¥{expense.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {months.length === 0 && (
        <p className="text-ledger-muted">暂无交易数据</p>
      )}
    </div>
  );
}
