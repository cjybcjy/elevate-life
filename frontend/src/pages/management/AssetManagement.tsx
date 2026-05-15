import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import AssetFormModal from '../../components/forms/AssetFormModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface Asset {
  id: string;
  name: string;
  category: string;
  balance: string;
  currentValue: string;
  quantity: number | null;
  costBasis: string | null;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  real_estate: { label: '房产', color: '#3b82f6' },
  cash: { label: '现金', color: '#10b981' },
  gold: { label: '黄金', color: '#f59e0b' },
  stock: { label: '股票', color: '#ef4444' },
  fund: { label: '基金', color: '#8b5cf6' },
  bond: { label: '债券', color: '#06b6d4' },
  vehicle: { label: '车辆', color: '#f97316' },
  crypto: { label: '加密货币', color: '#f7931a' },
  other: { label: '其他', color: '#94a3b8' },
};

const floatingCategories = ['gold', 'stock', 'fund', 'bond', 'crypto'];

export default function AssetManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const loadAssets = () => {
    setLoading(true);
    api.get('/assets')
      .then((res: any) => setAssets(res.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssets(); }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !categoryFilter || a.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [assets, search, categoryFilter]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (parseFloat(a.currentValue || a.balance || '0')), 0);
  }, [assets]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/assets/${deleteTarget.id}`);
      loadAssets();
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatAmount = (val: string) => {
    const n = parseFloat(val || '0');
    return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="text-ledger-muted text-center py-20">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-ledger-text">资产管理</h1>
        <button
          onClick={() => { setEditingAsset(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          + 新增资产
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="搜索名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2 text-sm text-ledger-text placeholder:text-ledger-muted/50 focus:outline-none focus:border-ledger-primary/40 w-56"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2 text-sm text-ledger-text focus:outline-none focus:border-ledger-primary/40"
        >
          <option value="">全部类型</option>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ledger-primary/10">
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">名称</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">类型</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">当前金额</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">盈亏</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => {
              const cfg = categoryConfig[asset.category] || categoryConfig.other;
              const value = parseFloat(asset.currentValue || asset.balance || '0');
              const isFloating = floatingCategories.includes(asset.category);
              let pnl = 0;
              let pnlRate = 0;
              if (isFloating && asset.costBasis && asset.quantity) {
                const cost = parseFloat(asset.costBasis) * asset.quantity;
                pnl = value - cost;
                pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;
              }

              return (
                <tr key={asset.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/50 transition-colors">
                  <td className="px-4 py-3 text-ledger-text text-sm">{asset.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full text-white/90" style={{ backgroundColor: cfg.color + '40', color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ledger-text text-sm font-medium">{formatAmount(asset.currentValue || asset.balance)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {isFloating && asset.costBasis ? (
                      <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {pnl >= 0 ? '+' : ''}{formatAmount(pnl.toString())} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-ledger-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setEditingAsset(asset); setShowModal(true); }}
                      className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteTarget(asset)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ledger-muted text-sm">
                  暂无资产数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-ledger-muted">
        总资产: <span className="text-ledger-text font-medium">{formatAmount(totalValue.toString())}</span> 共 {assets.length} 项
      </div>

      {showModal && (
        <AssetFormModal asset={editingAsset} onClose={() => setShowModal(false)} onSaved={loadAssets} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除资产"
        message={`确定要删除"${deleteTarget?.name}"吗？如果该资产存在关联交易，将无法删除。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
