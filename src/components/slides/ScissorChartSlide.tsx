'use client';

import Link from 'next/link';
import ScissorChart from '../charts/ScissorChart';
import { AmountDisplay } from '../common/AmountDisplay';

interface Transaction { id: string; type: string; amount: number | string; occurredAt: string | Date; }

export default function ScissorChartSlide({ transactions }: { transactions: Transaction[] }) {
  const months: string[] = [];
  const incomeData: number[] = [];
  const expenseData: number[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    incomeData.push(transactions.filter(t => { const td = new Date(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s, t) => s + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0));
    expenseData.push(transactions.filter(t => { const td = new Date(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); }).reduce((s, t) => s + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0));
  }
  const thisMonth = now.getMonth(), thisYear = now.getFullYear();
  const curIncome = transactions.filter(t => { const d = new Date(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).reduce((s, t) => s + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0);
  const curExpense = transactions.filter(t => { const d = new Date(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).reduce((s, t) => s + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0);
  const surplusRate = curIncome > 0 ? (((curIncome - curExpense) / curIncome) * 100).toFixed(1) : '0';
  const survivalLine = curIncome * 0.5;

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">收支剪刀图</h2>
        <Link href="/management/ledger" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-center gap-3 mb-2 text-sm">
        <span className="text-ledger-muted">本月收入 <AmountDisplay amount={curIncome} className="text-ledger-success font-medium" sensitive /></span>
        <span className="text-ledger-muted">支出 <AmountDisplay amount={curExpense} className="text-ledger-danger font-medium" sensitive /></span>
        <span className="text-ledger-muted">盈余率 <span className="text-white font-medium">{surplusRate}%</span></span>
      </div>
      <div className="bg-ledger-surface rounded-lg p-4" style={{ height: 280 }}>
        <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={survivalLine} />
      </div>
    </div>
  );
}
