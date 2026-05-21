import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import QuickTransactionDrawer from '../../components/forms/QuickTransactionDrawer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId: string | null;
  description: string | null;
  occurredAt: string;
  fromAccountId: string | null;
  toAccountId: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
}

const typeStyle = {
  income: { label: '收入', className: 'text-green-400' },
  expense: { label: '支出', className: 'text-red-400' },
  transfer: { label: '转账', className: 'text-blue-400' },
};

export default function TransactionManagement() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/transactions').then((res: any) => setTransactions(res.data || [])),
      api.get('/categories').then((res: any) => setCategories(res.data || [])),
      api.get('/assets').then((res: any) => setAssets(res.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch = !search || (t.description || '').toLowerCase().includes(search.toLowerCase());
      const matchType = !typeFilter || t.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [transactions, search, typeFilter]);

  const getCategoryName = (id: string | null) => {
    if (!id) return '-';
    return categories.find((c) => c.id === id)?.name || '-';
  };

  const getAssetName = (id: string | null) => {
    if (!id) return '-';
    return assets.find((a) => a.id === id)?.name || '-';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/transactions/${deleteTarget.id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = type === 'expense' ? '-' : type === 'income' ? '+' : '';
    return `${sign}¥${Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="text-ledger-muted text-center py-20">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-ledger-text">交易管理</h1>
        <button
          onClick={() => { setEditingTx(null); setDrawerOpen(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          + 记一笔
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="搜索备注..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2 text-sm text-ledger-text placeholder:text-ledger-muted/50 focus:outline-none focus:border-ledger-primary/40 w-56"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2 text-sm text-ledger-text focus:outline-none focus:border-ledger-primary/40"
        >
          <option value="">全部类型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="transfer">转账</option>
        </select>
      </div>

      <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ledger-primary/10">
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">日期</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">类型</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">分类</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">金额</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">账户</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">备注</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const style = typeStyle[t.type];
              const accountDisplay = t.type === 'transfer'
                ? `${getAssetName(t.fromAccountId)} → ${getAssetName(t.toAccountId)}`
                : t.type === 'expense'
                ? getAssetName(t.fromAccountId)
                : getAssetName(t.toAccountId);

              return (
                <tr key={t.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/50 transition-colors">
                  <td className="px-4 py-3 text-ledger-muted text-sm">{formatDate(t.occurredAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-opacity-20 ${style.className}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ledger-text text-sm">{getCategoryName(t.categoryId)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-medium ${style.className}`}>{formatAmount(t.amount, t.type)}</td>
                  <td className="px-4 py-3 text-ledger-muted text-sm">{accountDisplay}</td>
                  <td className="px-4 py-3 text-ledger-muted text-sm max-w-[200px] truncate">{t.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setEditingTx(t); setDrawerOpen(true); }}
                      className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ledger-muted text-sm">
                  暂无交易数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-ledger-muted">
        共 {transactions.length} 笔交易
      </div>

      <QuickTransactionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={loadData}
        editingTransaction={editingTx}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除交易"
        message="确定要删除这笔交易吗？删除后将自动回滚对应的资产余额变动。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
