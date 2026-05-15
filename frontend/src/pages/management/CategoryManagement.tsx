import { useState, useEffect } from 'react';
import api from '../../services/api';
import CategoryFormModal from '../../components/forms/CategoryFormModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const loadCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then((res: any) => setCategories(res.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="text-ledger-muted text-center py-20">加载中...</div>;

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-ledger-text">分类管理</h1>
        <button
          onClick={() => { setEditingCategory(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          + 新增分类
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-ledger-muted mb-3">支出分类</h2>
          <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 overflow-hidden">
            {expenseCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-ledger-primary/5 hover:bg-ledger-bg/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{c.icon || '📁'}</span>
                  <span className="text-ledger-text text-sm">{c.name}</span>
                </div>
                <div>
                  <button
                    onClick={() => { setEditingCategory(c); setShowModal(true); }}
                    className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-ledger-muted text-sm">暂无支出分类</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-ledger-muted mb-3">收入分类</h2>
          <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 overflow-hidden">
            {incomeCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-ledger-primary/5 hover:bg-ledger-bg/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{c.icon || '📁'}</span>
                  <span className="text-ledger-text text-sm">{c.name}</span>
                </div>
                <div>
                  <button
                    onClick={() => { setEditingCategory(c); setShowModal(true); }}
                    className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-ledger-muted text-sm">暂无收入分类</div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <CategoryFormModal category={editingCategory} onClose={() => setShowModal(false)} onSaved={loadCategories} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除分类"
        message={`确定要删除"${deleteTarget?.name}"吗？如果该分类下存在交易记录，将无法删除。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
