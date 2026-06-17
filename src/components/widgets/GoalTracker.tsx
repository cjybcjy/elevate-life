'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';

interface Goal {
  id: string;
  name: string;
  targetAmount: { toString: () => string } | number;
  currentAmount: { toString: () => string } | number;
  deadline?: Date | string | null;
  icon?: string | null;
  color?: string | null;
  asset?: { name: string } | null;
}

export default function GoalTracker({ goals }: { goals: Goal[] }) {
  const [nowMs] = useState(() => Date.now());

  if (goals.length === 0) return null;

  return (
    <div className="bg-ledger-surface rounded-xl p-4">
      <h2 className="text-base font-bold text-ledger-text mb-3">储蓄目标</h2>
      <div className="grid grid-cols-2 gap-3">
        {goals.map(g => {
          const current = typeof g.currentAmount === 'number'
            ? g.currentAmount
            : parseFloat(g.currentAmount?.toString?.() || '0');
          const target = typeof g.targetAmount === 'number'
            ? g.targetAmount
            : parseFloat(g.targetAmount?.toString?.() || '1');
          const pct = target > 0 ? Math.min((current / target * 100), 100) : 0;
          const remaining = Math.max(0, target - current);
          const deadlineDate = g.deadline ? (g.deadline instanceof Date ? g.deadline : new Date(g.deadline)) : null;
          const daysLeft = deadlineDate
            ? Math.max(0, Math.ceil((deadlineDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)))
            : null;

          return (
            <div key={g.id} className="bg-ledger-bg rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {g.icon && <span className="text-lg">{g.icon}</span>}
                <span className="text-sm font-medium text-ledger-text">{g.name}</span>
              </div>
              {/* Progress ring */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-ledger-bg" strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={g.color || '#3b82f6'}
                      strokeWidth="4"
                      strokeDasharray={`${pct * 0.974} 97.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-ledger-text">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-ledger-muted">已存</span>
                    <AmountDisplay amount={current} className="text-ledger-text" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ledger-muted">目标</span>
                    <AmountDisplay amount={target} className="text-ledger-muted" />
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ledger-muted">差距</span>
                      <AmountDisplay amount={remaining} className="text-ledger-accent" />
                    </div>
                  )}
                  {daysLeft !== null && (
                    <div className="flex justify-between">
                      <span className="text-ledger-muted">剩余</span>
                      <span className={daysLeft < 30 ? 'text-ledger-danger' : 'text-ledger-text'}>
                        {daysLeft} 天
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
