import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets } from '@/lib/actions/assets';
import Decimal from 'decimal.js';

export default async function AssetsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getAssets();
  const assets = (res.success ? res.data : []) ?? [];

  const byCategory: Record<string, typeof assets> = {};
  for (const a of assets) {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }

  const categoryTotals = Object.entries(byCategory).map(([category, items]) => {
    const total = items.reduce(
      (sum, a) => sum.plus(new Decimal(a.balance || 0)),
      new Decimal(0),
    );
    return { category, total, items };
  });

  const grandTotal = assets.reduce(
    (sum, a) => sum.plus(new Decimal(a.balance || 0)),
    new Decimal(0),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-white">资产配置</h1>

      <div className="mb-6 rounded-xl bg-ledger-surface p-6">
        <p className="text-sm text-ledger-muted">资产总计</p>
        <p className="mt-2 text-3xl font-bold text-ledger-success">
          ¥{grandTotal.toFixed(2)}
        </p>
      </div>

      <div className="space-y-8">
        {categoryTotals.map(({ category, total, items }) => (
          <div key={category}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{category}</h2>
              <span className="text-sm font-medium text-ledger-accent">
                ¥{total.toFixed(2)}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-ledger-surface p-4 border border-ledger-bg"
                >
                  <p className="font-medium text-white">{a.name}</p>
                  <p className="mt-1 text-sm text-ledger-muted">
                    {a.currency || 'CNY'}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-ledger-success">
                    ¥{new Decimal(a.balance || 0).toFixed(2)}
                  </p>
                  {a.costPrice && (
                    <p className="mt-1 text-xs text-ledger-muted">
                      成本价: ¥{new Decimal(a.costPrice).toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {assets.length === 0 && (
          <p className="text-ledger-muted">暂无资产数据</p>
        )}
      </div>
    </div>
  );
}
