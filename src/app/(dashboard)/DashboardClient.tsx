'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import Decimal from 'decimal.js';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import FamilySafetySummary from '@/components/widgets/FamilySafetySummary';
import { ExpandableDetail, isCollapsibleCat } from '@/components/widgets/SpecialAccountsPanel';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import { useDashboard } from '@/hooks/useDashboard';
import { useBudgets } from '@/hooks/useBudgets';
import {
  STOCK_IDLE_CASH_STORAGE_KEY,
  useStoredNumber,
} from '@/hooks/useStoredNumber';
import { getCategories } from '@/lib/actions/categories';
import { getGoals } from '@/lib/actions/goals';
import { getCurrentGoldPrice } from '@/lib/actions/gold';
import { getRecurringRules } from '@/lib/actions/recurring';
import {
  getAssetDisplayGroupKey,
  isGoldAssetCategory,
} from '@/lib/asset-special-groups';
import {
  buildGoalContributionPlan,
  buildProjectedAvailableCash,
} from '@/lib/goal-forecast';
import useSWR from 'swr';

function ChartSkeleton({ height, width = '100%' }: { height: number; width?: number | string }) {
  return (
    <div
      className="skeleton"
      role="status"
      aria-label="图表加载中"
      style={{ height, width, maxWidth: '100%' }}
    />
  );
}

function PanelSkeleton({ height }: { height: number }) {
  return (
    <div
      className="skeleton"
      role="status"
      aria-label="内容加载中"
      style={{ height, width: '100%' }}
    />
  );
}

