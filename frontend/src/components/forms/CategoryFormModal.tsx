import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
}

interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryFormModal({ category, onClose, onSaved }: CategoryFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
      setIcon(category.icon || '');
    } else {
      setName('');
      setType('expense');
      setIcon('');
    }
  }, [category]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        icon: icon || undefined,
      };

      if (category) {
        await api.patch(`/categories/${category.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save category failed:', err);
      alert('保存失败，请检查数据');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2.5 text-sm text-ledger-text placeholder:text-ledger-muted/50 focus:outline-none focus:border-ledger-primary/40';
  const labelClass = 'block text-sm text-ledger-muted mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-ledger-surface rounded-xl w-full max-w-md mx-4 border border-ledger-primary/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ledger-primary/10">
          <h2 className="text-lg font-medium text-ledger-text">{category ? '编辑分类' : '新增分类'}</h2>
          <button onClick={onClose} className="text-ledger-muted hover:text-ledger-text text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>名称 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="例如：餐饮" />
          </div>

          {!category && (
            <div>
              <label className={labelClass}>类型 *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'expense' ? 'bg-red-600 text-white' : 'bg-ledger-bg text-ledger-muted hover:text-ledger-text'}`}
                >
                  支出
                </button>
                <button
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'income' ? 'bg-green-600 text-white' : 'bg-ledger-bg text-ledger-muted hover:text-ledger-text'}`}
                >
                  收入
                </button>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>图标</label>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass} placeholder="可选，例如：🍜" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-ledger-muted hover:text-ledger-text bg-ledger-bg border border-ledger-primary/20">取消</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
