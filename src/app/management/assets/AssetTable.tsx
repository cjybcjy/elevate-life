'use client';

const categoryLabel: Record<string, string> = {
  real_estate: '房产', cash: '现金', gold_physical: '实物黄金', gold_paper: '纸黄金',
  stock: '股票', fund: '基金', bond: '债券', vehicle: '车辆', other: '其他',
};
const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };

export function AssetTable({ assets, handleDelete }: { assets: any[]; handleDelete: (formData: FormData) => Promise<void> }) {
  return (
    <div className="rounded-xl bg-ledger-surface overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ledger-bg text-left text-ledger-muted">
            <th className="px-4 py-3 font-medium">名称</th>
            <th className="px-4 py-3 font-medium">分类</th>
            <th className="px-4 py-3 font-medium">市场</th>
            <th className="px-4 py-3 font-medium">代码</th>
            <th className="px-4 py-3 font-medium text-right">持有数量</th>
            <th className="px-4 py-3 font-medium text-right">成本单价</th>
            <th className="px-4 py-3 font-medium text-right">当前单价</th>
            <th className="px-4 py-3 font-medium text-right">市场价值</th>
            <th className="px-4 py-3 font-medium text-right">盈亏</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-ledger-muted">暂无资产</td>
            </tr>
          )}
          {assets.map((asset: any) => {
            const marketValue = parseFloat(asset.currentValue || asset.balance || '0');
            const costBasis = asset.quantity && asset.costUnitPrice
              ? asset.quantity * asset.costUnitPrice
              : parseFloat(asset.costPrice || '0');
            const pnl = marketValue - costBasis;
            const pnlPct = costBasis > 0 ? (pnl / costBasis * 100) : 0;
            const isMarketPriced = ['gold_physical', 'gold_paper', 'stock', 'fund'].includes(asset.category);

            return (
              <tr key={asset.id} className="border-b border-ledger-bg last:border-0">
                <td className="px-4 py-3 text-white">{asset.name}</td>
                <td className="px-4 py-3 text-ledger-muted">{categoryLabel[asset.category] || asset.category}</td>
                <td className="px-4 py-3 text-ledger-muted">{asset.market ? (marketLabel[asset.market] || asset.market) : '-'}</td>
                <td className="px-4 py-3 text-ledger-muted font-mono">{asset.stockCode || '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.quantity ?? '-'}</td>
                <td className="px-4 py-3 text-right text-ledger-muted">{asset.costUnitPrice != null ? `¥${Number(asset.costUnitPrice).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.unitPrice != null ? `¥${asset.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white font-medium">¥{marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">
                  {isMarketPriced && costBasis > 0 ? (
                    <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pnl >= 0 ? '+' : ''}¥{pnl.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-ledger-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={asset.id} />
                    <button type="submit" className="text-ledger-danger hover:underline text-xs">删除</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
