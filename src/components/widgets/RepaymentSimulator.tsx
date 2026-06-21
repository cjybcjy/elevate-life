'use client';

import { useState } from 'react';
import { simulateEarlyRepayment, RepaymentSimResult } from '@/lib/actions/repayment-sim';
import { AmountDisplay } from '../common/AmountDisplay';

interface Liability {
  id: string;
  name: string;
  currentBalance: string;
  interestRate: number;
}

interface Props {
  liabilities: Liability[];
}

export default function RepaymentSimulator({ liabilities }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraMonth, setExtraMonth] = useState(1);
  const [results, setResults] = useState<RepaymentSimResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSimulate() {
    if (!selectedId || !extraAmount) return;
    setError('');
    setLoading(true);
    const res = await simulateEarlyRepayment(selectedId, extraAmount, extraMonth);
    if (res.success && res.data) {
      setResults(res.data);
    } else {
      setError(res.error || '模拟失败');
    }
    setLoading(false);
  }

  return (
    <div className="mt-6 rounded-xl bg-ledger-surface p-4">
      <h2 className="text-base font-bold text-white mb-3">提前还款模拟</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-ledger-muted mb-1">选择负债</label>
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setResults(null); }}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">--</option>
            {liabilities.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} (余额 ¥{parseFloat(l.currentBalance).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">额外还款金额</label>
          <input
            type="text"
            inputMode="decimal"
            value={extraAmount}
            onChange={e => setExtraAmount(e.target.value)}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-36"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">还款时机(第几月)</label>
          <input
            type="text"
            inputMode="numeric"
            value={extraMonth}
            onChange={e => setExtraMonth(Number(e.target.value))}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent w-20"
          />
        </div>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading || !selectedId || !extraAmount}
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '计算中...' : '模拟'}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-ledger-danger">{error}</div>
      )}

      {results && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {results.map(r => (
            <div key={r.scenario} className="bg-ledger-bg rounded-lg p-3">
              <h3 className="text-sm font-medium text-white mb-2">{r.label}</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-ledger-muted">原月供</span>
                  <AmountDisplay amount={r.originalMonthlyPayment} className="text-white" />
                </div>
                {r.newMonthlyPayment != null && (
                  <div className="flex justify-between">
                    <span className="text-ledger-muted">新月供</span>
                    <AmountDisplay amount={r.newMonthlyPayment} className="text-green-400" />
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ledger-muted">原还清日</span>
                  <span className="text-white">{r.originalPayoffDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ledger-muted">新还清日</span>
                  <span className="text-green-400">{r.newPayoffDate}</span>
                </div>
                {r.monthsShaved > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ledger-muted">提前还清</span>
                    <span className="text-green-400">{r.monthsShaved} 个月</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-ledger-surface">
                  <span className="text-ledger-muted">节省利息</span>
                  <AmountDisplay amount={r.interestSaved} className="text-ledger-accent font-bold" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
