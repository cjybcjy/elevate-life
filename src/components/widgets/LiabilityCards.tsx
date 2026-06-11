'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';

interface Liability {
  id: string;
  name: string;
  interestRate: number;
  currentBalance: string;
  principal: string;
  termMonths: number;
  startDate: string | Date;
}

interface Transaction {
  id: string;
  liabilityId?: string | null;
  type: string;
  amount: string;
  occurredAt: string | Date;
  description?: string | null;
}

export default function LiabilityCards({
  liabilities,
  transactions = [],
}: {
  liabilities: Liability[];
  transactions?: Transaction[];
}) {
  if (liabilities.length === 0) return <div className="text-ledger-muted text-sm py-4 text-center">暂无负债</div>;

  return (
    <div className="space-y-2">
      {liabilities
        .sort((a, b) => (parseFloat(b.currentBalance) || 0) - (parseFloat(a.currentBalance) || 0))
        .map((l) => {
          const balance = parseFloat(l.currentBalance) || 0;
          const principal = parseFloat(l.principal) || 1;
          const paid = principal - balance;
          const start = new Date(l.startDate);
          const now = new Date();
          const remaining = Math.max(0, l.termMonths - ((now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())));
          const progress = Math.min((paid / principal * 100), 100);
          const repayments = transactions.filter(
            (t: Transaction) => t.liabilityId === l.id && t.type === 'EXPENSE'
          );
          const totalRepaid = repayments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

          return (
            <CollapsibleLiabilityCard
              key={l.id}
              name={l.name}
              interestRate={l.interestRate}
              balance={balance}
              principal={principal}
              paid={paid}
              remaining={remaining}
              progress={progress}
              startDate={start}
              repayments={repayments}
              totalRepaid={totalRepaid}
            />
          );
        })}
    </div>
  );
}

function CollapsibleLiabilityCard({
  name,
  interestRate,
  balance,
  principal,
  paid,
  remaining,
  progress,
  startDate,
  repayments,
  totalRepaid,
}: {
  name: string;
  interestRate: number;
  balance: number;
  principal: number;
  paid: number;
  remaining: number;
  progress: number;
  startDate: Date;
  repayments: Transaction[];
  totalRepaid: number;
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="bg-ledger-bg/50 rounded-lg p-2.5">
      {/* Row 1: colored dot + name + start date + rate + remaining */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: interestRate > 0.06 ? '#ef4444' : interestRate > 0.05 ? '#f59e0b' : '#3b82f6',
          }} />
          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
          <span className="text-xs text-ledger-muted/60 shrink-0">
            {startDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })}
          </span>
          <span className="text-xs font-medium shrink-0" style={{
            color: interestRate > 0.06 ? '#ef4444' : interestRate > 0.05 ? '#f59e0b' : '#3b82f6',
          }}>
            {(interestRate * 100).toFixed(1)}%
          </span>
        </div>
        <span className="text-xs text-ledger-muted shrink-0">{remaining}期剩余</span>
      </div>

      {/* Row 2: progress bar */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1 h-2 bg-ledger-bg rounded-full overflow-hidden">
          <div className="flex h-full">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-l-full"
              style={{ width: `${progress}%` }}
            />
            {progress < 100 && (
              <div
                className="h-full bg-gradient-to-r from-red-500/60 to-red-400/60 rounded-r-full"
                style={{ width: `${100 - progress}%` }}
              />
            )}
          </div>
        </div>
        <span className="text-xs text-green-400 font-medium shrink-0">{progress.toFixed(0)}%</span>
      </div>

      {/* Row 3: amount details + toggle history */}
      <div className="flex items-center text-xs">
        <span className="text-ledger-muted">
          余额 <AmountDisplay amount={balance} className="font-medium" />
        </span>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="text-ledger-muted hover:text-white transition-colors ml-3 flex flex-col items-start leading-tight"
        >
          <span className="inline-flex items-center gap-0.5">
            <span>{showHistory ? '▾' : '▸'}</span>
            <span>已还</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <AmountDisplay amount={paid} className="text-green-400" />
            {repayments.length > 0 && (
              <span className="text-ledger-muted/60">({repayments.length}笔)</span>
            )}
          </span>
        </button>
        <span className="text-ledger-muted ml-3">
          本金 <AmountDisplay amount={principal} />
        </span>
      </div>

      {/* Collapsible repayment history */}
      {showHistory && (
        <div className="mt-2 pt-2 border-t border-ledger-bg/60">
          {repayments.length === 0 ? (
            <div className="text-xs text-ledger-muted/50 py-1">暂无还款记录</div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {repayments.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-ledger-muted">
                  <span className="w-16 shrink-0">
                    {new Date(t.occurredAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                  <AmountDisplay amount={parseFloat(t.amount || '0')} className="text-green-400 shrink-0" />
                  <span className="truncate">{t.description || '还款'}</span>
                </div>
              ))}
              {repayments.length > 8 && (
                <div className="text-xs text-ledger-muted/50">...还有 {repayments.length - 8} 笔</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
