'use client';

import Link from 'next/link';

const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };
const currencySymbol: Record<string, string> = { cn: '¥', hk: 'HK$', us: '$' };
const formatMoney = (val: number, market?: string) => {
  const symbol = currencySymbol[market || 'cn'] || '¥';
  return `${symbol}${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface StockAsset { id: string; name: string; stockCode?: string | null; market?: string; quantity?: number | null; costBasis?: string | null; currentValue?: string; balance?: string; unitPrice?: string | null; }

export default function StockSlide({ stocks }: { stocks: StockAsset[] }) {
  const totalValue = stocks.reduce((sum, s) => sum + parseFloat(s.currentValue || s.balance || '0'), 0);
  const totalCost = stocks.reduce((sum, s) => sum + (parseFloat(s.costBasis || '0') * (s.quantity || 0)), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">股票持仓</h2>
        <Link href="/management/assets" className="px-2.5 py-1 text-xs bg-ledger-surface border border-ledger-primary/20 rounded-md text-ledger-muted hover:text-white transition-colors">管理</Link>
      </div>
      <div className="flex items-center gap-4 mb-2 text-sm">
        <span className="text-ledger-muted">本金 <span className="text-white font-medium">{formatMoney(totalCost)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">资产 <span className="text-ledger-success font-medium">{formatMoney(totalValue)}</span></span>
        <span className="text-ledger-muted/30">|</span>
        <span className="text-ledger-muted">浮动盈余 <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)</span></span>
      </div>
      <div className="bg-ledger-surface rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ledger-primary/10 text-ledger-muted">
              <th className="text-left py-2 px-3">名称</th><th className="text-left py-2 px-3">市场</th><th className="text-left py-2 px-3">代码</th>
              <th className="text-right py-2 px-3">数量</th><th className="text-right py-2 px-3">成本价</th><th className="text-right py-2 px-3">现价</th>
              <th className="text-right py-2 px-3">市值</th><th className="text-right py-2 px-3">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-ledger-muted">暂无股票资产</td></tr>}
            {stocks.map((s) => {
              const value = parseFloat(s.currentValue || s.balance || '0');
              const cost = parseFloat(s.costBasis || '0') * (s.quantity || 0);
              const pnl = value - cost;
              const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;
              const market = s.market || 'cn';
              return (
                <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                  <td className="py-2 px-3 text-white">{s.name}</td>
                  <td className="py-2 px-3"><span className="text-xs px-1 py-0.5 rounded bg-ledger-bg text-ledger-muted">{marketLabel[market] || 'A股'}</span></td>
                  <td className="py-2 px-3 text-ledger-muted font-mono">{s.stockCode || '-'}</td>
                  <td className="py-2 px-3 text-right text-white">{s.quantity ?? '-'}</td>
                  <td className="py-2 px-3 text-right text-ledger-muted">{formatMoney(parseFloat(s.costBasis || '0'), market)}</td>
                  <td className="py-2 px-3 text-right text-white">{formatMoney(parseFloat(s.unitPrice || '0'), market)}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">{formatMoney(value, market)}</td>
                  <td className="py-2 px-3 text-right"><span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{formatMoney(pnl, market)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
