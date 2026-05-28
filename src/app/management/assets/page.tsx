export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets, createAsset, deleteAsset } from '@/lib/actions/assets';
import { AssetTable } from './AssetTable';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';

export default async function AssetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getAssets();
  if (!res.success) {
    redirect('/login');
  }
  const assets = (res.data ?? []) as any[];
  const pricesStale = (res as any).pricesStale ?? false;

  async function handleCreate(formData: FormData) {
    'use server';
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
      redirect('/management/assets');
    }
    if (result.error?.includes('会话密钥')) {
      redirect('/login');
    }
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const result = await deleteAsset(id);
    if (result.success) {
      redirect('/management/assets');
    }
    if (result.error?.includes('会话密钥')) {
      redirect('/login');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">资产管理</h1>
        <PriceRefresher pricesStale={pricesStale} />
      </div>

      <form
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

      <AssetTable assets={assets} handleDelete={handleDelete} />
    </div>
  );
}
