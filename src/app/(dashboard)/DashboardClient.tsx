'use client';

import Link from 'next/link';
import Decimal from 'decimal.js';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import AssetRingChart from '@/components/charts/AssetRingChart';
import DebtFunnelChart from '@/components/charts/DebtFunnelChart';
import ScissorChart from '@/components/charts/ScissorChart';
import CashflowForecastChart from '@/components/charts/CashflowForecastChart';
import TargetCashflow from '@/components/widgets/TargetCashflow';
import StockTable from '@/components/widgets/StockTable';
import LiabilityCards from '@/components/widgets/LiabilityCards';
import DebtStrategyComparison from '@/components/widgets/DebtStrategyComparison';
import BudgetTracker from '@/components/widgets/BudgetTracker';
import GoalTracker from '@/components/widgets/GoalTracker';
import MonthFlow from '@/components/widgets/MonthFlow';
import { ExpandableDetail, isCollapsibleCat } from '@/components/widgets/SpecialAccountsPanel';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import { useDashboard } from '@/hooks/useDashboard';
import { useBudgets } from '@/hooks/useBudgets';
import { getGoals } from '@/lib/actions/goals';
import useSWR from 'swr';

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  provident_fund: { icon: '🏦', color: '#06b6d4', label: '公积金' },
  pension: { icon: '🏛️', color: '#8b5cf6', label: '养老保险' },
  gold_physical: { icon: '🟡', color: '#f59e0b', label: '实物黄金' },
  gold_paper: { icon: '📄', color: '#eab308', label: '纸黄金' },
  stock: { icon: '📈', color: '#ef4444', label: '股票' },
  fund: { icon: '📊', color: '#8b5cf6', label: '基金' },
  bond: { icon: '📜', color: '#06b6d4', label: '债券' },
  vehicle: { icon: '🚗', color: '#f97316', label: '车辆' },
  current_deposit: { icon: '💳', color: '#14b8a6', label: '银行活期' },
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

