'use client';

import { AmountDisplay } from '../common/AmountDisplay';

interface Asset {
  id: string;
  name: string;
  category: string;
  balance: string;
  liquidityTier?: string | null;
}

interface Props {
  assets: Asset[];
  totalAssets: number;
}

const liquidityLabel: Record<string, { label: string; color: string }> = {
  'T+0': { label: '即时可用', color: '#10b981' },
  'T+1': { label: '次日到账', color: '#3b82f6' },
  'T+7': { label: '周内到账', color: '#f59e0b' },
  long_term: { label: '长期资产', color: '#8b5cf6' },
};

const categoryRisk: Record<string, { level: string; color: string; riskScore: number }> = {
  cash: { level: '极低', color: '#10b981', riskScore: 0 },
  real_estate: { level: '中低', color: '#3b82f6', riskScore: 3 },
  bond: { level: '中低', color: '#06b6d4', riskScore: 2 },
  gold_physical: { level: '中', color: '#f59e0b', riskScore: 5 },
  gold_paper: { level: '中', color: '#eab308', riskScore: 5 },
  fund: { level: '中高', color: '#8b5cf6', riskScore: 7 },
  stock: { level: '高', color: '#ef4444', riskScore: 9 },
  vehicle: { level: '中低', color: '#f97316', riskScore: 2 },
  other: { level: '未知', color: '#94a3b8', riskScore: 1 },
};

export default function AllocationAnalysis({ assets, totalAssets }: Props) {
  if (assets.length === 0) return null;

  // Liquidity tier aggregation
  const tierTotals: Record<string, number> = {};
  for (const a of assets) {
    const tier = a.liquidityTier || 'long_term';
    tierTotals[tier] = (tierTotals[tier] || 0) + parseFloat(a.balance || '0');
  }

  // Risk distribution
  const riskTotals: Record<string, { amount: number; color: string }> = {};
  let totalRiskScore = 0;
  for (const a of assets) {
    const risk = categoryRisk[a.category] || categoryRisk.other;
    if (!riskTotals[risk.level]) riskTotals[risk.level] = { amount: 0, color: risk.color };
    riskTotals[risk.level].amount += parseFloat(a.balance || '0');
    totalRiskScore += risk.riskScore * parseFloat(a.balance || '0');
  }
  const avgRiskScore = totalAssets > 0 ? totalRiskScore / totalAssets : 0;

  // Concentration check
  const maxAsset = assets.reduce((max, a) =>
    parseFloat(a.balance || '0') > parseFloat(max.balance || '0') ? a : max, assets[0]);
  const maxAssetPct = totalAssets > 0 ? parseFloat(maxAsset.balance || '0') / totalAssets * 100 : 0;

  const catTotals: Record<string, number> = {};
  for (const a of assets) {
    catTotals[a.category] = (catTotals[a.category] || 0) + parseFloat(a.balance || '0');
  }
  const maxCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const maxCatPct = totalAssets > 0 ? (maxCat?.[1] || 0) / totalAssets * 100 : 0;

  return (
    <div className="bg-ledger-surface rounded-xl p-4 mt-4">
      <h2 className="text-base font-bold text-white mb-3">配置分析</h2>
      <div className="grid grid-cols-3 gap-4">
        {/* Liquidity Tiers */}
        <div>
          <h3 className="text-xs text-ledger-muted mb-2">流动性分层</h3>
          <div className="space-y-1.5">
            {Object.entries(liquidityLabel).map(([tier, info]) => {
              const amount = tierTotals[tier] || 0;
              const pct = totalAssets > 0 ? (amount / totalAssets * 100) : 0;
              if (amount === 0) return null;
              return (
                <div key={tier} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                  <span className="text-ledger-muted w-14">{info.label}</span>
                  <div className="flex-1 h-1 bg-ledger-bg rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                  </div>
                  <AmountDisplay amount={amount} className="w-18 text-right" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Distribution */}
        <div>
          <h3 className="text-xs text-ledger-muted mb-2">
            风险分布
            <span className="ml-1 text-white font-medium">
              均分 {avgRiskScore.toFixed(1)}/10
            </span>
          </h3>
          <div className="space-y-1.5">
            {Object.entries(riskTotals)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([level, info]) => {
                const pct = totalAssets > 0 ? (info.amount / totalAssets * 100) : 0;
                return (
                  <div key={level} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                    <span className="text-ledger-muted w-8">{level}</span>
                    <div className="flex-1 h-1 bg-ledger-bg rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                    </div>
                    <span className="text-white w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Concentration Warnings */}
        <div>
          <h3 className="text-xs text-ledger-muted mb-2">集中度预警</h3>
          <div className="space-y-2 text-xs">
            <div className={`p-2 rounded-lg ${maxAssetPct > 50 ? 'bg-red-900/20 border border-red-500/30' : 'bg-ledger-bg'}`}>
              <span className="text-ledger-muted">最大单资产 </span>
              <span className="text-white font-medium">{maxAsset.name}</span>
              <div className={`mt-0.5 ${maxAssetPct > 50 ? 'text-red-400' : 'text-ledger-muted'}`}>
                占比 {maxAssetPct.toFixed(1)}%
                {maxAssetPct > 50 && ' ⚠️ 集中度过高'}
              </div>
            </div>
            <div className={`p-2 rounded-lg ${maxCatPct > 60 ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-ledger-bg'}`}>
              <span className="text-ledger-muted">最大类别占比 </span>
              <div className={`mt-0.5 ${maxCatPct > 60 ? 'text-yellow-400' : 'text-ledger-muted'}`}>
                {maxCatPct.toFixed(1)}%
                {maxCatPct > 60 && ' ⚠️ 建议分散'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-ledger-bg">
              <span className="text-ledger-muted">应急覆盖 </span>
              <span className={`font-medium ${(tierTotals['T+0'] || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tierTotals['T+0'] ? '✓ 有流动资金' : '⚠ 无即时可用资金'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
