import { useEffect, useState } from 'react';
import api from '../../services/api';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { AmountDisplay } from '../common/AmountDisplay';
import MiniTrendChart from '../charts/MiniTrendChart';

export default function NetWorthSlide({ slideIndex: _slideIndex }: { slideIndex: number }) {
  const [summary, setSummary] = useState({ totalAssets: 0, totalLiabilities: 0, netWorth: 0 });

  useEffect(() => {
    api.get('/assets/summary').then((res: any) => {
      setSummary({
        totalAssets: parseFloat(res.data.totalAssets) || 0,
        totalLiabilities: parseFloat(res.data.totalLiabilities) || 0,
        netWorth: parseFloat(res.data.netWorth) || 0,
      });
    });
  }, []);

  return (
    <div className="slide-container">
      <h1 className="text-5xl font-light text-ledger-text mb-2">净资产</h1>
      <div className="text-7xl font-bold text-ledger-text mb-8">
        <AnimatedNumber value={summary.netWorth} prefix="¥" />
      </div>
      <div className="flex gap-8 mb-12">
        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[200px] text-center">
          <div className="text-ledger-muted text-sm mb-2">总资产</div>
          <AmountDisplay amount={summary.totalAssets} className="text-2xl font-semibold text-ledger-success" />
        </div>
        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[200px] text-center">
          <div className="text-ledger-muted text-sm mb-2">总负债</div>
          <AmountDisplay amount={summary.totalLiabilities} className="text-2xl font-semibold text-ledger-danger" />
        </div>
      </div>
      <div className="w-full max-w-2xl">
        <MiniTrendChart data={[3000000, 3100000, 3050000, 3200000, 3150000, 3456789]} labels={['1月', '2月', '3月', '4月', '5月', '6月']} />
      </div>
      <div className="mt-6 text-ledger-muted text-sm">
        资产健康度: <span className="text-ledger-success">良好</span> | 盈余率: <span className="text-ledger-success">24%</span>
      </div>
    </div>
  );
}
