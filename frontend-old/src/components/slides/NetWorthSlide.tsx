import { useEffect, useState } from 'react';
import api from '../../services/api';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { AmountDisplay } from '../common/AmountDisplay';
import MiniTrendChart from '../charts/MiniTrendChart';

interface AssetSummary {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

export default function NetWorthSlide() {
  const [summary, setSummary] = useState<AssetSummary>({
    totalAssets: '0',
    totalLiabilities: '0',
    netWorth: '0',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/assets/summary')
      .then((res: any) => {
        setSummary({
          totalAssets: res.data?.totalAssets || '0',
          totalLiabilities: res.data?.totalLiabilities || '0',
          netWorth: res.data?.netWorth || '0',
        });
      })
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const netWorthValue = parseFloat(summary.netWorth) || 0;
  const totalAssetsValue = parseFloat(summary.totalAssets) || 0;
  const totalLiabilitiesValue = parseFloat(summary.totalLiabilities) || 0;

  // Calculate surplus rate based on net worth vs liabilities
  const surplusRate = totalAssetsValue > 0
    ? ((netWorthValue / totalAssetsValue) * 100).toFixed(1)
    : '0';

  // Health indicator
  const getHealthStatus = () => {
    if (netWorthValue > totalLiabilitiesValue * 2) return { text: '优秀', color: 'text-ledger-success' };
    if (netWorthValue > totalLiabilitiesValue) return { text: '良好', color: 'text-ledger-success' };
    if (netWorthValue > 0) return { text: '一般', color: 'text-ledger-warning' };
    return { text: '危险', color: 'text-ledger-danger' };
  };

  const health = getHealthStatus();

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
        <h1 className="text-5xl font-light text-ledger-text mb-4">净资产</h1>
        <div className="text-7xl font-bold text-ledger-text mb-2">
          <AnimatedNumber value={netWorthValue} prefix="¥" />
        </div>
        <div className="text-ledger-muted text-lg">
          资产健康度: <span className={health.color}>{health.text}</span> | 净资产率: <span className="text-ledger-success">{surplusRate}%</span>
        </div>
      </div>

      <div className="flex justify-center gap-8 mb-12">
        <div className="bg-ledger-surface rounded-2xl p-8 min-w-[240px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">总资产</div>
          <AmountDisplay amount={totalAssetsValue} className="text-3xl font-semibold text-ledger-success" sensitive />
        </div>
        <div className="bg-ledger-surface rounded-2xl p-8 min-w-[240px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">总负债</div>
          <AmountDisplay amount={totalLiabilitiesValue} className="text-3xl font-semibold text-ledger-danger" sensitive />
        </div>
        <div className="bg-ledger-surface rounded-2xl p-8 min-w-[240px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">资产负债比</div>
          <div className="text-3xl font-semibold text-ledger-accent">
            {totalLiabilitiesValue > 0
              ? (totalAssetsValue / totalLiabilitiesValue).toFixed(2)
              : '∞'}
          </div>
        </div>
      </div>

      <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10">
        <h3 className="text-lg font-medium text-ledger-text mb-4">净资产趋势</h3>
        <MiniTrendChart
          data={[3000000, 3100000, 3050000, 3200000, 3150000, netWorthValue]}
          labels={['1月', '2月', '3月', '4月', '5月', '本月']}
        />
      </div>
    </div>
  );
}
