'use client';

const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };
const currencySymbol: Record<string, string> = { cn: '¥', hk: 'HK$', us: '$' };
const fmt = (val: number, market?: string) => `${currencySymbol[market || 'cn'] || '¥'}${Math.abs(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Stock {
  id: string;
  name: string;
  stockCode?: string | null;
  market?: string | null;
  quantity?: number | null;
  costPrice?: string | null;
  costUnitPrice?: number | null;
  currentValue?: string | null;
  balance?: string;
  unitPrice?: number | null;
}

export default function StockTable({ stocks }: { stocks: Stock[] }) {
  // Filter only stocks with market data
  const marketStocks = stocks.filter((s) => s.stockCode && s.market);

  const totalValue = marketStocks.reduce((s, st) => s + parseFloat(st.currentValue || st.balance || '0'), 0);
  const totalCost = marketStocks.reduce((s, st) => {
    const qty = st.quantity || 0;
    const cup = st.costUnitPrice || parseFloat(st.costPrice || '0');
    return s + (cup * qty);
  }, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  if (marketStocks.length === 0) {
    return <div className="py-8 text-center text-ledger-muted">暂无股票持仓，请在资产管理中添加股票资产并填写代码和市场</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-sm mb-3">
        <span className="text-ledger-muted">本金 <span className="text-white font-medium">{fmt(totalCost)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">市值 <span className="text-ledger-success font-medium">{fmt(totalValue)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">浮动盈亏 <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-primary/10 text-ledger-muted">
              <th className="text-left py-2 px-3">名称</th>
              <th className="text-left py-2 px-3">市场</th>
              <th className="text-left py-2 px-3">代码</th>
              <th className="text-right py-2 px-3">数量</th>
              <th className="text-right py-2 px-3">成本价</th>
              <th className="text-right py-2 px-3">现价</th>
              <th className="text-right py-2 px-3">市值</th>
              <th className="text-right py-2 px-3">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {marketStocks.map((s) => {
              const value = parseFloat(s.currentValue || s.balance || '0');
              const qty = s.quantity || 0;
              const cup = s.costUnitPrice || parseFloat(s.costPrice || '0');
              const cost = cup * qty;
              const pnl = value - cost;
              const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;
              const market = s.market || 'cn';
              return (
                <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                  <td className="py-2 px-3 text-white">{s.name}</td>
                  <td className="py-2 px-3"><span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{marketLabel[market] || market}</span></td>
                  <td className="py-2 px-3 text-ledger-muted font-mono">{s.stockCode || '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{qty || '-'}</td>
                  <td className="py-2 px-3 text-right text-ledger-muted">{cup > 0 ? fmt(cup, market) : '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{s.unitPrice ? fmt(s.unitPrice, market) : '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{fmt(value, market)}</td>
                  <td className="py-2 px-3 text-right"><span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{fmt(pnl, market)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
