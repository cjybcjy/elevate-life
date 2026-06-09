'use client';

import { AmountDisplay } from '../common/AmountDisplay';

interface BudgetProgress {
  id: string;
  name: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  pct: number;
  isOverBudget: boolean;
}

export default function BudgetTracker({ progress }: { progress: BudgetProgress[] }) {
  if (progress.length === 0) return null;

  return (
    <div className="bg-ledger-surface rounded-xl p-4">
      <h2 className="text-base font-bold text-white mb-3">预算执行</h2>
      <div className="space-y-3">
        {progress.map(p => (
          <div key={p.id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="text-white">{p.name}</span>
                <span className="text-xs text-ledger-muted">{p.categoryName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <AmountDisplay amount={p.spent} className="text-white" />
                <span className="text-ledger-muted">/</span>
                <AmountDisplay amount={p.budgetAmount} />
                {p.isOverBudget && (
                  <span className="text-ledger-danger font-medium">超支!</span>
                )}
              </div>
            </div>
            <div className="h-2 bg-ledger-bg rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  p.isOverBudget
                    ? 'bg-gradient-to-r from-ledger-danger to-red-400'
                    : p.pct > 80
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                      : 'bg-gradient-to-r from-green-500 to-green-400'
                }`}
                style={{ width: `${Math.min(p.pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ledger-muted mt-0.5">
              <span>{p.pct.toFixed(0)}%</span>
              <span>
                剩余 <AmountDisplay amount={p.remaining} className={p.remaining < 0 ? 'text-ledger-danger' : ''} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
