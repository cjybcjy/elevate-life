import { useEffect, useState } from 'react';
import api from '../../services/api';
import DebtFunnelChart from '../charts/DebtFunnelChart';
import { AmountDisplay } from '../common/AmountDisplay';

interface Liability {
  id: string;
  name: string;
  category: string;
  principal: string;
  currentBalance: string;
  interestRate: number;
  termMonths: number;
  startDate: string;
  paymentMethod: string;
  monthlyPayment: string | null;
}

export default function DebtOverviewSlide() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [wacr, setWacr] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/liabilities').then((res: any) => setLiabilities(res.data || [])),
      api.get('/forecast/wacr').then((res: any) => setWacr(res.data?.wacr || 0)),
    ])
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Calculate totals from real data
  const totalBalance = liabilities.reduce((sum, l) => sum + (parseFloat(l.currentBalance) || 0), 0);
  const totalPrincipal = liabilities.reduce((sum, l) => sum + (parseFloat(l.principal) || 0), 0);

  // Prepare funnel data
  const funnelData = liabilities.map(l => ({
    name: l.name,
    value: parseFloat(l.currentBalance) || 0,
    rate: l.interestRate * 100,
  }));

  // Calculate remaining months for each liability
  const calculateRemaining = (startDate: string, termMonths: number): number => {
    const start = new Date(startDate);
    const now = new Date();
    const elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, termMonths - elapsedMonths);
  };

  // Estimate monthly payment if not stored
  const estimateMonthlyPayment = (liability: Liability): number => {
    if (liability.monthlyPayment) {
      return parseFloat(liability.monthlyPayment) || 0;
    }
    // Simple estimation for display
    const balance = parseFloat(liability.currentBalance) || 0;
    const rate = liability.interestRate / 12;
    const months = calculateRemaining(liability.startDate, liability.termMonths);
    if (months <= 0) return 0;

    if (liability.paymentMethod === 'equal_interest') {
      const pow = Math.pow(1 + rate, months);
      return balance * rate * pow / (pow - 1);
    } else {
      return balance / months + balance * rate;
    }
  };

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
        <h1 className="text-5xl font-light text-ledger-text mb-4">负债总览</h1>
        <div className="text-7xl font-bold text-ledger-text mb-2">
          <AmountDisplay amount={totalBalance} className="text-7xl font-bold" sensitive />
        </div>
        <div className="text-ledger-muted text-lg">
          加权平均利率: <span className="text-ledger-accent font-semibold">{(wacr * 100).toFixed(2)}%</span>
          {' | '}
          原始本金: <AmountDisplay amount={totalPrincipal} sensitive />
        </div>
      </div>

      <div className="flex items-start justify-center gap-12">
        <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10">
          {funnelData.length > 0 ? (
            <DebtFunnelChart data={funnelData} />
          ) : (
            <div className="w-[500px] h-[400px] flex items-center justify-center text-ledger-muted">
              暂无负债数据
            </div>
          )}
        </div>

        <div className="space-y-4 max-w-md">
          {liabilities
            .sort((a, b) => (parseFloat(b.currentBalance) || 0) - (parseFloat(a.currentBalance) || 0))
            .map((liability) => {
              const remaining = calculateRemaining(liability.startDate, liability.termMonths);
              const monthly = estimateMonthlyPayment(liability);
              const balance = parseFloat(liability.currentBalance) || 0;
              const principal = parseFloat(liability.principal) || 1;
              const progress = ((principal - balance) / principal * 100).toFixed(1);

              return (
                <div key={liability.id} className="bg-ledger-surface rounded-2xl p-5 min-w-[300px] border border-ledger-primary/10">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-ledger-text font-semibold text-lg">{liability.name}</span>
                    <span className={`text-sm px-2 py-0.5 rounded ${
                      liability.interestRate > 0.06
                        ? 'bg-red-900/30 text-red-400'
                        : liability.interestRate > 0.05
                        ? 'bg-yellow-900/30 text-yellow-400'
                        : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {(liability.interestRate * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-ledger-muted text-sm">剩余应还</span>
                    <AmountDisplay amount={balance} className="text-lg font-medium" sensitive />
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-ledger-muted text-sm">月供</span>
                    <span className="text-ledger-text">¥{monthly.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="flex justify-between items-center mb-3">
                    <span className="text-ledger-muted text-sm">剩余期数</span>
                    <span className="text-ledger-text">{remaining} 期</span>
                  </div>

                  <div className="w-full h-2 bg-ledger-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-ledger-muted mt-1">
                    已还款 {progress}%
                  </div>
                </div>
              );
            })}

          {liabilities.length === 0 && (
            <div className="text-ledger-muted text-center py-8">
              暂无负债数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
