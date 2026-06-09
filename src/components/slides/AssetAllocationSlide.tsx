'use client';

import Link from 'next/link';
import AssetRingChart from '../charts/AssetRingChart';
import { AmountDisplay } from '../common/AmountDisplay';

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  gold_physical: { icon: '🟡', color: '#f59e0b', label: '实物黄金' },
  gold_paper: { icon: '📄', color: '#eab308', label: '纸黄金' },
  stock: { icon: '📈', color: '#ef4444', label: '股票' },
  fund: { icon: '📊', color: '#8b5cf6', label: '基金' },
  bond: { icon: '📜', color: '#06b6d4', label: '债券' },
  vehicle: { icon: '🚗', color: '#f97316', label: '车辆' },
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

interface Asset {
  id: string; name: string; category: string; balance: string; currentValue?: string;
  quantity?: number | null; stockCode?: string | null; unitPrice?: string | null;
  costPrice?: string | null; currency?: string;
}

export default function AssetAllocationSlide({ assets }: { assets: Asset[] }) {
  const categoryTotals: Record<string, number> = {};
  let totalValue = 0;
  for (const asset of assets) {
    const value = parseFloat(asset.currentValue || asset.balance || '0');
    categoryTotals[asset.category || 'other'] = (categoryTotals[asset.category || 'other'] || 0) + value;
    totalValue += value;
  }
  const ringData = Object.entries(categoryTotals)
    .map(([category, value]) => {
      const config = categoryConfig[category] || categoryConfig.other;
      return { name: config.label, value, itemStyle: { color: config.color } };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-white">资产配置</h2>
        <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-start gap-8">
        <div className="shrink-0">
          {ringData.length > 0 ? <AssetRingChart data={ringData} /> : <div className="w-[220px] h-[220px] flex items-center justify-center text-ledger-muted text-sm">暂无数据</div>}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2 content-start min-w-0">
          {assets.sort((a, b) => (parseFloat(b.currentValue || b.balance || '0')) - (parseFloat(a.currentValue || a.balance || '0'))).slice(0, 8).map((asset) => {
            const config = categoryConfig[asset.category] || categoryConfig.other;
            const value = parseFloat(asset.currentValue || asset.balance || '0');
            const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0';
            return (
              <div key={asset.id} className="bg-ledger-surface rounded-lg p-2.5 flex items-center gap-2 text-sm">
                <span>{config.icon}</span>
                <span className="text-white truncate flex-1">{asset.name}</span>
                <span className="text-ledger-muted text-xs">{pct}%</span>
                <AmountDisplay amount={value} className="text-sm font-medium" sensitive />
              </div>
            );
          })}
          {assets.length === 0 && <div className="col-span-2 text-ledger-muted text-sm py-4 text-center">暂无资产</div>}
        </div>
      </div>
    </div>
  );
}
