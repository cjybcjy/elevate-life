'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';

const curSym: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };

export default function MonthFlow({
  curIncome,
  curExpense,
  transactions,
}: {
  curIncome: number;
  curExpense: number;
  transactions: any[];
}) {
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  // Use Beijing time (UTC+8) for month comparison
  const beijingNow = new Date(Date.now() + 8 * 3600_000);
  const nowYear = beijingNow.getUTCFullYear();
  const nowMonth = beijingNow.getUTCMonth();

  const curMonthTx = transactions.filter((t: any) => {
    const v = t.occurredAt;
    const ts = v instanceof Date ? v.getTime() : new Date(v + (String(v).endsWith('Z') ? '' : 'Z')).getTime();
    const bj = new Date(ts + 8 * 3600_000); // UTC+8
    return bj.getUTCFullYear() === nowYear && bj.getUTCMonth() === nowMonth;
  }).sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const incomeTx = curMonthTx.filter((t: any) => t.type === 'INCOME' || t.type === 'income');
  const expenseTx = curMonthTx.filter((t: any) => t.type === 'EXPENSE' || t.type === 'expense');

  // Group income by 工资
  const groupedIncome: any[] = [];
  const salaryTx: any[] = [];
  for (const t of incomeTx) {
    if (t.category?.name === '工资') { salaryTx.push(t); }
    else { groupedIncome.push(t); }
  }
  if (salaryTx.length > 0) {
    const total = salaryTx.reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
    groupedIncome.unshift({
      _id: '__salary_group', category: { name: '工资' },
      description: `${salaryTx.length} 笔合并`, amount: total.toFixed(4),
      currency: 'CNY', occurredAt: salaryTx[salaryTx.length - 1].occurredAt, _merged: true,
    });
  }

  const surplus = curIncome > 0 ? ((curIncome - curExpense) / curIncome * 100).toFixed(1) : '0';

  return (
    <div className="bg-ledger-surface rounded-xl p-4">
      <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>本月流水</h2>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <span className="text-ledger-muted">收入 <AmountDisplay amount={curIncome} className="text-ledger-success font-medium" /></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">支出 <AmountDisplay amount={curExpense} className="text-ledger-danger font-medium" /></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">盈余率 <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{surplus}%</span></span>
      </div>

      <div className="flex gap-3">
        {/* Income column */}
        <div className="flex-1">
          <button
            onClick={() => { setShowIncome(!showIncome); setShowExpense(false); }}
            className="w-full text-left text-sm hover:text-ledger-accent mb-2 pb-1 border-b border-ledger-primary/10" style={{ color: 'var(--color-text-primary)' }}
          >
            📥 本月收入 · {incomeTx.length} 笔 {showIncome ? '▴' : '▸'}
          </button>
          {showIncome && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groupedIncome.length === 0 ? (
                <div className="text-xs text-ledger-muted py-2">暂无</div>
              ) : (
                groupedIncome.slice(0, 15).map((t: any) => (
                  <div key={t._id || t.id} className={`flex items-center gap-2 text-xs py-1 ${t._merged ? 'bg-ledger-bg/50 rounded px-1 -mx-1' : ''}`}>
                    <span className="text-ledger-muted w-16 shrink-0">{new Date(t.occurredAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
                    <span className={`flex-1 truncate ${t._merged ? 'text-ledger-accent font-medium' : 'text-ledger-muted'}`}>
                      {t._merged ? '💰 工资' : (t.description || t.category?.name || '--')}
                    </span>
                    <span className="text-ledger-success font-medium shrink-0">+{(curSym[t.currency || 'CNY'] || '¥')}{parseFloat(t.amount || '0').toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Expense column */}
        <div className="flex-1">
          <button
            onClick={() => { setShowExpense(!showExpense); setShowIncome(false); }}
            className="w-full text-left text-sm hover:text-ledger-accent mb-2 pb-1 border-b border-ledger-primary/10" style={{ color: 'var(--color-text-primary)' }}
          >
            📤 本月支出 · {expenseTx.length} 笔 {showExpense ? '▴' : '▸'}
          </button>
          {showExpense && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {expenseTx.length === 0 ? (
                <div className="text-xs text-ledger-muted py-2">暂无</div>
              ) : (
                expenseTx.slice(0, 15).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs py-1">
                    <span className="text-ledger-muted w-16 shrink-0">{new Date(t.occurredAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
                    <span className="text-ledger-muted flex-1 truncate">{t.description || t.category?.name || '--'}</span>
                    <span className="text-ledger-danger font-medium shrink-0">-{(curSym[t.currency || 'CNY'] || '¥')}{parseFloat(t.amount || '0').toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
