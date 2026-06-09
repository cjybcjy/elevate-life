'use client';

import Link from 'next/link';
import { AmountDisplay } from '../common/AmountDisplay';

interface Props { totalAssets: number; totalLiabilities: number; netWorth: number; }

export default function NetWorthSlide({ totalAssets, totalLiabilities, netWorth }: Props) {
  const surplusRate = totalAssets > 0 ? ((netWorth / totalAssets) * 100).toFixed(1) : '0';
  const getHealthStatus = () => {
    if (netWorth > totalLiabilities * 2) return { text: '优秀', color: 'text-ledger-success' };
    if (netWorth > totalLiabilities) return { text: '良好', color: 'text-ledger-success' };
    if (netWorth > 0) return { text: '一般', color: 'text-ledger-warning' };
    return { text: '危险', color: 'text-ledger-danger' };
  };
  const health = getHealthStatus();

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-white">净资产</h2>
        <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-bold text-white">¥{netWorth.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
        <span className="text-sm text-ledger-muted pb-1">净资产率 <span className="text-ledger-success">{surplusRate}%</span> · 健康度 <span className={health.color}>{health.text}</span></span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-ledger-surface rounded-lg p-3 text-center">
          <div className="text-xs text-ledger-muted">总资产</div>
          <AmountDisplay amount={totalAssets} className="text-lg font-semibold text-ledger-success" sensitive />
        </div>
        <div className="bg-ledger-surface rounded-lg p-3 text-center">
          <div className="text-xs text-ledger-muted">总负债</div>
          <AmountDisplay amount={totalLiabilities} className="text-lg font-semibold text-ledger-danger" sensitive />
        </div>
        <div className="bg-ledger-surface rounded-lg p-3 text-center">
          <div className="text-xs text-ledger-muted">净资产率</div>
          <div className="text-lg font-semibold text-ledger-success">{surplusRate}%</div>
        </div>
      </div>
    </div>
  );
}
