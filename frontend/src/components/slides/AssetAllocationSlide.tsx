import { useEffect, useState } from 'react';
import api from '../../services/api';
import AssetRingChart from '../charts/AssetRingChart';
import { AmountDisplay } from '../common/AmountDisplay';

interface Asset {
  id: string;
  name: string;
  category: string;
  balance: string;
  currentValue: string;
  quantity: number | null;
  stockCode: string | null;
  unitPrice: string | null;
  currency: string;
  isEncrypted: boolean;
  liquidityTier: string | null;
}

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  gold: { icon: '🟡', color: '#f59e0b', label: '黄金' },
  stock: { icon: '📈', color: '#ef4444', label: '股票' },
  fund: { icon: '📊', color: '#8b5cf6', label: '基金' },
  bond: { icon: '📜', color: '#06b6d4', label: '债券' },
  vehicle: { icon: '🚗', color: '#f97316', label: '车辆' },
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

export default function AssetAllocationSlide() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = () => {
    setLoading(true);
    setError('');
    api.get('/assets')
      .then((res: any) => setAssets(res.data || []))
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  // Calculate ring chart data from real assets (using currentValue)
  const categoryTotals: Record<string, number> = {};
  let totalValue = 0;

  for (const asset of assets) {
    const value = parseFloat(asset.currentValue) || parseFloat(asset.balance) || 0;
    const category = asset.category || 'other';
    categoryTotals[category] = (categoryTotals[category] || 0) + value;
    totalValue += value;
  }

  const ringData = Object.entries(categoryTotals)
    .map(([category, value]) => {
      const config = categoryConfig[category] || categoryConfig.other;
      return {
        name: config.label,
        value,
        itemStyle: { color: config.color },
      };
    })
    .sort((a, b) => b.value - a.value);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-ledger-muted">加载中...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-red-400">{error}</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-light text-ledger-text mb-4">资产配置</h1>
        <p className="text-ledger-muted">总资产 <AmountDisplay amount={totalValue} className="text-2xl font-semibold" sensitive /></p>
      </div>

      <div className="flex items-start justify-center gap-12">
        <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10">
          {ringData.length > 0 ? (
            <AssetRingChart data={ringData} />
          ) : (
            <div className="w-[300px] h-[300px] flex items-center justify-center text-ledger-muted">
              暂无资产数据
            </div>
          )}
        </div>

        <div className="space-y-4 max-w-md w-full">
          {assets
            .sort((a, b) => {
              const aVal = parseFloat(a.currentValue) || parseFloat(a.balance) || 0;
              const bVal = parseFloat(b.currentValue) || parseFloat(b.balance) || 0;
              return bVal - aVal;
            })
            .map((asset) => {
              const config = categoryConfig[asset.category] || categoryConfig.other;
              const value = parseFloat(asset.currentValue) || parseFloat(asset.balance) || 0;
              const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0';
              const isGold = asset.category === 'gold';
              const isStock = asset.category === 'stock';
              const isAutoValued = isGold || isStock;

              return (
                <div key={asset.id} className={`bg-ledger-surface rounded-2xl p-4 border border-ledger-primary/10 ${isAutoValued ? 'border-l-4' : ''}`} style={isAutoValued ? { borderLeftColor: config.color } : {}}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-ledger-text font-medium truncate">{asset.name}</span>
                        <span className="text-ledger-muted text-xs">{percentage}%</span>
                      </div>

                      <AmountDisplay amount={value} className="text-lg font-semibold" sensitive />

                      {/* Auto-valued asset details */}
                      {isAutoValued && asset.quantity && (
                        <div className="text-ledger-muted text-xs mt-1">
                          {isGold && (
                            <>
                              {asset.quantity.toLocaleString()} 克
                              {asset.unitPrice && (
                                <span className="ml-2">@ ¥{parseFloat(asset.unitPrice).toLocaleString()}/克</span>
                              )}
                            </>
                          )}
                          {isStock && (
                            <>
                              {asset.quantity.toLocaleString()} 股
                              {asset.stockCode && (
                                <span className="ml-2 text-ledger-accent">[{asset.stockCode}]</span>
                              )}
                              {asset.unitPrice && (
                                <span className="ml-2">@ ¥{parseFloat(asset.unitPrice).toLocaleString()}/股</span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Manual asset */}
                      {!isAutoValued && (
                        <div className="text-ledger-muted text-xs mt-1">
                          用户自填金额
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-ledger-bg rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, backgroundColor: config.color }}
                    />
                  </div>
                </div>
              );
            })}

          {assets.length === 0 && (
            <div className="text-ledger-muted text-center py-8">
              暂无资产数据，请先在系统中添加资产
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
