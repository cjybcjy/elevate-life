import { useState, useEffect } from 'react';
import api from '../../services/api';
import CashflowForecastChart from '../charts/CashflowForecastChart';

interface ForecastMonth {
  month: string;
  projectedIncome: number;
  projectedExpense: number;
  projectedSurplus: number;
  cumulativeSurplus: number;
}

interface ForecastData {
  months: ForecastMonth[];
  runwayMonths: number;
  minSurplusMonth: string;
  warningLevel: 'green' | 'yellow' | 'red';
}

interface AssetSummary {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

export default function ForecastSlide() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [params, setParams] = useState({ incomeAdjustment: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      api.post('/forecast/cashflow', {
        monthlyIncome: 30000,
        monthlyExpense: 20000,
        months: 12,
        incomeAdjustment: params.incomeAdjustment,
      }).then((res: any) => {
        // Convert Decimal objects to numbers
        const data = res.data;
        if (data?.months) {
          data.months = data.months.map((m: any) => ({
            month: m.month,
            projectedIncome: parseFloat(m.projectedIncome) || 0,
            projectedExpense: parseFloat(m.projectedExpense) || 0,
            projectedSurplus: parseFloat(m.projectedSurplus) || 0,
            cumulativeSurplus: parseFloat(m.cumulativeSurplus) || 0,
          }));
        }
        setForecast(data);
      }),
      api.get('/assets/summary').then((res: any) => setSummary(res.data)),
    ])
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [params]);

  const months = forecast?.months?.map((m) => m.month) || [];
  const surplus = forecast?.months?.map((m) => m.projectedSurplus) || [];
  const cumulative = forecast?.months?.map((m) => m.cumulativeSurplus) || [];

  // Calculate financial freedom progress
  // Formula: net worth / (annual expenses * 25) - simplified 4% rule
  const netWorth = parseFloat(summary?.netWorth || '0');
  const annualExpense = 20000 * 12;
  const freedomTarget = annualExpense * 25;
  const freedomProgress = freedomTarget > 0
    ? Math.min(100, (netWorth / freedomTarget) * 100)
    : 0;

  const warningConfig = {
    green: { text: '健康', color: 'text-ledger-success', bg: 'bg-green-900/30', emoji: '' },
    yellow: { text: '预警', color: 'text-ledger-warning', bg: 'bg-yellow-900/30', emoji: '' },
    red: { text: '危险', color: 'text-ledger-danger', bg: 'bg-red-900/30', emoji: '' },
  };

  const warning = forecast?.warningLevel
    ? warningConfig[forecast.warningLevel]
    : warningConfig.green;

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
        <h1 className="text-5xl font-light text-ledger-text mb-4">12个月现金流预测</h1>
        <p className="text-ledger-muted">基于当前收支情况的未来现金流模拟</p>
      </div>

      <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10 mb-8">
        <CashflowForecastChart months={months} surplus={surplus} cumulative={cumulative} />
      </div>

      <div className="flex justify-center gap-8 mb-8">
        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">生存月数</div>
          <div className="text-3xl font-bold text-ledger-accent">
            {forecast?.runwayMonths || 0}
          </div>
          <div className="text-xs text-ledger-muted mt-1">个月</div>
        </div>

        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">财务自由进度</div>
          <div className="text-3xl font-bold text-ledger-accent">
            {freedomProgress.toFixed(1)}%
          </div>
          <div className="w-full h-2 bg-ledger-bg rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              style={{ width: `${freedomProgress}%` }}
            />
          </div>
        </div>

        <div className={`rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10 ${warning.bg}`}>
          <div className="text-ledger-muted text-sm mb-2">预警级别</div>
          <div className={`text-3xl font-bold ${warning.color}`}>
            {warning.text}
          </div>
        </div>

        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">最低盈余月份</div>
          <div className="text-xl font-bold text-ledger-text">
            {forecast?.minSurplusMonth || '-'}
          </div>
        </div>
      </div>

      <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10 max-w-xl mx-auto">
        <label className="flex items-center justify-between text-ledger-muted text-sm">
          <span>收入调整模拟</span>
          <span className="text-ledger-text font-medium">
            {(params.incomeAdjustment * 100).toFixed(0)}%
          </span>
        </label>
        <input
          type="range"
          min="-50"
          max="50"
          value={params.incomeAdjustment * 100}
          onChange={(e) => setParams({ ...params, incomeAdjustment: +e.target.value / 100 })}
          className="w-full mt-3 accent-blue-500"
        />
        <div className="flex justify-between text-xs text-ledger-muted mt-1">
          <span>-50% (降薪)</span>
          <span>0% (当前)</span>
          <span>+50% (加薪)</span>
        </div>
      </div>
    </div>
  );
}
