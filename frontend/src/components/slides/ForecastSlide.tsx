import { useState, useEffect } from 'react';
import api from '../../services/api';
import CashflowForecastChart from '../charts/CashflowForecastChart';

export default function ForecastSlide() {
  const [forecast, setForecast] = useState<any>(null);
  const [params, setParams] = useState({ incomeAdjustment: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.post('/forecast/cashflow', {
      monthlyIncome: 30000, monthlyExpense: 20000, months: 12,
      incomeAdjustment: params.incomeAdjustment,
    })
      .then((res: any) => setForecast(res.data))
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) return (
    <div className="slide-container flex items-center justify-center">
      <div className="text-ledger-muted">加载中...</div>
    </div>
  );
  if (error) return (
    <div className="slide-container flex items-center justify-center">
      <div className="text-red-400">{error}</div>
    </div>
  );

  const months = forecast?.months?.map((m: any) => m.month) || [];
  const surplus = forecast?.months?.map((m: any) => parseFloat(m.projectedSurplus)) || [];
  const cumulative = forecast?.months?.map((m: any) => parseFloat(m.cumulativeSurplus)) || [];

  return (
    <div className="slide-container">
      <h1 className="text-5xl font-light text-ledger-text mb-8">12个月现金流预测</h1>
      <CashflowForecastChart months={months} surplus={surplus} cumulative={cumulative} />
      <div className="mt-8 flex gap-8">
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">生存月数</div>
          <div className="text-3xl font-bold text-ledger-accent">{forecast?.runwayMonths || 0}</div>
        </div>
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">财务自由进度</div>
          <div className="text-3xl font-bold text-ledger-accent">23%</div>
        </div>
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">预警级别</div>
          <div className={`text-3xl font-bold ${
            forecast?.warningLevel === 'red' ? 'text-ledger-danger' :
            forecast?.warningLevel === 'yellow' ? 'text-ledger-warning' : 'text-ledger-success'
          }`}>
            {forecast?.warningLevel === 'red' ? '🔴 危险' :
             forecast?.warningLevel === 'yellow' ? '🟡 预警' : '🟢 健康'}
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-4">
        <label className="text-ledger-muted text-sm">
          收入调整:
          <input type="range" min="-50" max="50" value={params.incomeAdjustment * 100}
            onChange={(e) => setParams({ ...params, incomeAdjustment: +e.target.value / 100 })}
            className="ml-2"
          />
          {(params.incomeAdjustment * 100).toFixed(0)}%
        </label>
      </div>
    </div>
  );
}
