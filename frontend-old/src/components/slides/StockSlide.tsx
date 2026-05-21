import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

interface StockAsset {
  id: string;
  name: string;
  stockCode: string;
  market: string;
  quantity: number;
  costBasis: string;
  currentValue: string;
  unitPrice: string;
}

const marketLabel: Record<string, string> = {
  cn: 'A股',
  hk: '港股',
  us: '美股',
};

export default function StockSlide() {
  const [stocks, setStocks] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStocks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/assets');
      const allAssets = res.data || [];
      const stockAssets = allAssets.filter((a: any) => a.category === 'stock');
      setStocks(stockAssets);
    } catch (err: any) {
      setError('加载股票数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  const { totalValue, totalCost, totalPnl, totalPnlRate } = useMemo(() => {
    let tv = 0;
    let tc = 0;
    for (const s of stocks) {
      tv += parseFloat(s.currentValue || '0');
      const cost = parseFloat(s.costBasis || '0') * (s.quantity || 0);
      tc += cost;
    }
    const pnl = tv - tc;
    const pnlRate = tc > 0 ? (pnl / tc) * 100 : 0;
    return { totalValue: tv, totalCost: tc, totalPnl: pnl, totalPnlRate: pnlRate };
  }, [stocks]);

  const currencySymbol: Record<string, string> = {
    cn: '¥',
    hk: 'HK$',
    us: '$',
  };

  const formatMoney = (val: number, market?: string) => {
    const symbol = currencySymbol[market || 'cn'] || '¥';
    return `${symbol}${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="text-ledger-muted text-center py-10">加载中...</div>;
  if (error) return <div className="text-red-400 text-center py-10">{error}</div>;

  return (
    <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-ledger-text">股票持仓</h2>
          <p className="text-sm text-ledger-muted mt-1">
            总市值 {formatMoney(totalValue)} ·
            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)
            </span>
          </p>
        </div>
        <button
          onClick={loadStocks}
          className="px-3 py-1.5 text-sm bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-ledger-text transition-colors"
        >
          刷新
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="text-ledger-muted text-center py-8 text-sm">暂无股票资产</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ledger-primary/10 text-ledger-muted">
                <th className="text-left py-2 px-2">名称</th>
                <th className="text-left py-2 px-2">市场</th>
                <th className="text-left py-2 px-2">代码</th>
                <th className="text-right py-2 px-2">数量</th>
                <th className="text-right py-2 px-2">成本价</th>
                <th className="text-right py-2 px-2">现价</th>
                <th className="text-right py-2 px-2">市值</th>
                <th className="text-right py-2 px-2">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => {
                const value = parseFloat(s.currentValue || '0');
                const cost = parseFloat(s.costBasis || '0') * (s.quantity || 0);
                const pnl = value - cost;
                const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;

                return (
                  <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                    <td className="py-2 px-2 text-ledger-text">{s.name}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">
                        {marketLabel[s.market] || s.market || 'A股'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-ledger-muted font-mono">{s.stockCode}</td>
                    <td className="py-2 px-2 text-right text-ledger-text">{s.quantity}</td>
                    <td className="py-2 px-2 text-right text-ledger-muted">{formatMoney(parseFloat(s.costBasis || '0'), s.market)}</td>
                    <td className="py-2 px-2 text-right text-ledger-text">{formatMoney(parseFloat(s.unitPrice || '0'), s.market)}</td>
                    <td className="py-2 px-2 text-right text-ledger-text font-medium">{formatMoney(value, s.market)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {pnl >= 0 ? '+' : ''}{formatMoney(pnl, s.market)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
