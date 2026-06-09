'use client';

import Link from 'next/link';
import DebtFunnelChart from '../charts/DebtFunnelChart';
import { AmountDisplay } from '../common/AmountDisplay';

interface Liability { id: string; name: string; category: string; principal: string; currentBalance: string; interestRate: number; termMonths: number; startDate: string | Date; paymentMethod: string; monthlyPayment?: string | null; }

function calculateRemaining(startDate: string | Date, termMonths: number): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, termMonths - ((now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())));
}

export default function DebtOverviewSlide({ liabilities }: { liabilities: Liability[] }) {
  const totalBalance = liabilities.reduce((sum, l) => sum + (parseFloat(l.currentBalance) || 0), 0);
  const wacr = liabilities.length > 0 ? liabilities.reduce((sum, l) => sum + (parseFloat(l.currentBalance) || 0) * l.interestRate, 0) / (totalBalance || 1) : 0;
  const funnelData = liabilities.map(l => ({ name: l.name, value: parseFloat(l.currentBalance) || 0, rate: l.interestRate * 100 }));

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">负债总览</h2>
        <Link href="/management/liabilities" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-center gap-4 mb-2 text-sm">
        <AmountDisplay amount={totalBalance} className="text-xl font-bold text-white" sensitive />
        <span className="text-ledger-muted">加权平均利率 <span className="text-ledger-accent font-medium">{(wacr * 100).toFixed(2)}%</span></span>
      </div>
      <div className="flex items-start gap-6">
        <div className="shrink-0" style={{ width: 300 }}>
          {funnelData.length > 0 ? <DebtFunnelChart data={funnelData} /> : <div className="h-[240px] flex items-center justify-center text-ledger-muted text-sm">暂无负债</div>}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
          {liabilities.sort((a, b) => (parseFloat(b.currentBalance) || 0) - (parseFloat(a.currentBalance) || 0)).map((l) => {
            const balance = parseFloat(l.currentBalance) || 0;
            const principal = parseFloat(l.principal) || 1;
            const remaining = calculateRemaining(l.startDate, l.termMonths);
            const progress = ((principal - balance) / principal * 100).toFixed(1);
            return (
              <div key={l.id} className="bg-ledger-surface rounded-lg p-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-medium text-sm">{l.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${l.interestRate > 0.06 ? 'bg-red-900/30 text-red-400' : l.interestRate > 0.05 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-blue-900/30 text-blue-400'}`}>{(l.interestRate * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-xs text-ledger-muted">
                  <span>剩余 <AmountDisplay amount={balance} className="text-white text-xs" sensitive /></span>
                  <span>{remaining}期 · 已还{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-ledger-bg rounded-full overflow-hidden mt-1.5"><div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: `${progress}%` }} /></div>
              </div>
            );
          })}
          {liabilities.length === 0 && <div className="col-span-2 text-ledger-muted text-sm py-4 text-center">暂无负债</div>}
        </div>
      </div>
    </div>
  );
}
