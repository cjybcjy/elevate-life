import { useEffect, useState } from 'react';
import api from '../../services/api';
import ScissorChart from '../charts/ScissorChart';

export default function ScissorChartSlide() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    const now = new Date();
    api.get(`/transactions/summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then((res: any) => setSummary(res.data));
  }, []);

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const incomeData = Array(12).fill(30000);
  const expenseData = [20000, 21000, 25000, 19500, 22000, 28000, 20000, 21000, 23000, 20000, 25000, 30000];

  return (
    <div className="slide-container">
      <h1 className="text-5xl font-light text-ledger-text mb-8">收支剪刀图</h1>
      <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={15000} />
      <div className="mt-8 flex gap-8">
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">本月盈余</div>
          <div className="text-2xl font-semibold text-ledger-success">¥{(summary?.surplus || 12400).toLocaleString()}</div>
        </div>
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">盈余率</div>
          <div className="text-2xl font-semibold text-ledger-success">31%</div>
        </div>
        <div className="bg-ledger-surface rounded-2xl p-4">
          <div className="text-ledger-muted text-sm">预警</div>
          <div className="text-2xl font-semibold text-ledger-warning">3个月后进入黄色区域</div>
        </div>
      </div>
    </div>
  );
}
