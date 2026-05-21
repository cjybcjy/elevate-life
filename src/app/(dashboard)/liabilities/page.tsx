import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getLiabilities } from '@/lib/actions/liabilities';
import Decimal from 'decimal.js';

export default async function LiabilitiesPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getLiabilities();
  const liabilities = (res.success ? res.data : []) ?? [];

  const totalDebt = liabilities.reduce(
    (sum, l) => sum.plus(new Decimal(l.currentBalance || 0)),
    new Decimal(0),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-white">负债分析</h1>

      <div className="mb-6 rounded-xl bg-ledger-surface p-6">
        <p className="text-sm text-ledger-muted">总负债</p>
        <p className="mt-2 text-3xl font-bold text-ledger-danger">
          ¥{totalDebt.toFixed(2)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liabilities.map((l) => (
          <div
            key={l.id}
            className="rounded-lg bg-ledger-surface p-4 border border-ledger-bg"
          >
            <p className="font-medium text-white">{l.name}</p>
            <p className="mt-1 text-sm text-ledger-muted">{l.category}</p>
            <p className="mt-2 text-lg font-semibold text-ledger-danger">
              ¥{new Decimal(l.currentBalance || 0).toFixed(2)}
            </p>
            <div className="mt-2 flex gap-3 text-xs text-ledger-muted">
              <span>利率: {l.interestRate?.toString?.() ?? l.interestRate}%</span>
              <span>期限: {l.termMonths} 个月</span>
            </div>
            {l.monthlyPayment && (
              <p className="mt-1 text-xs text-ledger-muted">
                月供: ¥{new Decimal(l.monthlyPayment).toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>

      {liabilities.length === 0 && (
        <p className="mt-4 text-ledger-muted">暂无负债数据</p>
      )}
    </div>
  );
}
