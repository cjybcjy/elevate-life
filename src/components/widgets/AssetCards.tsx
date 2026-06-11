'use client';

import { AmountDisplay } from '../common/AmountDisplay';

const icons: Record<string, string> = { real_estate: '🏠', cash: '💰', stock: '📈', fund: '📊', bond: '📜', vehicle: '🚗', gold_physical: '🟡', gold_paper: '📄', other: '📦' };

export default function AssetCards({ assets, total }: { assets: any[]; total: number }) {
  if (assets.length === 0) return <div className="text-ledger-muted text-sm py-4 text-center">暂无资产</div>;
  return assets.sort((a: any, b: any) => parseFloat(b.balance || '0') - parseFloat(a.balance || '0')).slice(0, 6).map((a: any) => {
    const pct = total > 0 ? (parseFloat(a.balance || '0') / total * 100).toFixed(1) : '0';
    return (
      <div key={a.id} className="flex items-center gap-2 text-sm">
        <span>{icons[a.category] || '📦'}</span>
        <span className="text-white truncate flex-1">{a.name}</span>
        <span className="text-ledger-muted text-xs w-10 text-right">{pct}%</span>
        <AmountDisplay amount={parseFloat(a.balance || '0')} className="text-sm w-24 text-right" />
      </div>
    );
  });
}
