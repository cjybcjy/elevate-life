'use client';

import { useState } from 'react';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { useRouter } from 'next/navigation';
import { createAsset, updateAsset, deleteAsset } from '@/lib/actions/assets';
import { AssetTable } from './AssetTable';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';

export default function AssetManager({
  assets: initialAssets,
  pricesStale: initialStale,
}: {
  assets: any[];
  pricesStale: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleCreate(formData: FormData) {
    setError('');
    const category = formData.get('category') as string;
    const isGold = category === 'gold_physical' || category === 'gold_paper';
    const isSecurity = category === 'stock' || category === 'fund';

    const result = await createAsset({
      name: formData.get('name') as string,
      category,
      balance: isGold || isSecurity ? undefined : (formData.get('balance') as string),
      currency: (formData.get('currency') as string) || 'CNY',
      quantity: isGold || isSecurity ? (formData.get('quantity') as string) : undefined,
      stockCode: isSecurity ? (formData.get('stockCode') as string) : undefined,
      market: isSecurity ? (formData.get('market') as string) : undefined,
      costUnitPrice: isGold || isSecurity ? (formData.get('costUnitPrice') as string) : undefined,
    });
    if (result.success) {
      (document.getElementById('create-form') as HTMLFormElement)?.reset();
      setRefreshKey(k => k + 1); router.refresh();
    } else if (result.error?.includes('会话密钥')) {
      router.push('/login');
    } else {
      setError(result.error || '创建失败');
    }
  }

  async function handleUpdate(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    const result = await updateAsset(id, {
      name: (formData.get('name') as string) || undefined,
      balance: (formData.get('balance') as string) || undefined,
      quantity: (formData.get('quantity') as string) || undefined,
      stockCode: (formData.get('stockCode') as string) || undefined,
      market: (formData.get('market') as string) || undefined,
      costUnitPrice: (formData.get('costUnitPrice') as string) || undefined,
    });
    if (result.success) {
      setRefreshKey(k => k + 1); router.refresh();
    } else if (result.error?.includes('会话密钥')) {
      router.push('/login');
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    const result = await deleteAsset(id);
    if (result.success) {
      setRefreshKey(k => k + 1); router.refresh();
    } else if (result.error?.includes('会话密钥')) {
      router.push('/login');
    } else {
      setError(result.error || '删除失败');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">资产管理</h1>
        <PriceRefresher pricesStale={initialStale} />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {/* 专项账户总览 */}
      {(() => {
        const specialMap: Record<string, { icon: string; label: string }> = {
          provident_fund: { icon: '🏦', label: '公积金' },
          pension: { icon: '🏛️', label: '养老保险' },
        };
        const specialAssets = initialAssets.filter((a: any) => specialMap[a.category]);
        if (specialAssets.length === 0) return null;
        const groups: Record<string, { icon: string; label: string; assets: any[]; total: number }> = {};
        for (const a of specialAssets) {
          const cfg = specialMap[a.category];
          if (!groups[a.category]) groups[a.category] = { ...cfg, assets: [], total: 0 };
          groups[a.category].assets.push(a);
          groups[a.category].total += parseFloat(a.balance || '0');
        }
        return (
          <div className="mb-6 rounded-xl bg-ledger-surface p-4">
            <h2 className="text-base font-bold text-white mb-3">专项账户总览</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(groups).map(([cat, g]) => (
                <div key={cat} className="bg-ledger-bg rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{g.icon} {g.label}</span>
                    <AmountDisplay amount={g.total} className="text-sm" sensitive />
                  </div>
                  {g.assets.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-xs text-ledger-muted py-0.5">
                      <span className="truncate flex-1">{a.name}</span>
                      <AmountDisplay amount={parseFloat(a.balance || '0')} className="shrink-0" sensitive />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-ledger-bg text-xs text-ledger-muted">
              小计 ¥{groups && Object.values(groups).reduce((s: number, g: any) => s + g.total, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        );
      })()}

      <form
        id="create-form"
        action={handleCreate}
        className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-ledger-muted mb-1">名称</label>
          <input
            name="name"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="资产名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="category"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">选择分类</option>
            <option value="real_estate">🏠 房产</option>
            <option value="cash">💰 现金</option>
            <option value="provident_fund">🏦 公积金账户</option>
            <option value="pension">🏛️ 养老账户</option>
            <option value="gold_physical">🟡 实物黄金</option>
            <option value="gold_paper">📄 纸黄金</option>
            <option value="stock">📈 股票</option>
            <option value="fund">📊 基金</option>
            <option value="bond">📜 债券</option>
            <option value="vehicle">🚗 车辆</option>
            <option value="other">📦 其他</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">市场</label>
          <select
            name="market"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">无需</option>
            <option value="cn">A股</option>
            <option value="hk">港股</option>
            <option value="us">美股</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">代码</label>
          <input
            name="stockCode"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent font-mono"
            placeholder="600519"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">持有数量</label>
          <input
            name="quantity"
            type="number"
            step="0.0001"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="克数/股数"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">成本单价</label>
          <input
            name="costUnitPrice"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="每份买入价"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">余额/金额</label>
          <input
            name="balance"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="手动金额（非黄金/股票类）"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">币种</label>
          <input
            name="currency"
            defaultValue="CNY"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-20"
            placeholder="CNY"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          创建
        </button>
      </form>

      <AssetTable key={refreshKey} assets={initialAssets} handleDelete={handleDelete} handleUpdate={handleUpdate} />
    </div>
  );
}
