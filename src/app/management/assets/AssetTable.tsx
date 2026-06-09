'use client';

import { useState } from 'react';
import { AmountDisplay } from '@/components/common/AmountDisplay';

const categoryLabel: Record<string, string> = {
  real_estate: '房产', cash: '现金', provident_fund: '公积金账户', pension: '养老账户',
  gold_physical: '实物黄金', gold_paper: '纸黄金',
  stock: '股票', fund: '基金', bond: '债券', vehicle: '车辆', other: '其他',
};
const marketLabel: Record<string, string> = { cn: 'A股', hk: '港股', us: '美股' };
const currencySymbol: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: '$' };
const cur = (c?: string | null) => currencySymbol[c || 'CNY'] || '¥';

export function AssetTable({
  assets,
  handleDelete,
  handleUpdate,
}: {
  assets: any[];
  handleDelete: (formData: FormData) => Promise<void>;
  handleUpdate: (formData: FormData) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
            const isEditing = editingId === asset.id;

            return (
              <tr key={asset.id} className={`border-b border-ledger-bg last:border-0 ${isEditing ? 'bg-ledger-bg/30' : ''}`}>
                <td className="px-4 py-3 text-white">{asset.name}</td>
                <td className="px-4 py-3 text-ledger-muted">{categoryLabel[asset.category] || asset.category}</td>
                <td className="px-4 py-3 text-ledger-muted">{asset.market ? (marketLabel[asset.market] || asset.market) : '-'}</td>
                <td className="px-4 py-3 text-ledger-muted font-mono">{asset.stockCode || '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.quantity ?? '-'}</td>
                <td className="px-4 py-3 text-right text-ledger-muted">{asset.costUnitPrice != null ? `${cur(asset.priceCurrency)}${Number(asset.costUnitPrice).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white">{asset.unitPrice != null ? `${cur(asset.priceCurrency)}${asset.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{cur(asset.priceCurrency)}{marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">
                  {isMarketPriced && costBasis > 0 ? (
                    <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {pnl >= 0 ? '+' : ''}{cur(asset.priceCurrency)}{pnl.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-ledger-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : asset.id)}
                      className={`text-xs px-2 py-1 rounded ${
                        isEditing ? 'bg-ledger-accent/20 text-ledger-accent' : 'bg-ledger-bg text-ledger-muted hover:text-white'
                      }`}
                    >
                      {isEditing ? '取消' : '编辑'}
                    </button>
                    <form action={handleDelete} className="inline">
                      <input type="hidden" name="id" value={asset.id} />
                      <button type="submit" className="text-ledger-danger hover:underline text-xs">删除</button>
                    </form>
                  </div>

                  {/* Inline Edit Form */}
                  {isEditing && (
                    <div className="mt-3 p-3 bg-ledger-bg rounded-lg border border-ledger-primary/20">
                      <form action={handleUpdate} className="flex flex-wrap gap-2 items-end">
                        <input type="hidden" name="id" value={asset.id} />
                        <div>
                          <label className="block text-xs text-ledger-muted mb-1">名称</label>
                          <input name="name" defaultValue={asset.name} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24" />
                        </div>
                        {['gold_physical', 'gold_paper', 'stock', 'fund'].includes(asset.category) && (
                          <>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">数量</label>
                              <input name="quantity" type="number" step="0.0001" defaultValue={asset.quantity} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-20" />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">成本单价</label>
                              <input name="costUnitPrice" type="number" step="0.01" defaultValue={asset.costUnitPrice} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24" />
                            </div>
                          </>
                        )}
                        {asset.category === 'stock' || asset.category === 'fund' ? (
                          <>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">市场</label>
                              <select name="market" defaultValue={asset.market || ''} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent">
                                <option value="cn">A股</option>
                                <option value="hk">港股</option>
                                <option value="us">美股</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">代码</label>
                              <input name="stockCode" defaultValue={asset.stockCode || ''} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-ledger-accent w-20" />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">余额</label>
                            <input name="balance" type="number" step="0.01" defaultValue={parseFloat(asset.balance || '0')} className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-28" />
                          </div>
                        )}
                        <button type="submit" className="rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                          保存
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
