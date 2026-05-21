import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import Decimal from 'decimal.js';

export default async function NetWorthPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [assetsRes, liabilitiesRes] = await Promise.all([
    getAssets(),
    getLiabilities(),
  ]);

  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];
  const liabilities = (liabilitiesRes.success ? liabilitiesRes.data : []) ?? [];

  const totalAssets = assets.reduce(
    (sum, a) => sum.plus(new Decimal(a.balance || 0)),
    new Decimal(0),
  );

  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum.plus(new Decimal(l.currentBalance || 0)),
    new Decimal(0),
  );

  const netWorth = totalAssets.minus(totalLiabilities);

  const assetPercent = totalAssets.plus(totalLiabilities).gt(0)
    ? totalAssets.div(totalAssets.plus(totalLiabilities)).mul(100).toNumber()
    : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-white">净资产概览</h1>

      <div className="mb-8 rounded-xl bg-ledger-surface p-6 text-center">
        <p className="text-sm text-ledger-muted">净资产</p>
        <p
          className={`mt-2 text-4xl font-bold ${
            netWorth.gte(0) ? 'text-ledger-success' : 'text-ledger-danger'
          }`}
        >
          ¥{netWorth.toFixed(2)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-ledger-surface p-6">
          <p className="text-sm text-ledger-muted">总资产</p>
          <p className="mt-2 text-2xl font-semibold text-ledger-success">
            ¥{totalAssets.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-ledger-surface p-6">
          <p className="text-sm text-ledger-muted">总负债</p>
          <p className="mt-2 text-2xl font-semibold text-ledger-danger">
            ¥{totalLiabilities.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-ledger-surface p-6">
        <p className="mb-4 text-sm font-medium text-white">资产 vs 负债</p>
        <div className="flex h-8 w-full overflow-hidden rounded-full bg-ledger-bg">
          <div
            className="flex items-center justify-center bg-ledger-success text-xs font-medium text-white"
            style={{ width: `${Math.min(assetPercent, 100)}%` }}
          >
            {assetPercent > 10 ? `资产 ${assetPercent.toFixed(1)}%` : ''}
          </div>
          <div className="flex flex-1 items-center justify-center bg-ledger-danger text-xs font-medium text-white">
            {assetPercent < 90
              ? `负债 ${(100 - assetPercent).toFixed(1)}%`
              : ''}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-ledger-muted">
          <span>资产占比: {assetPercent.toFixed(1)}%</span>
          <span>负债占比: {(100 - assetPercent).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
