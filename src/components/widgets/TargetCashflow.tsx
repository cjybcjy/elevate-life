'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';

export default function TargetCashflow({
  monthlyIncome,
  monthlyExpense,
  currentCash,
}: {
  monthlyIncome: number;
  monthlyExpense: number;
  currentCash: number;
}) {
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01');

  const surplus = monthlyIncome - monthlyExpense;
  const target = parseFloat(targetAmount) || 0;
  const remaining = target - currentCash;
  const monthsNeeded = surplus > 0 && remaining > 0 ? Math.ceil(remaining / surplus) : null;
  const etaDate = monthsNeeded ? (() => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + monthsNeeded);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  })() : null;

  return (
    <div className="bg-ledger-bg/50 rounded-lg p-3 border border-ledger-primary/10">
      <div className="text-sm font-medium text-white mb-3">目标现金流</div>

      <div className="flex flex-wrap gap-2 items-end mb-3">
        <div>
          <label className="block text-xs text-ledger-muted mb-1">目标金额</label>
          <input
            type="number"
            step="10000"
            value={targetAmount}
            onChange={e => setTargetAmount(e.target.value)}
            className="w-28 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
            placeholder="如 1000000"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-ledger-surface/50 rounded p-2">
          <div className="text-ledger-muted">月盈余</div>
          <AmountDisplay amount={surplus} className="text-white font-medium" sensitive />
        </div>
        <div className="bg-ledger-surface/50 rounded p-2">
          <div className="text-ledger-muted">当前现金流</div>
          <AmountDisplay amount={currentCash} className="text-white font-medium" sensitive />
        </div>
        <div className="bg-ledger-surface/50 rounded p-2">
          <div className="text-ledger-muted">差距</div>
          <AmountDisplay amount={Math.max(0, remaining)} className={remaining <= 0 ? 'text-green-400 font-medium' : 'text-white font-medium'} sensitive />
        </div>
      </div>

      {/* ETA */}
      {target > 0 && (
        <div className="bg-ledger-accent/10 rounded-lg p-3 text-center border border-ledger-accent/20">
          {monthsNeeded === null ? (
            <div className="text-sm text-ledger-muted">
              {surplus <= 0 ? '月支出大于收入，无法达成目标' : remaining <= 0 ? '🎉 已达成！当前现金流已超目标' : '请输入目标金额'}
            </div>
          ) : (
            <div>
              <div className="text-xs text-ledger-muted mb-1">预计达成时间</div>
              <div className="text-xl font-bold text-white">
                {etaDate}
                <span className="text-sm text-ledger-muted ml-2">({monthsNeeded} 个月)</span>
              </div>
              <div className="text-xs text-ledger-muted mt-1">
                每月盈余 <AmountDisplay amount={surplus} className="text-ledger-success" sensitive /> × {monthsNeeded} 月 = <AmountDisplay amount={surplus * monthsNeeded} className="text-white" sensitive />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
