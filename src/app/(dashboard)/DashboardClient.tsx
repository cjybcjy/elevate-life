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
import StockTable from '@/components/widgets/StockTable';
import LiabilityCards from '@/components/widgets/LiabilityCards';
import DebtStrategyComparison from '@/components/widgets/DebtStrategyComparison';
import BudgetTracker from '@/components/widgets/BudgetTracker';
import GoalTracker from '@/components/widgets/GoalTracker';
import { ExpandableDetail } from '@/components/widgets/SpecialAccountsPanel';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import DashboardGrid from '@/components/layout/DashboardGrid';

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
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

export default function DashboardClient({
  assets, liabilities, transactions, forecast, forexRates,
  budgetProgress, goals, pricesStale,
}: any) {
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
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    const mi = transactions.filter((t: any) => { const td = new Date(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    const me = transactions.filter((t: any) => { const td = new Date(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    incomeData.push(mi); expenseData.push(me);
  }
  const curIncome = incomeData[11] || 0, curExpense = expenseData[11] || 0;
  const fmonths = forecast.months?.map((m: any) => m.month) || [];
  const fsurplus = forecast.months?.map((m: any) => parseFloat(m.projectedSurplus) || 0) || [];
  const fcumulative = forecast.months?.map((m: any) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const runwayMonths = fcumulative.filter((v: number) => v >= 0).length;
  const freedomProgress = Math.min(100, (netWorth / (20000 * 12 * 25)) * 100);

  return (
    <DashboardGrid>
      {/* Net Worth */}
      <ErrorBoundary name="NetWorth">
        <div className="p-4 flex items-center justify-between" style={{ minHeight: 64 }}>
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

      {/* Assets */}
      <ErrorBoundary name="Assets">
        <div className="p-4">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">资产配置</h2>
            <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
          </div>
          <div className="flex items-start gap-4">
            <div className="shrink-0">{ringData.length > 0 ? <AssetRingChart data={ringData} /> : <div className="w-[260px] h-[260px] flex items-center justify-center text-ledger-muted">暂无数据</div>}</div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {Object.entries(catTotals).sort(([, a], [, b]) => b - a).map(([cat, total]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = totalAssets.gt(0) ? (total / totalAssets.toNumber() * 100).toFixed(1) : '0';
                const count = assets.filter((a: any) => (a.category || 'other') === cat).length;
                const isCollapsible = ['provident_fund','pension','gold_physical','gold_paper'].includes(cat);
                const isGoldCat = cat === 'gold_physical' || cat === 'gold_paper';
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 text-sm">
                      {isCollapsible && <ExpandableDetail cat={cat} assets={assets} />}
                      <span>{cfg.icon}</span>
                      <span className="text-white">{cfg.label}</span>
                      {!isCollapsible && count > 1 && <span className="text-ledger-muted text-xs">({count}项)</span>}
                      {isGoldCat && (() => {
                        const grams = assets.filter((a: any) => (a.category||'other') === cat).reduce((s: number, a: any) => s + (a.quantity || 0), 0);
                        return <span className="text-ledger-muted text-xs w-12 text-right">{Number(grams).toFixed(0)}克</span>;
                      })()}
                      <span className="text-ledger-muted text-xs w-10 text-right ml-auto">{pct}%</span>
                      <AmountDisplay amount={total} className="text-sm w-24 text-right" sensitive />
                    </div>
                  </div>
                );
              })}
              {assets.length === 0 && <div className="text-ledger-muted text-sm py-4 text-center">暂无资产</div>}
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debts */}
      <ErrorBoundary name="Debts">
        <div className="p-4">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between mb-3">
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
              <LiabilityCards liabilities={liabilities} transactions={transactions} />
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debt Strategy — only show if 2+ liabilities */}
      {liabilities.length >= 2 && (
        <ErrorBoundary name="DebtStrategy">
          <DebtStrategyComparison liabilities={liabilities} />
        </ErrorBoundary>
      )}

      {/* Stocks */}
      <ErrorBoundary name="Stocks">
        <div className="p-4">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">股票持仓</h2>
            <div className="flex items-center gap-3">
              <PriceRefresher pricesStale={pricesStale} />
              <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-bg border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
            </div>
          </div>
          <StockTable stocks={stocks} forexRates={forexRates} />
        </div>
      </ErrorBoundary>

      {/* Budget — only show if budgets exist */}
      {budgetProgress.length > 0 && (
        <ErrorBoundary name="Budget">
          <BudgetTracker progress={budgetProgress} />
        </ErrorBoundary>
      )}

      {/* Goals — only show if goals exist */}
      {goals.length > 0 && (
        <ErrorBoundary name="Goals">
          <GoalTracker goals={goals} />
        </ErrorBoundary>
      )}

      {/* Scissor */}
      <ErrorBoundary name="Scissor">
        <div className="p-4">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between mb-3">
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

      {/* Forecast */}
      <ErrorBoundary name="Forecast">
        <div className="p-4">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between mb-3">
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
    </DashboardGrid>
  );
}
