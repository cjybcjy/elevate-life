import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import LiabilityFormModal from '../../components/forms/LiabilityFormModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface Liability {
  id: string;
  name: string;
  category: string;
  currentBalance: string;
  interestRate: number;
  termMonths: number;
  startDate: string;
  paymentMethod: string;
  monthlyPayment: string | null;
  linkedAssetId: string | null;
}

export default function LiabilityManagement() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Liability | null>(null);

  const loadLiabilities = () => {
    setLoading(true);
    api.get('/liabilities')
      .then((res: any) => setLiabilities(res.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLiabilities(); }, []);

  const filtered = useMemo(() => {
    return liabilities.filter((l) => {
      return !search || l.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [liabilities, search]);

  const totalBalance = useMemo(() => {
    return liabilities.reduce((sum, l) => sum + (parseFloat(l.currentBalance || '0')), 0);
  }, [liabilities]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/liabilities/${deleteTarget.id}`);
      loadLiabilities();
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

  const calculateRemaining = (startDate: string, termMonths: number): number => {
    const start = new Date(startDate);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, termMonths - elapsed);
  };

  if (loading) return <div className="text-ledger-muted text-center py-20">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-ledger-text">负债管理</h1>
        <button
          onClick={() => { setEditingLiability(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          + 新增负债
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
      </div>

      <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ledger-primary/10">
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">名称</th>
              <th className="text-left px-4 py-3 text-sm text-ledger-muted font-medium">类型</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">剩余金额</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">利率</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">剩余期数</th>
              <th className="text-right px-4 py-3 text-sm text-ledger-muted font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/50 transition-colors">
                <td className="px-4 py-3 text-ledger-text text-sm">{l.name}</td>
                <td className="px-4 py-3 text-ledger-muted text-sm">{l.category}</td>
                <td className="px-4 py-3 text-right text-ledger-text text-sm font-medium">{formatAmount(l.currentBalance)}</td>
                <td className="px-4 py-3 text-right text-ledger-muted text-sm">{(l.interestRate * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 text-right text-ledger-muted text-sm">{calculateRemaining(l.startDate, l.termMonths)} 期</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { setEditingLiability(l); setShowModal(true); }}
                    className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget(l)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ledger-muted text-sm">
                  暂无负债数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-ledger-muted">
        总负债: <span className="text-ledger-text font-medium">{formatAmount(totalBalance.toString())}</span> 共 {liabilities.length} 项
      </div>

      {showModal && (
        <LiabilityFormModal liability={editingLiability} onClose={() => setShowModal(false)} onSaved={loadLiabilities} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除负债"
        message={`确定要删除"${deleteTarget?.name}"吗？如果该负债存在关联交易，将无法删除。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
