import { useEffect, useState } from 'react';
import api from '../../services/api';
import ScissorChart from '../charts/ScissorChart';
import { AmountDisplay } from '../common/AmountDisplay';

interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  essentialExpense: number;
  surplus: number;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  description: string;
  occurredAt: string;
}

export default function ScissorChartSlide() {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    Promise.all([
      api.get(`/transactions/summary?year=${year}&month=${month}`)
        .then((res: any) => setSummary(res.data)),
      api.get('/transactions')
        .then((res: any) => setTransactions(res.data || [])),
    ])
      .catch((err: any) => {
        setError('数据加载失败，请稍后重试');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build 12-month data from transactions
  const months: string[] = [];
  const incomeData: number[] = [];
  const expenseData: number[] = [];

  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);

    // Aggregate transactions for this month
    const monthIncome = transactions
      .filter(t => {
        const tDate = new Date(t.occurredAt);
        return t.type === 'income' && tDate.getFullYear() === d.getFullYear() && tDate.getMonth() === d.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const monthExpense = transactions
      .filter(t => {
        const tDate = new Date(t.occurredAt);
        return t.type === 'expense' && tDate.getFullYear() === d.getFullYear() && tDate.getMonth() === d.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);

    incomeData.push(monthIncome);
    expenseData.push(monthExpense);
  }

  // If no transaction data for past months, use current month's values as fallback
  const currentIncome = summary?.income || 0;
  const currentExpense = summary?.expense || 0;

  for (let i = 0; i < 12; i++) {
    if (incomeData[i] === 0) incomeData[i] = currentIncome;
    if (expenseData[i] === 0) expenseData[i] = currentExpense;
  }

  // Calculate surplus rate and warning
  const surplusRate = currentIncome > 0
    ? (((currentIncome - currentExpense) / currentIncome) * 100).toFixed(1)
    : '0';

  const getWarningLevel = () => {
    const rate = parseFloat(surplusRate);
    if (rate > 20) return { text: '健康', color: 'text-ledger-success', bg: 'bg-green-900/30' };
    if (rate > 10) return { text: '预警', color: 'text-ledger-warning', bg: 'bg-yellow-900/30' };
    return { text: '危险', color: 'text-ledger-danger', bg: 'bg-red-900/30' };
  };

  const warning = getWarningLevel();

  // Survival line = essential expenses or 50% of income
  const survivalLine = summary?.essentialExpense
    ? summary.essentialExpense
    : currentIncome * 0.5;

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
        <h1 className="text-5xl font-light text-ledger-text mb-4">收支剪刀图</h1>
        <p className="text-ledger-muted">近12个月收支趋势分析</p>
      </div>

      <div className="bg-ledger-surface rounded-2xl p-6 border border-ledger-primary/10 mb-8">
        <ScissorChart
          months={months}
          income={incomeData}
          expense={expenseData}
          survivalLine={survivalLine}
        />
      </div>

      <div className="flex justify-center gap-8">
        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">本月收入</div>
          <AmountDisplay
            amount={summary?.income || 0}
            className="text-2xl font-semibold text-ledger-success"
            sensitive
          />
        </div>

        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">本月支出</div>
          <AmountDisplay
            amount={summary?.expense || 0}
            className="text-2xl font-semibold text-ledger-danger"
            sensitive
          />
        </div>

        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">本月盈余</div>
          <AmountDisplay
            amount={summary?.surplus || 0}
            className="text-2xl font-semibold text-ledger-success"
            showSign
            sensitive
          />
        </div>

        <div className="bg-ledger-surface rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10">
          <div className="text-ledger-muted text-sm mb-2">盈余率</div>
          <div className="text-2xl font-semibold text-ledger-success">{surplusRate}%</div>
        </div>

        <div className={`rounded-2xl p-6 min-w-[180px] text-center border border-ledger-primary/10 ${warning.bg}`}>
          <div className="text-ledger-muted text-sm mb-2">财务健康度</div>
          <div className={`text-2xl font-semibold ${warning.color}`}>{warning.text}</div>
        </div>
      </div>
    </div>
  );
}
