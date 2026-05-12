import { useEffect, useState } from 'react';
import api from '../../services/api';
import DebtFunnelChart from '../charts/DebtFunnelChart';

export default function DebtOverviewSlide() {
  const [wacr, setWacr] = useState(0);
  useEffect(() => { api.get('/forecast/wacr').then((res: any) => setWacr(res.data?.wacr || 0)); }, []);

  const funnelData = [
    { name: '信用贷', value: 50000, rate: 7.8 },
    { name: '车贷', value: 150000, rate: 5.2 },
    { name: '房贷', value: 1000000, rate: 4.1 },
  ];

  return (
    <div className="slide-container">
      <h1 className="text-5xl font-light text-ledger-text mb-2">负债总览</h1>
      <div className="text-7xl font-bold text-ledger-text mb-4">¥1,200,000.00</div>
      <div className="text-ledger-muted mb-8">加权平均利率: {(wacr * 100).toFixed(2)}%</div>
      <div className="flex items-center gap-12">
        <DebtFunnelChart data={funnelData} />
        <div className="space-y-4">
          {[
            { name: '房贷', remaining: 72, monthly: 5432 },
            { name: '车贷', remaining: 12, monthly: 3200 },
            { name: '信用贷', remaining: 24, monthly: 2200 },
          ].map((item) => (
            <div key={item.name} className="bg-ledger-surface rounded-2xl p-4 min-w-[250px]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-ledger-text font-semibold">{item.name}</span>
                <span className="text-ledger-muted text-sm">剩余{item.remaining}期</span>
              </div>
              <div className="text-lg">月供 ¥{item.monthly.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
