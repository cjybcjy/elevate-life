'use client';

import Link from 'next/link';
import CashflowForecastChart from '../charts/CashflowForecastChart';

interface ForecastMonth { month: string; projectedSurplus: string; cumulativeSurplus: string; }
interface Props { forecast: { months: ForecastMonth[]; warningLevel: string }; netWorth: number; }

export default function ForecastSlide({ forecast, netWorth }: Props) {
  const months = forecast?.months?.map((m) => m.month) || [];
  const cumulative = forecast?.months?.map((m) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const freedomTarget = 20000 * 12 * 25;
  const freedomProgress = freedomTarget > 0 ? Math.min(100, (netWorth / freedomTarget) * 100) : 0;
  const runwayMonths = cumulative.filter((v) => v >= 0).length;
  const warningLabel: Record<string, string> = { green: '健康', yellow: '预警', red: '危险' };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">现金流预测</h2>
        <Link href="/management/ledger" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-center gap-4 mb-2 text-sm">
        <span className="text-ledger-muted">生存月数 <span className="text-ledger-accent font-bold">{runwayMonths} 个月</span></span>
        <span className="text-ledger-muted">财务自由 <span className="text-ledger-accent font-bold">{freedomProgress.toFixed(1)}%</span></span>
        <span className="text-ledger-muted">预警 <span className="font-bold">{warningLabel[forecast?.warningLevel] || '健康'}</span></span>
      </div>
      <div className="bg-ledger-surface rounded-lg p-4" style={{ height: 280 }}>
        <CashflowForecastChart months={months} cumulative={cumulative} />
      </div>
    </div>
  );
}