export default function DashboardClient({ currentDate }: { currentDate: string }) {
  const {
    assets, liabilities, transactions, forecast,
    forexRates, pricesStale, isLoading,
  } = useDashboard(currentDate);

  const { data: budgetProgressData } = useBudgets(currentDate);
  const budgetProgress = budgetProgressData?.data ?? [];

  const { data: goalsData } = useSWR('goals', () => getGoals().then(r => r.success ? (r.data ?? []) : []));
  const goals = goalsData ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      </div>
    );
  }

  const totalAssets = assets.reduce((sum: Decimal, a: any) => sum.plus(new Decimal(a.balance || 0)), new Decimal(0));
  const totalLiabilities = liabilities.reduce((sum: Decimal, l: any) => sum.plus(new Decimal(l.currentBalance || 0)), new Decimal(0));
  const netWorth = totalAssets.minus(totalLiabilities).toNumber();
  const surplusRate = totalAssets.gt(0) ? netWorth / totalAssets.toNumber() * 100 : 0;

  const stocks = assets.filter((a: any) => a.category === 'stock');

  const catTotals: Record<string, number> = {};
  for (const a of assets) {
    const v = parseFloat(a.balance || '0');
    catTotals[a.category || 'other'] = (catTotals[a.category || 'other'] || 0) + v;
  }
  const ringData = Object.entries(catTotals)
    .map(([cat, value]) => ({ name: categoryConfig[cat]?.label || cat, value, itemStyle: { color: categoryConfig[cat]?.color || '#94a3b8' } }))
    .sort((a, b) => b.value - a.value);

  const funnelData = liabilities.map((l: any) => ({ name: l.name, value: parseFloat(l.currentBalance) || 0, rate: l.interestRate * 100 }));
  const wacr = liabilities.length > 0 ? liabilities.reduce((sum: number, l: any) => sum + (parseFloat(l.currentBalance) || 0) * l.interestRate, 0) / (totalLiabilities.toNumber() || 1) : 0;

  const now = new Date();
  const months: string[] = [], incomeData: number[] = [], expenseData: number[] = [];
  const cnyRate: Record<string, number> = { CNY: 1, USD: forexRates.usdToCny, HKD: forexRates.hkdToCny, JPY: forexRates.jpyToCny };
  function toCny(amount: number | string, currency?: string): number {
    const cur = currency || 'CNY';
    return parseFloat(amount as string) * (cnyRate[cur] || 1);
  }
  function toBeijingDate(v: any): Date {
    const ts = v instanceof Date ? v.getTime() : new Date(typeof v === 'string' && v.endsWith('Z') ? v : v + 'Z').getTime();
    return new Date(ts + 8 * 3600_000);
  }
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    const mi = transactions.filter((t: any) => { const td = toBeijingDate(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && td.getUTCFullYear() === d.getFullYear() && td.getUTCMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    const me = transactions.filter((t: any) => { const td = toBeijingDate(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && td.getUTCFullYear() === d.getFullYear() && td.getUTCMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    incomeData.push(mi); expenseData.push(me);
  }
  const curIncome = incomeData[11] || 0, curExpense = expenseData[11] || 0;
  const fmonths = forecast.months?.map((m: any) => m.month) || [];
  const fsurplus = forecast.months?.map((m: any) => parseFloat(m.projectedSurplus) || 0) || [];
  const fcumulative = forecast.months?.map((m: any) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const runwayMonths = fcumulative.filter((v: number) => v >= 0).length;
  const freedomProgress = Math.min(100, (netWorth / (20000 * 12 * 25)) * 100);
  const currentCash = assets.filter((a: any) => a.category === 'cash' || a.category === 'current_deposit').reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);

  // Liquidity tiers
  const tier1Categories = ['stock', 'current_deposit', 'cash'];
  const tier1Assets = assets.filter((a: any) => tier1Categories.includes(a.category || ''));
  const tier1Total = tier1Assets.reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);

  const tier2Exclude = ['provident_fund', 'pension'];
  const tier2Assets = assets.filter((a: any) => !tier2Exclude.includes(a.category || ''));
  const tier2Total = tier2Assets.reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      {/* Net Worth — full width */}
      <ErrorBoundary name="NetWorth">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            {/* Top row: 净资产 + 管理 button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>净资产</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  <AnimatedNumber value={netWorth} prefix="¥" />
                </div>
              </div>
              <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
            </div>
            {/* Stats row: 总资产 / 总负债 / 净资产率 */}
            <div style={{ display: 'flex', gap: 20, fontSize: 13, marginTop: 12 }}>
              <div>
                <span style={{ color: 'var(--color-text-secondary)' }}>总资产 </span>
                <AmountDisplay amount={totalAssets.toNumber()} className="font-medium" />
                {/* Liquidity sub-labels under 总资产 */}
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-subdued)' }}>
                    一级流动性{' '}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      ¥{(tier1Total / 10000).toFixed(0)}万
                    </span>
                    <span style={{ color: 'var(--color-text-subdued)', fontSize: 10 }}>
                      {' '}({totalAssets.gt(0) ? (tier1Total / totalAssets.toNumber() * 100).toFixed(0) : 0}%)
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-subdued)' }}>
                    二级{' '}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      ¥{(tier2Total / 10000).toFixed(0)}万
                    </span>
                    <span style={{ color: 'var(--color-text-subdued)', fontSize: 10 }}>
                      {' '}({totalAssets.gt(0) ? (tier2Total / totalAssets.toNumber() * 100).toFixed(0) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>总负债 </span><AmountDisplay amount={totalLiabilities.toNumber()} className="font-medium" /></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>净资产率 </span><span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{surplusRate.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* MonthFlow + Budget — side by side */}
      <ErrorBoundary name="MonthFlow">
        <MonthFlow curIncome={curIncome} curExpense={curExpense} transactions={transactions} />
      </ErrorBoundary>

      {budgetProgress.length > 0 ? (
        <ErrorBoundary name="Budget">
          <div className="card">
            <div className="card-header">
              <span>预算追踪</span>
              <Link href="/management/budget" className="btn btn-outline btn-sm">管理</Link>
            </div>
            <div className="card-body">
              <BudgetTracker progress={budgetProgress} transactions={transactions as any} />
            </div>
          </div>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="BudgetEmpty">
          <div className="card">
            <div className="card-header"><span>预算追踪</span></div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: 'var(--color-text-muted)', fontSize: 13 }}>
              暂无预算 · <Link href="/management/budget" className="btn btn-outline btn-sm" style={{ marginLeft: 8 }}>创建</Link>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Assets */}
      <ErrorBoundary name="Assets">
        <div className="card">
          <div className="card-header">
            <span>资产配置</span>
            <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              {ringData.length > 0 ? <AssetRingChart data={ringData} /> : (
                <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>暂无数据</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {Object.entries(catTotals).sort(([, a], [, b]) => b - a).map(([cat, total]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = totalAssets.gt(0) ? (total / totalAssets.toNumber() * 100).toFixed(1) : '0';
                const count = assets.filter((a: any) => (a.category || 'other') === cat).length;
                const isCollapsible = isCollapsibleCat(cat);
                const isGoldCat = cat === 'gold_physical' || cat === 'gold_paper';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
                    {isCollapsible && <ExpandableDetail cat={cat} assets={assets} />}
                    <span>{cfg.icon}</span>
                    <span style={{ color: 'var(--color-text)' }}>{cfg.label}</span>
                    {!isCollapsible && count > 1 && <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>({count}项)</span>}
                    {isGoldCat && (() => {
                      const grams = assets.filter((a: any) => (a.category||'other') === cat).reduce((s: number, a: any) => s + (a.quantity || 0), 0);
                      return <span style={{ color: 'var(--color-text-muted)', fontSize: 11, width: 48, textAlign: 'right' }}>{Number(grams).toFixed(0)}克</span>;
                    })()}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11, width: 40, textAlign: 'right', marginLeft: 'auto' }}>{pct}%</span>
                    <AmountDisplay amount={total} className="text-sm" />
                  </div>
                );
              })}
              {assets.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>暂无资产</div>}
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debts */}
      <ErrorBoundary name="Debts">
        <div className="card">
          <div className="card-header">
            <span>负债总览</span>
            <Link href="/management/liabilities" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 240 }}>
              {funnelData.length > 0 ? <DebtFunnelChart data={funnelData} /> : (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>暂无负债</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                总额 <AmountDisplay amount={totalLiabilities.toNumber()} className="font-bold" /> · WACR <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{(wacr * 100).toFixed(2)}%</span>
              </div>
              <LiabilityCards liabilities={liabilities} transactions={transactions} />
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debt Strategy — only if 2+ liabilities */}
      {liabilities.length >= 2 && (
        <ErrorBoundary name="DebtStrategy">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <DebtStrategyComparison liabilities={liabilities} />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Stocks */}
      <ErrorBoundary name="Stocks">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span>股票持仓</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PriceRefresher pricesStale={pricesStale} />
              <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
            </div>
          </div>
          <div className="card-body">
            <StockTable stocks={stocks} forexRates={forexRates} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Goals — only if goals exist */}
      {goals.length > 0 && (
        <ErrorBoundary name="Goals">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <GoalTracker goals={goals} />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Scissor */}
      <ErrorBoundary name="Scissor">
        <div className="card">
          <div className="card-header">
            <span>收支剪刀图</span>
            <Link href="/management/ledger" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>本月收入 <AmountDisplay amount={curIncome} className="font-medium" /></span>
              <span style={{ color: 'var(--color-text-muted)' }}>支出 <AmountDisplay amount={curExpense} className="font-medium" /></span>
              <span style={{ color: 'var(--color-text-muted)' }}>盈余率 <span style={{ fontWeight: 500, color: 'var(--color-text-heading)' }}>{curIncome > 0 ? ((curIncome - curExpense) / curIncome * 100).toFixed(1) : '0'}%</span></span>
            </div>
            <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={curIncome * 0.5} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Forecast */}
      <ErrorBoundary name="Forecast">
        <div className="card">
          <div className="card-header">
            <span>现金流预测</span>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>生存月数 <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{runwayMonths}</span></span>
              <span>财务自由 <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{freedomProgress.toFixed(1)}%</span></span>
              <span>预警 <span style={{ fontWeight: 700, color: forecast.warningLevel === 'red' ? 'var(--color-danger)' : forecast.warningLevel === 'yellow' ? 'var(--color-warning)' : 'var(--color-text-heading)' }}>{forecast.warningLevel === 'red' ? '危险' : forecast.warningLevel === 'yellow' ? '预警' : '健康'}</span></span>
            </div>
          </div>
          <div className="card-body">
            <CashflowForecastChart months={fmonths} surplus={fsurplus} cumulative={fcumulative} />
            <TargetCashflow monthlyIncome={curIncome} monthlyExpense={curExpense} currentCash={currentCash} />
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
