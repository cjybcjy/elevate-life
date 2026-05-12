import { useEffect, useState } from 'react';
import api from '../../services/api';
import AssetRingChart from '../charts/AssetRingChart';
import { BreathingCard } from '../common/BreathingCard';
import { AmountDisplay } from '../common/AmountDisplay';

export default function AssetAllocationSlide() {
  const [_assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    api.get('/assets').then((res: any) => setAssets(res.data || []));
  }, []);

  const ringData = [
    { name: '房产', value: 2000000 },
    { name: '现金', value: 900000 },
    { name: '黄金', value: 680000 },
    { name: '股票', value: 500000 },
  ];

  return (
    <div className="slide-container">
      <h1 className="text-5xl font-light text-ledger-text mb-8">资产配置</h1>
      <div className="flex items-center gap-12">
        <AssetRingChart data={ringData} />
        <div className="space-y-4">
          <BreathingCard>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🟡</span>
              <div>
                <div className="text-ledger-muted text-sm">黄金</div>
                <AmountDisplay amount={680000} className="text-xl font-semibold" />
                <div className="text-ledger-success text-sm">+1.2%</div>
              </div>
            </div>
          </BreathingCard>
          {[
            { icon: '🏠', name: '房产', amount: 2000000 },
            { icon: '💰', name: '现金', amount: 900000 },
            { icon: '📈', name: '股票', amount: 500000 },
          ].map((item) => (
            <div key={item.name} className="bg-ledger-surface rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="text-ledger-muted text-sm">{item.name}</div>
                <AmountDisplay amount={item.amount} className="text-xl font-semibold" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