const AssetRingChart = dynamic(() => import('@/components/charts/AssetRingChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={280} width={280} />,
});
const DebtFunnelChart = dynamic(() => import('@/components/charts/DebtFunnelChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});
const ScissorChart = dynamic(() => import('@/components/charts/ScissorChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={400} />,
});
const CashflowForecastChart = dynamic(() => import('@/components/charts/CashflowForecastChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={310} />,
});
const StockTable = dynamic(() => import('@/components/widgets/StockTable'), {
  ssr: false,
  loading: () => <PanelSkeleton height={160} />,
});
const LiabilityCards = dynamic(() => import('@/components/widgets/LiabilityCards'), {
  ssr: false,
  loading: () => <PanelSkeleton height={220} />,
});
const BudgetTracker = dynamic(() => import('@/components/widgets/BudgetTracker'), {
  ssr: false,
  loading: () => <PanelSkeleton height={240} />,
});
const GoalTracker = dynamic(() => import('@/components/widgets/GoalTracker'), {
  ssr: false,
  loading: () => <PanelSkeleton height={220} />,
});

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  provident_fund: { icon: '🏦', color: '#06b6d4', label: '公积金' },
  pension: { icon: '🏛️', color: '#8b5cf6', label: '养老保险' },
  gold: { icon: '🟡', color: '#f59e0b', label: '黄金' },
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
  } = useDashboard();

  const { data: budgetProgressData } = useBudgets(currentDate);
  const budgetProgress = budgetProgressData?.data ?? [];
  const { data: categoriesData } = useSWR('categories', () => getCategories().then(r => r.success ? (r.data ?? []) : []));
  const categories = categoriesData ?? [];

  const { data: goalsData } = useSWR('goals', () => getGoals().then(r => r.success ? (r.data ?? []) : []));
  const goals = goalsData ?? [];
  const { data: recurringRulesData } = useSWR(
    goals.length > 0 ? 'recurring-rules' : null,
    () => getRecurringRules().then(r => r.success ? (r.data ?? []) : []),
  );
  const recurringRules = recurringRulesData ?? [];
  const { data: goldPriceData } = useSWR('gold-price', () => getCurrentGoldPrice().then(r => r.success ? r.data : null));

  // The server snapshot is null, so SSR and the first client render stay identical.
  const idleCash = useStoredNumber(STOCK_IDLE_CASH_STORAGE_KEY) ?? 0;

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

  // Forex rates — must be defined before any calculation that uses them
  const cnyRate: Record<string, number> = { CNY: 1, USD: forexRates.usdToCny, HKD: forexRates.hkdToCny, JPY: forexRates.jpyToCny };
  function toCny(amount: number | string, currency?: string): number {
    const cur = currency || 'CNY';
    return parseFloat(amount as string) * (cnyRate[cur] || 1);
  }
  function convertBalance(a: any): number {
    let v = parseFloat(a.balance || '0');
    if ((a.category === 'stock' || a.category === 'fund') && a.priceCurrency && a.priceCurrency !== 'CNY') {
      v = v * (cnyRate[a.priceCurrency] || 1);
    }
    return v;
  }

  const totalAssets = assets.reduce((sum: Decimal, a: any) => sum.plus(new Decimal(convertBalance(a))), new Decimal(0)).plus(new Decimal(idleCash));
  const totalLiabilities = liabilities.reduce((sum: Decimal, l: any) => sum.plus(new Decimal(l.currentBalance || 0)), new Decimal(0));
  const netWorth = totalAssets.minus(totalLiabilities).toNumber();
  const surplusRate = totalAssets.gt(0) ? netWorth / totalAssets.toNumber() * 100 : 0;

  const stocks = assets.filter((a: any) => a.category === 'stock');
  const goldPriceAsset = assets.find((a: any) => (
    (a.category === 'gold_physical' || a.category === 'gold_paper') &&
    Number.isFinite(Number(a.unitPrice)) &&
    Number(a.unitPrice) > 0
  ));
  const goldUnitPrice = goldPriceData?.price ?? (goldPriceAsset ? Number(goldPriceAsset.unitPrice) : null);
  const goldPriceCurrency = goldPriceData?.currency ?? goldPriceAsset?.priceCurrency ?? goldPriceAsset?.currency ?? 'CNY';

  const catTotals: Record<string, number> = {};
  for (const a of assets) {
    let v = parseFloat(a.balance || '0');
    // Convert stock/fund market value to CNY using forex rate (matches StockTable logic)
    if ((a.category === 'stock' || a.category === 'fund') && a.priceCurrency && a.priceCurrency !== 'CNY') {
      v = v * (cnyRate[a.priceCurrency] || 1);
    }
    const displayGroup = getAssetDisplayGroupKey(a.category);
    catTotals[displayGroup] = (catTotals[displayGroup] || 0) + v;
  }
  // Include idle cash in stock total (matches StockTable's account total = market value + idle cash)
  if (idleCash > 0) {
    catTotals['stock'] = (catTotals['stock'] || 0) + idleCash;
  }
  const ringData = Object.entries(catTotals)
    .map(([cat, value]) => ({ name: categoryConfig[cat]?.label || cat, value, itemStyle: { color: categoryConfig[cat]?.color || '#94a3b8' } }))
    .sort((a, b) => b.value - a.value);

  const funnelData = liabilities.map((l: any) => {
    const value = parseFloat(l.currentBalance) || 0;
    const isRevolving = l.paymentMethod === 'revolving_credit';
    const principal = isRevolving ? value : (parseFloat(l.principal) || value);

    return {
      name: l.name,
      value,
      paid: isRevolving ? 0 : Math.max(0, principal - value),
      principal,
      rate: l.interestRate * 100,
    };
  });
  const wacr = liabilities.length > 0 ? liabilities.reduce((sum: number, l: any) => sum + (parseFloat(l.currentBalance) || 0) * l.interestRate, 0) / (totalLiabilities.toNumber() || 1) : 0;

  const now = new Date();
  const months: string[] = [], incomeData: number[] = [], expenseData: number[] = [];
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
  const fcumulative = forecast.months?.map((m: any) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const goalAssetIds = new Set(goals.map((goal: any) => goal.assetId).filter(Boolean));
  const currentCash = assets
    .filter((a: any) => (a.category === 'cash' || a.category === 'current_deposit') && !goalAssetIds.has(a.id))
    .reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);
  const goalContributionPlan = buildGoalContributionPlan({
    goals,
    months: fmonths,
    rules: recurringRules.map((rule: any) => ({
      ...rule,
      amount: toCny(rule.amount, rule.currency),
    })),
  });
  const projectedAvailableCash = buildProjectedAvailableCash({
    months: fmonths,
    cumulative: fcumulative,
    currentCash,
    events: goalContributionPlan.events,
  });
  const firstRiskMonthIndex = projectedAvailableCash.findIndex((value) => value < 0);
  const runwayLabel = fmonths.length === 0
    ? '—'
    : firstRiskMonthIndex === -1
      ? `≥${fmonths.length}个月`
      : `${firstRiskMonthIndex}个月`;
  const forecastWarningLevel = firstRiskMonthIndex >= 0 ? 'red' : forecast.warningLevel;

  // Liquidity tiers
  const tier1Categories = ['stock', 'current_deposit', 'cash'];
  const tier1Assets = assets.filter((a: any) => tier1Categories.includes(a.category || ''));
  const tier1Total = tier1Assets.reduce((s: number, a: any) => s + convertBalance(a), 0) + idleCash;

  const tier2Exclude = ['provident_fund', 'pension'];
  const tier2Assets = assets.filter((a: any) => !tier2Exclude.includes(a.category || ''));
  const tier2Total = tier2Assets.reduce((s: number, a: any) => s + convertBalance(a), 0) + idleCash;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
      gap: '16px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      {/* Family safety — first-screen answer */}
      <ErrorBoundary name="FamilySafety">
        <FamilySafetySummary
          currentDate={currentDate}
          netWorth={netWorth}
          totalAssets={totalAssets.toNumber()}
          totalLiabilities={totalLiabilities.toNumber()}
          surplusRate={surplusRate}
          tier1Total={tier1Total}
          currentIncome={curIncome}
          currentExpense={curExpense}
          budgetProgress={budgetProgress}
          transactions={transactions}
          assets={assets}
          categories={categories}
          pricesStale={pricesStale}
          goldUnitPrice={goldUnitPrice}
          goldPriceCurrency={goldPriceCurrency}
        />
      </ErrorBoundary>

      {/* Assets */}
      <ErrorBoundary name="Assets">
        <div className="card">
          <div className="card-header">
            <span>资产配置</span>
            <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 280px', width: 280, maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
              {ringData.length > 0 ? (
                <AssetRingChart
                  data={ringData}
                  centerMetrics={{
                    totalAssets: totalAssets.toNumber(),
                    tier1Total,
                    tier2Total,
                  }}
                />
              ) : (
                <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>暂无数据</div>
              )}
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              {Object.entries(catTotals).sort(([, a], [, b]) => b - a).map(([cat, total]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = totalAssets.gt(0) ? (total / totalAssets.toNumber() * 100).toFixed(1) : '0';
                const count = assets.filter((a: any) => getAssetDisplayGroupKey(a.category) === cat).length;
                const isCollapsible = isCollapsibleCat(cat);
                const isGoldCat = cat === 'gold';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 13, padding: '3px 0' }}>
                    {isCollapsible ? (
                      <ExpandableDetail cat={cat} assets={assets} color={cfg.color} label={cfg.label} />
                    ) : (
                      <>
                        <span style={{
                          display: 'inline-block', width: 10, height: 10, borderRadius: 2.5,
                          background: cfg.color, flexShrink: 0,
                        }} />
                        <span style={{ color: 'var(--color-text-primary)' }}>{cfg.label}</span>
                      </>
                    )}
                    {!isCollapsible && count > 1 && <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>({count}项)</span>}
                    {isGoldCat && (() => {
                      const grams = assets.filter((a: any) => isGoldAssetCategory(a.category)).reduce((s: number, a: any) => s + (a.quantity || 0), 0);
                      return <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, width: 48, textAlign: 'right' }}>{Number(grams).toFixed(0)}克</span>;
                    })()}
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, width: 40, textAlign: 'right', marginLeft: 'auto' }}>{pct}%</span>
                    <AmountDisplay amount={total} className="text-sm" />
                  </div>
                );
              })}
              {assets.length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>暂无资产</div>}
            </div>
          </div>
        </div>
      </ErrorBoundary>

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
            <StockTable stocks={stocks} forexRates={forexRates} pricesStale={pricesStale} />
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
          <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 1 300px', width: 'min(300px, 100%)', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
              {funnelData.length > 0 ? <DebtFunnelChart data={funnelData} size={300} /> : (
                <div style={{ width: 'min(300px, 100%)', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>暂无负债</div>
              )}
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8, width: '100%' }}>
                总额 <AmountDisplay amount={totalLiabilities.toNumber()} className="font-bold" /> · WACR <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{(wacr * 100).toFixed(2)}%</span>
              </div>
              <LiabilityCards liabilities={liabilities} transactions={transactions} assets={assets} />
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {budgetProgress.length > 0 ? (
        <ErrorBoundary name="Budget">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span>预算追踪</span>
              <Link href="/management/budget" className="btn btn-outline btn-sm">管理</Link>
            </div>
            <div className="card-body">
              <BudgetTracker progress={budgetProgress} transactions={transactions as any} assets={assets} />
            </div>
          </div>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="BudgetEmpty">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><span>预算追踪</span></div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              暂无预算 · <Link href="/management/budget" className="btn btn-outline btn-sm" style={{ marginLeft: 8 }}>创建</Link>
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
              <span style={{ color: 'var(--color-text-secondary)' }}>本月收入 <AmountDisplay amount={curIncome} className="font-medium" /></span>
              <span style={{ color: 'var(--color-text-secondary)' }}>支出 <AmountDisplay amount={curExpense} className="font-medium" /></span>
              <span style={{ color: 'var(--color-text-secondary)' }}>盈余率 <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{curIncome > 0 ? ((curIncome - curExpense) / curIncome * 100).toFixed(1) : '0'}%</span></span>
            </div>
            <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={curIncome * 0.5} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Forecast */}
      <ErrorBoundary name="Forecast">
        <div className="card">
          <div className="card-header">
            <span style={{ whiteSpace: 'nowrap' }}>现金流预测</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <span>覆盖 <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>未来 {fmonths.length || 12} 个月</span></span>
              <span>现金安全期 <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{runwayLabel}</span></span>
              <span>预警 <span style={{ fontWeight: 700, color: forecastWarningLevel === 'red' ? 'var(--color-danger)' : forecastWarningLevel === 'yellow' ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>{forecastWarningLevel === 'red' ? '危险' : forecastWarningLevel === 'yellow' ? '预警' : '健康'}</span></span>
            </div>
          </div>
          <div className="card-body">
            <CashflowForecastChart
              months={fmonths}
              cumulative={fcumulative}
              currentCash={currentCash}
              contributionEvents={goalContributionPlan.events}
            />
          </div>
        </div>
      </ErrorBoundary>

      {/* Goals — long-term direction after near-term cash safety */}
      <ErrorBoundary name="Goals">
        <div style={{ gridColumn: '1 / -1' }}>
          <GoalTracker
            goals={goals}
            assets={assets}
            monthlyContributionByGoal={goalContributionPlan.monthlyByGoal}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}
