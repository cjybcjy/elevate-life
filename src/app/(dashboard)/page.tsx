export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { simulateCashflow } from '@/lib/actions/forecast';
import Decimal from 'decimal.js';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import AssetRingChart from '@/components/charts/AssetRingChart';
import DebtFunnelChart from '@/components/charts/DebtFunnelChart';
import ScissorChart from '@/components/charts/ScissorChart';
import CashflowForecastChart from '@/components/charts/CashflowForecastChart';
import StockTable from '@/components/widgets/StockTable';
import LiabilityCards from '@/components/widgets/LiabilityCards';
import AssetCards from '@/components/widgets/AssetCards';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  gold_physical: { icon: '🟡', color: '#f59e0b', label: '实物黄金' },
  gold_paper: { icon: '📄', color: '#eab308', label: '纸黄金' },
  stock: { icon: '📈', color: '#ef4444', label: '股票' },
  fund: { icon: '📊', color: '#8b5cf6', label: '基金' },
  bond: { icon: '📜', color: '#06b6d4', label: '债券' },
  vehicle: { icon: '🚗', color: '#f97316', label: '车辆' },
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [assetsRes, liabilitiesRes, transactionsRes, forecastRes] = await Promise.all([
    getAssets(), getLiabilities(), getTransactions(),
    simulateCashflow({ monthlyIncome: '20000', monthlyExpense: '15000', months: 12 }),
  ]);

  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];
  const liabilities = (liabilitiesRes.success ? liabilitiesRes.data : []) ?? [];
  const transactions = (transactionsRes.success ? transactionsRes.data : []) ?? [];
  const forecast = forecastRes.success ? forecastRes.data! : { months: [], warningLevel: 'green' };

  const totalAssets = assets.reduce((sum, a: any) => sum.plus(new Decimal(a.balance || 0)), new Decimal(0));
  const totalLiabilities = liabilities.reduce((sum, l) => sum.plus(new Decimal(l.currentBalance || 0)), new Decimal(0));
  const netWorth = totalAssets.minus(totalLiabilities).toNumber();
  const surplusRate = totalAssets.gt(0) ? netWorth / totalAssets.toNumber() * 100 : 0;

  const stocks = assets.filter((a: any) => a.category === 'stock');
  const pricesStale = (assetsRes as any).pricesStale ?? false;

  // Asset ring chart data
  const catTotals: Record<string, number> = {};
  for (const a of assets) {
    const v = parseFloat(a.balance || '0');
    catTotals[a.category || 'other'] = (catTotals[a.category || 'other'] || 0) + v;
  }
  const ringData = Object.entries(catTotals)
    .map(([cat, value]) => ({ name: categoryConfig[cat]?.label || cat, value, itemStyle: { color: categoryConfig[cat]?.color || '#94a3b8' } }))
    .sort((a, b) => b.value - a.value);

  // Liability funnel data
  const funnelData = liabilities.map((l: any) => ({ name: l.name, value: parseFloat(l.currentBalance) || 0, rate: l.interestRate * 100 }));
  const wacr = liabilities.length > 0 ? liabilities.reduce((sum: number, l: any) => sum + (parseFloat(l.currentBalance) || 0) * l.interestRate, 0) / (totalLiabilities.toNumber() || 1) : 0;

  // Scissor chart data
  const now = new Date();
  const months: string[] = [], incomeData: number[] = [], expenseData: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    const mi = transactions.filter((t: any) => { const td = new Date(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
    const me = transactions.filter((t: any) => { const td = new Date(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
    incomeData.push(mi); expenseData.push(me);
  }
  const curIncome = incomeData[11] || 0, curExpense = expenseData[11] || 0;

  // Forecast data
  const fmonths = forecast.months?.map((m: any) => m.month) || [];
  const fsurplus = forecast.months?.map((m: any) => parseFloat(m.projectedSurplus) || 0) || [];
  const fcumulative = forecast.months?.map((m: any) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const runwayMonths = fcumulative.filter((v: number) => v >= 0).length;
  const freedomProgress = Math.min(100, (netWorth / (20000 * 12 * 25)) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Net Worth Bar */}
      <ErrorBoundary name="NetWorth">
        <div className="bg-ledger-surface rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-ledger-muted mb-1">净资产</div>
              <div className="text-2xl font-bold text-white"><AnimatedNumber value={netWorth} prefix="¥" /></div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div><span className="text-ledger-muted">总资产 </span><AmountDisplay amount={totalAssets.toNumber()} className="text-ledger-success font-medium" sensitive /></div>
              <div><span className="text-ledger-muted">总负债 </span><AmountDisplay amount={totalLiabilities.toNumber()} className="text-ledger-danger font-medium" sensitive /></div>
              <div><span className="text-ledger-muted">净资产率 </span><span className="text-white font-medium">{surplusRate.toFixed(1)}%</span></div>
            </div>
          </div>
          <Link href="/management/assets" className="px-3 py-1.5 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-white transition-colors">管理</Link>
        </div>
      </ErrorBoundary>

      {/* Main Grid: 2 columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Asset Allocation Widget */}
        <ErrorBoundary name="AssetAllocation">
          <div className="bg-ledger-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">资产配置</h2>
              <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
            <div className="flex items-start gap-4">
              <div className="shrink-0">{ringData.length > 0 ? <AssetRingChart data={ringData} /> : <div className="w-[260px] h-[260px] flex items-center justify-center text-ledger-muted">暂无数据</div>}</div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {assets.sort((a: any, b: any) => parseFloat(b.balance || '0') - parseFloat(a.balance || '0')).slice(0, 6).map((a: any) => {
                  const cfg = categoryConfig[a.category] || categoryConfig.other;
                  const pct = totalAssets.gt(0) ? (parseFloat(a.balance || '0') / totalAssets.toNumber() * 100).toFixed(1) : '0';
                  return (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span>{cfg.icon}</span>
                      <span className="text-white truncate flex-1">{a.name}</span>
                      <span className="text-ledger-muted text-xs w-10 text-right">{pct}%</span>
                      <AmountDisplay amount={parseFloat(a.balance || '0')} className="text-sm w-24 text-right" sensitive />
                    </div>
                  );
                })}
                {assets.length === 0 && <div className="text-ledger-muted text-sm py-4 text-center">暂无资产</div>}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        {/* Debt Overview Widget */}
        <ErrorBoundary name="DebtOverview">
          <div className="bg-ledger-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">负债总览</h2>
              <Link href="/management/liabilities" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
            <div className="flex items-start gap-4">
              <div className="shrink-0" style={{ width: 240 }}>
                {funnelData.length > 0 ? <DebtFunnelChart data={funnelData} /> : <div className="h-[240px] flex items-center justify-center text-ledger-muted">暂无负债</div>}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="text-sm text-ledger-muted mb-1">
                  总额 <AmountDisplay amount={totalLiabilities.toNumber()} className="text-white font-bold" sensitive /> · WACR <span className="text-ledger-accent font-medium">{(wacr * 100).toFixed(2)}%</span>
                </div>
                <LiabilityCards liabilities={liabilities} />
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* Stock Holdings — detail under Assets + Liabilities */}
      <ErrorBoundary name="StockTable">
        <div className="bg-ledger-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">股票持仓</h2>
            <div className="flex items-center gap-3">
              <PriceRefresher pricesStale={pricesStale} />
              <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
          </div>
          <StockTable stocks={stocks} />
        </div>
      </ErrorBoundary>

      {/* Scissor + Forecast row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Scissor Chart Widget */}
        <ErrorBoundary name="ScissorChart">
          <div className="bg-ledger-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">收支剪刀图</h2>
              <Link href="/management/ledger" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
            <div className="flex items-center gap-4 text-sm mb-2">
              <span className="text-ledger-muted">本月收入 <AmountDisplay amount={curIncome} className="text-ledger-success font-medium" sensitive /></span>
              <span className="text-ledger-muted">支出 <AmountDisplay amount={curExpense} className="text-ledger-danger font-medium" sensitive /></span>
              <span className="text-ledger-muted">盈余率 <span className="text-white font-medium">{curIncome > 0 ? ((curIncome - curExpense) / curIncome * 100).toFixed(1) : '0'}%</span></span>
            </div>
            <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={curIncome * 0.5} />
          </div>
        </ErrorBoundary>

        {/* Forecast Widget */}
        <ErrorBoundary name="Forecast">
          <div className="bg-ledger-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">现金流预测</h2>
              <div className="flex items-center gap-4 text-xs text-ledger-muted">
                <span>生存月数 <span className="text-ledger-accent font-bold">{runwayMonths}</span></span>
                <span>财务自由 <span className="text-ledger-accent font-bold">{freedomProgress.toFixed(1)}%</span></span>
                <span>预警 <span className="font-bold text-white">{forecast.warningLevel === 'red' ? '危险' : forecast.warningLevel === 'yellow' ? '预警' : '健康'}</span></span>
              </div>
            </div>
            <CashflowForecastChart months={fmonths} surplus={fsurplus} cumulative={fcumulative} />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
