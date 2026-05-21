import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { simulateCashflow } from '@/lib/actions/forecast';

export default async function ForecastPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await simulateCashflow({
    monthlyIncome: '20000',
    monthlyExpense: '15000',
    months: 12,
  });

  const data = res.success ? res.data : null;
  const months = data?.months || [];
  const warningLevel = data?.warningLevel || 'green';

  const warningColor =
    warningLevel === 'red'
      ? 'text-ledger-danger'
      : warningLevel === 'yellow'
        ? 'text-ledger-warning'
        : 'text-ledger-success';

  const warningLabel =
    warningLevel === 'red'
      ? '高风险'
      : warningLevel === 'yellow'
        ? '中等风险'
        : '健康';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-white">现金流预测</h1>

      <div className="mb-6 rounded-xl bg-ledger-surface p-6">
        <p className="text-sm text-ledger-muted">风险等级</p>
        <p className={`mt-2 text-3xl font-bold ${warningColor}`}>
          {warningLabel}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-ledger-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-ledger-bg text-ledger-muted">
            <tr>
              <th className="px-4 py-3 font-medium">月份</th>
              <th className="px-4 py-3 font-medium text-right">预计收入</th>
              <th className="px-4 py-3 font-medium text-right">预计支出</th>
              <th className="px-4 py-3 font-medium text-right">盈余</th>
              <th className="px-4 py-3 font-medium text-right">累计盈余</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ledger-bg">
            {months.map((m) => {
              const surplus = parseFloat(m.projectedSurplus);
              return (
                <tr key={m.month} className="hover:bg-ledger-bg/50">
                  <td className="px-4 py-3 text-white">{m.month}</td>
                  <td className="px-4 py-3 text-right text-ledger-success">
                    ¥{m.projectedIncome}
                  </td>
                  <td className="px-4 py-3 text-right text-ledger-danger">
                    ¥{m.projectedExpense}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      surplus >= 0 ? 'text-ledger-success' : 'text-ledger-danger'
                    }`}
                  >
                    ¥{m.projectedSurplus}
                  </td>
                  <td className="px-4 py-3 text-right text-ledger-accent">
                    ¥{m.cumulativeSurplus}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {months.length === 0 && (
        <p className="mt-4 text-ledger-muted">暂无预测数据</p>
      )}
    </div>
  );
}
