'use client';

import { AmountDisplay } from '../common/AmountDisplay';

interface Liability {
  id: string;
  name: string;
  interestRate: number;
  currentBalance: string;
  principal: string;
  termMonths: number;
  startDate: string | Date;
  paymentMethod?: string | null;
}

interface DebtStrategyComparisonProps {
  liabilities: Liability[];
}

interface PayoffStep {
  month: number;
  debtName: string;
  payment: number;
  interestPaid: number;
  remainingTotal: number;
  date: Date;
}

function simulatePayoff(
  debts: { name: string; balance: number; rate: number; minPayment: number }[],
  sortBy: 'rate-desc' | 'balance-asc',
  extraMonthly: number,
): PayoffStep[] {
  const remaining = debts.map(d => ({ ...d }));
  const steps: PayoffStep[] = [];
  const now = new Date();
  let month = 0;

  while (remaining.some(d => d.balance > 0) && month < 600) {
    month++;
    let totalPaidThisMonth = 0;
    let interestThisMonth = 0;

    // Sort to determine which debt gets the extra payment
    const sorted = [...remaining].sort((a, b) => {
      if (sortBy === 'rate-desc') return b.rate - a.rate;
      return a.balance - b.balance;
    });

    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      if (d.balance <= 0) continue;

      // Find first non-zero balance debt in sorted order to target with extra payment
      const targetDebt = sorted.find(s => {
        const r = remaining.find(rr => rr.name === s.name);
        return r && r.balance > 0;
      });
      const isTarget = targetDebt ? d.name === targetDebt.name : false;

      const monthlyInterest = d.balance * d.rate / 12;
      interestThisMonth += monthlyInterest;

      let payment = Math.min(d.balance + monthlyInterest, d.minPayment);
      if (isTarget) payment = Math.min(d.balance + monthlyInterest, d.minPayment + extraMonthly);

      d.balance = Math.max(0, d.balance + monthlyInterest - payment);
      totalPaidThisMonth += payment;

      if (d.balance <= 0 && steps.filter(s => s.debtName === d.name).length === 0) {
        const payoffDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
        steps.push({
          month,
          debtName: d.name,
          payment: totalPaidThisMonth,
          interestPaid: interestThisMonth,
          remainingTotal: remaining.reduce((s, dd) => s + dd.balance, 0),
          date: payoffDate,
        });
      }
    }
  }

  return steps;
}

export default function DebtStrategyComparison({ liabilities }: DebtStrategyComparisonProps) {
  if (liabilities.length < 2) return null;

  const debts = liabilities.filter(l => l.paymentMethod !== 'revolving_credit').map(l => ({
    name: l.name,
    balance: parseFloat(l.currentBalance) || 0,
    rate: l.interestRate,
    minPayment: parseFloat(l.currentBalance) / l.termMonths * 2 || 100,
  })).filter(d => d.balance > 0);

  if (debts.length < 2) return null;

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const extraMonthly = totalBalance * 0.02; // 2% extra per month

  const avalancheSteps = simulatePayoff(debts, 'rate-desc', extraMonthly);
  const snowballSteps = simulatePayoff(debts, 'balance-asc', extraMonthly);

  const avalancheTotalInterest = avalancheSteps.reduce((s, st) => s + st.interestPaid, 0);
  const snowballTotalInterest = snowballSteps.reduce((s, st) => s + st.interestPaid, 0);
  const avalancheMonths = avalancheSteps.length > 0 ? avalancheSteps[avalancheSteps.length - 1].month : 0;
  const snowballMonths = snowballSteps.length > 0 ? snowballSteps[snowballSteps.length - 1].month : 0;

  return (
    <div className="bg-ledger-surface rounded-xl p-4 mt-4">
      <h2 className="text-base font-bold text-white mb-3">
        还债策略对比
        <span className="text-xs text-ledger-muted font-normal ml-2">
          每月额外还款 ¥{extraMonthly.toFixed(0)}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {/* Avalanche */}
        <div className="bg-ledger-bg rounded-lg p-3">
          <h3 className="text-sm font-medium text-white mb-1">❄️ 雪崩法（优先高利率）</h3>
          <p className="text-xs text-ledger-muted mb-2">数学最优 · 利息最少</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-ledger-muted">总利息</span>
              <AmountDisplay amount={avalancheTotalInterest} className="text-white" />
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">还清时间</span>
              <span className="text-white">{avalancheMonths} 个月</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">还款顺序</span>
              <span className="text-green-400">利率从高到低</span>
            </div>
          </div>
          {avalancheSteps.slice(0, 3).map((s, i) => (
            <div key={i} className="mt-1 text-xs text-ledger-muted">
              第{s.month}月还清 {s.debtName}
            </div>
          ))}
        </div>

        {/* Snowball */}
        <div className="bg-ledger-bg rounded-lg p-3">
          <h3 className="text-sm font-medium text-white mb-1">🟢 雪球法（优先小余额）</h3>
          <p className="text-xs text-ledger-muted mb-2">心理激励 · 快速见效</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-ledger-muted">总利息</span>
              <AmountDisplay amount={snowballTotalInterest} className="text-white" />
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">还清时间</span>
              <span className="text-white">{snowballMonths} 个月</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">还款顺序</span>
              <span className="text-blue-400">余额从小到大</span>
            </div>
          </div>
          {snowballSteps.slice(0, 3).map((s, i) => (
            <div key={i} className="mt-1 text-xs text-ledger-muted">
              第{s.month}月还清 {s.debtName}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-xs text-ledger-muted">
        {avalancheTotalInterest < snowballTotalInterest ? (
          <>💡 雪崩法可多节省 <AmountDisplay amount={snowballTotalInterest - avalancheTotalInterest} className="text-green-400" /></>
        ) : (
          <>💡 两种策略利息差异较小，可优先选择心理激励更强的雪球法</>
        )}
      </div>
    </div>
  );
}
