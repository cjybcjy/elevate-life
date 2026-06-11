'use client';

import { useState, useOptimistic } from 'react';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { createAsset, updateAsset, deleteAsset } from '@/lib/actions/assets';
import { AssetTable } from './AssetTable';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import { useAssets } from '@/hooks/useAssets';
import { useToast } from '@/components/common/Toast';
import { useSWRConfig } from 'swr';

export default function AssetManager() {
  const { data, isLoading, error: fetchError } = useAssets();
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const assets = data?.data ?? [];
  const pricesStale = data?.pricesStale ?? false;

  const [optimisticAssets, addOptimistic] = useOptimistic(assets, (state: any[], newAsset: any) => [newAsset, ...state]);
  const [error, setError] = useState('');
  const [showDepreciation, setShowDepreciation] = useState(false);

  async function handleCreate(formData: FormData) {
    setError('');
    const category = formData.get('category') as string;
    const isGold = category === 'gold_physical' || category === 'gold_paper';
    const isSecurity = category === 'stock' || category === 'fund';

    const purchaseDate = (formData.get('purchaseDate') as string) || undefined;
    const scrapDate = (formData.get('scrapDate') as string) || undefined;
    const scrapValue = (formData.get('scrapValue') as string) || undefined;

    // Auto-calculate balance for depreciating assets
    let balance: string | undefined;
    let costPrice: string | undefined;
    if (purchaseDate && scrapDate && isGold === false && isSecurity === false) {
      costPrice = (formData.get('costPrice') as string) || undefined;
      if (costPrice && purchaseDate && scrapDate) {
        const purchaseMs = new Date(purchaseDate).getTime();
        const scrapMs = new Date(scrapDate).getTime();
        const nowMs = Date.now();
        const totalDays = (scrapMs - purchaseMs) / (1000 * 60 * 60 * 24);
        const elapsedDays = (nowMs - purchaseMs) / (1000 * 60 * 60 * 24);
        const purchaseVal = parseFloat(costPrice);
        const scrapVal = parseFloat(scrapValue || '0');
        if (totalDays > 0) {
          const ratio = Math.max(0, Math.min(1, elapsedDays / totalDays));
          balance = (purchaseVal - (purchaseVal - scrapVal) * ratio).toFixed(4);
        } else {
          balance = costPrice;
        }
      }
    } else {
      balance = isGold || isSecurity ? undefined : (formData.get('balance') as string);
    }

    const result = await createAsset({
      name: formData.get('name') as string,
      category,
      balance,
      currency: (formData.get('currency') as string) || 'CNY',
      quantity: isGold || isSecurity ? (formData.get('quantity') as string) : undefined,
      stockCode: isSecurity ? (formData.get('stockCode') as string) : undefined,
      market: isSecurity ? (formData.get('market') as string) : undefined,
      costUnitPrice: isGold || isSecurity ? (formData.get('costUnitPrice') as string) : undefined,
      costPrice,
      purchaseDate,
      scrapDate,
      scrapValue,
    });
    if (result.success) {
      (document.getElementById('create-form') as HTMLFormElement)?.reset();
      mutate('assets');
      toast.success('资产已创建');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '创建失败');
      mutate('assets');
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
      purchaseDate: (formData.get('purchaseDate') as string) || undefined,
      scrapDate: (formData.get('scrapDate') as string) || undefined,
      scrapValue: (formData.get('scrapValue') as string) || undefined,
    });
    if (result.success) {
      mutate('assets');
      toast.success('资产已更新');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    const result = await deleteAsset(id);
    if (result.success) {
      mutate('assets');
      toast.success('资产已删除');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '删除失败');
      mutate('assets');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>资产管理</h1>
        <PriceRefresher pricesStale={pricesStale} />
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
          current_deposit: { icon: '💳', label: '银行活期' },
        };
        const specialAssets = assets.filter((a: any) => specialMap[a.category]);
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
            <h2 className="text-base font-bold mb-3">专项账户总览</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(groups).map(([cat, g]) => (
                <div key={cat} className="bg-ledger-bg rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{g.icon} {g.label}</span>
                    <AmountDisplay amount={g.total} className="text-sm" />
                  </div>
                  {g.assets.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-xs text-ledger-muted py-0.5">
                      <span className="truncate flex-1">{a.name}</span>
                      <AmountDisplay amount={parseFloat(a.balance || '0')} className="shrink-0" />
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="资产名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="category"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          >
            <option value="">选择分类</option>
            <option value="real_estate">🏠 房产</option>
            <option value="cash">💰 现金</option>
            <option value="current_deposit">💳 银行活期</option>
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent font-mono"
            placeholder="000000"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">持有数量</label>
          <input
            name="quantity"
            type="number"
            step="0.0001"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="克数/股数"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">成本单价</label>
          <input
            name="costUnitPrice"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="每份买入价"
          />
        </div>
        {showDepreciation ? (
          <div>
            <label className="block text-xs text-ledger-muted mb-1">买入总价</label>
            <input
              name="costPrice"
              type="number"
              step="0.01"
              required
              className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
              placeholder="折旧前原价"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-ledger-muted mb-1">余额/金额</label>
            <input
              name="balance"
              type="number"
              step="0.01"
              className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
              placeholder="手动金额（非黄金/股票类）"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-ledger-muted mb-1">币种</label>
          <input
            name="currency"
            defaultValue="CNY"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-20"
            placeholder="CNY"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-ledger-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showDepreciation}
              onChange={e => setShowDepreciation(e.target.checked)}
              className="rounded"
            />
            折旧
          </label>
        </div>
        {showDepreciation && (
          <>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">买入日期</label>
              <input
                name="purchaseDate"
                type="date"
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">报废日期</label>
              <input
                name="scrapDate"
                type="date"
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">报废残值</label>
              <input
                name="scrapValue"
                type="number"
                step="0.01"
                defaultValue="0"
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                placeholder="0"
              />
            </div>
          </>
        )}
        <button
          type="submit"
          className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          创建
        </button>
      </form>

      <AssetTable assets={optimisticAssets} handleDelete={handleDelete} handleUpdate={handleUpdate} />
    </div>
  );
}
