'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { createAsset, updateAsset, deleteAsset } from '@/lib/actions/assets';
import { AssetTable } from './AssetTable';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import AccountViewLayer from '@/components/widgets/AccountViewLayer';
import { useAssets } from '@/hooks/useAssets';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/components/common/Toast';
import { useSWRConfig } from 'swr';

type AssetFocus = 'liquidity' | 'prices' | null;

interface AssetRow {
  id: string;
  name: string;
  category?: string | null;
  balance?: string | null;
  currency?: string | null;
  liquidityTier?: string | null;
}

function parseAssetBalance(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const liquidityTierRank: Record<string, number> = {
  tier1: 0,
  tier2: 1,
  tier3: 2,
  long_term: 2,
  illiquid: 3,
};

const categoryLiquidityRank: Record<string, number> = {
  cash: 0,
  current_deposit: 0,
  fund: 0,
  stock: 1,
  bond: 1,
  gold_paper: 1,
  gold_physical: 1,
  provident_fund: 2,
  pension: 2,
  real_estate: 3,
  vehicle: 3,
  other: 4,
};

const emptyAssets: AssetRow[] = [];

function getLiquidityRank(asset: AssetRow) {
  if (asset.liquidityTier && asset.liquidityTier in liquidityTierRank) {
    return liquidityTierRank[asset.liquidityTier];
  }
  if (asset.category && asset.category in categoryLiquidityRank) {
    return categoryLiquidityRank[asset.category];
  }
  return categoryLiquidityRank.other;
}

export default function AssetManager() {
  const searchParams = useSearchParams();
  const focusParam = searchParams.get('focus');
  const assetFocus: AssetFocus =
    focusParam === 'liquidity' || focusParam === 'prices'
      ? focusParam
      : null;
  const { data } = useAssets();
  const { data: transactionData } = useTransactions();
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const assets: AssetRow[] = data?.data ?? emptyAssets;
  const sortedAssets = useMemo(() => (
    assets
      .map((asset, index) => ({ asset, index }))
      .sort((a, b) => getLiquidityRank(a.asset) - getLiquidityRank(b.asset) || a.index - b.index)
      .map(({ asset }) => asset)
  ), [assets]);
  const accountTransactions = transactionData?.data ?? [];
  const pricesStale = data?.pricesStale ?? false;

  const optimisticAssets = sortedAssets;
  const [error, setError] = useState('');
  const [showDepreciation, setShowDepreciation] = useState(false);
  const tier1Categories = ['cash', 'current_deposit', 'stock'];
  const tier1Assets = optimisticAssets.filter((asset) => tier1Categories.includes(asset.category || ''));
  const tier1Total = tier1Assets.reduce((sum, asset) => sum + parseAssetBalance(asset.balance), 0);
  const marketPricedAssets = optimisticAssets.filter((asset) => (
    asset.category === 'stock' ||
    asset.category === 'fund' ||
    asset.category === 'gold_physical' ||
    asset.category === 'gold_paper'
  ));
  const assetFocusCopy = assetFocus === 'liquidity'
    ? {
        title: '补足一级流动性',
        detail: `当前一级流动性约 ${tier1Total.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 元，来自 ${tier1Assets.length} 个资金账户。优先新增现金、银行活期，或把可随时取用的资产整理到一级流动性。`,
        cta: '新增流动资金账户',
        href: '#create-form',
      }
    : {
        title: '刷新资产价格',
        detail: pricesStale
          ? `${marketPricedAssets.length} 个股票、基金或黄金资产可能使用了旧价格；先点右上角刷新价格，再检查资产列表。`
          : `${marketPricedAssets.length} 个市场定价资产当前没有明显过期价格；仍可手动刷新后复核。`,
        cta: '检查资产列表',
        href: '#asset-table',
      };
  const createAssetDefaults = assetFocus === 'liquidity'
    ? {
        category: 'current_deposit',
        namePlaceholder: '如：家庭备用金 / 招行活期',
      }
    : {
        category: '',
        namePlaceholder: '资产名称',
      };

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

      {assetFocus && (
        <section className="mb-6 rounded-xl border border-ledger-accent/20 bg-ledger-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-ledger-muted">资产行动</div>
              <h2 className="mt-1 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {assetFocusCopy.title}
              </h2>
              <p className="mt-1 text-sm text-ledger-muted">
                {assetFocusCopy.detail}
              </p>
            </div>
            <a href={assetFocusCopy.href} className="btn btn-outline btn-sm">
              {assetFocusCopy.cta}
            </a>
          </div>
        </section>
      )}

      <AccountViewLayer assets={optimisticAssets} transactions={accountTransactions} />

      {/* 专项账户总览 */}
      {(() => {
        const specialMap: Record<string, { icon: string; label: string }> = {
          provident_fund: { icon: '🏦', label: '公积金' },
          pension: { icon: '🏛️', label: '养老保险' },
          current_deposit: { icon: '💳', label: '银行活期' },
        };
        const specialAssets = assets.filter((a) => Boolean(a.category && specialMap[a.category]));
        if (specialAssets.length === 0) return null;
        const groups: Record<string, { icon: string; label: string; assets: AssetRow[]; total: number }> = {};
        for (const a of specialAssets) {
          const category = a.category || 'other';
          const cfg = specialMap[category];
          if (!cfg) continue;
          if (!groups[category]) groups[category] = { ...cfg, assets: [], total: 0 };
          groups[category].assets.push(a);
          groups[category].total += parseAssetBalance(a.balance);
        }
        return (
          <div className="mb-6 rounded-xl bg-ledger-surface p-4">
            <h2 className="text-base font-bold mb-3">专项账户总览</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(groups).map(([cat, g]) => (
                <div key={cat} className="bg-ledger-bg rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{g.icon} {g.label}</span>
                    <AmountDisplay amount={g.total} className="text-sm" />
                  </div>
                  {g.assets.map((a) => (
                    <div key={a.id} className="flex justify-between text-xs text-ledger-muted py-0.5">
                      <span className="truncate flex-1">{a.name}</span>
                      <AmountDisplay amount={parseAssetBalance(a.balance)} className="shrink-0" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-ledger-bg text-xs text-ledger-muted">
              小计 ¥{Object.values(groups).reduce((sum, group) => sum + group.total, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
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
            placeholder={createAssetDefaults.namePlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="category"
            required
            defaultValue={createAssetDefaults.category}
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

      <div id="asset-table">
        <AssetTable assets={optimisticAssets} handleDelete={handleDelete} handleUpdate={handleUpdate} />
      </div>
    </div>
  );
}
