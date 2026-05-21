import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Drawer } from '../common/Drawer';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Asset {
  id: string;
  name: string;
  category: string;
}

interface QuickTransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editingTransaction?: TransactionData | null;
}

interface TransactionData {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId: string | null;
  description: string;
  occurredAt: string;
  fromAccountId: string | null;
  toAccountId: string | null;
}

const typeConfig = {
  expense: { label: '支出', color: 'bg-red-600', activeColor: 'ring-red-500' },
  income: { label: '收入', color: 'bg-green-600', activeColor: 'ring-green-500' },
  transfer: { label: '转账', color: 'bg-blue-600', activeColor: 'ring-blue-500' },
};

export default function QuickTransactionDrawer({ open, onClose, onSaved, editingTransaction }: QuickTransactionDrawerProps) {
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/categories').then((res: any) => setCategories(res.data || []));
      api.get('/assets').then((res: any) => setAssets(res.data || []));
    }
  }, [open]);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setCategoryId(editingTransaction.categoryId || '');
      setDescription(editingTransaction.description || '');
      setOccurredAt(editingTransaction.occurredAt ? editingTransaction.occurredAt.slice(0, 10) : '');
      setFromAccountId(editingTransaction.fromAccountId || '');
      setToAccountId(editingTransaction.toAccountId || '');
    } else {
      resetForm();
    }
  }, [editingTransaction, open]);

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategoryId('');
    setDescription('');
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setFromAccountId('');
    setToAccountId('');
  };

  const filteredCategories = categories.filter((c) => {
    if (type === 'transfer') return false;
    return c.type === type;
  });

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    if (type !== 'transfer' && !categoryId) return;
    if (type === 'expense' && !fromAccountId) return;
    if (type === 'income' && !toAccountId) return;
    if (type === 'transfer' && (!fromAccountId || !toAccountId)) return;
    if (type === 'transfer' && fromAccountId === toAccountId) return;

    setSaving(true);
    try {
      const payload: any = {
        type,
        amount: Number(amount),
        categoryId: type === 'transfer' ? null : categoryId,
        description: description || null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        fromAccountId: fromAccountId || null,
        toAccountId: toAccountId || null,
      };

      if (editingTransaction) {
        await api.patch(`/transactions/${editingTransaction.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      onSaved?.();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Save transaction failed:', err);
      alert('保存失败，请检查数据');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2.5 text-sm text-ledger-text placeholder:text-ledger-muted/50 focus:outline-none focus:border-ledger-primary/40';
  const labelClass = 'block text-sm text-ledger-muted mb-1.5';

  return (
    <Drawer open={open} onClose={onClose} title={editingTransaction ? '编辑交易' : '记一笔'}>
      <div className="space-y-5">
        <div>
          <label className={labelClass}>类型</label>
          <div className="flex gap-2">
            {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  type === t
                    ? `${typeConfig[t].color} text-white ring-2 ${typeConfig[t].activeColor} ring-offset-2 ring-offset-ledger-surface`
                    : 'bg-ledger-bg text-ledger-muted hover:text-ledger-text'
                }`}
              >
                {typeConfig[t].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>金额</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ledger-muted text-sm">¥</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} pl-7`}
              placeholder="0.00"
            />
          </div>
        </div>

        {type !== 'transfer' && (
          <div>
            <label className={labelClass}>分类</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">选择分类</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(type === 'expense' || type === 'transfer') && (
          <div>
            <label className={labelClass}>{type === 'transfer' ? '转出账户' : '资金来源'}</label>
            <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={inputClass}>
              <option value="">选择资产</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(type === 'income' || type === 'transfer') && (
          <div>
            <label className={labelClass}>{type === 'transfer' ? '转入账户' : '资金去向'}</label>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputClass}>
              <option value="">选择资产</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>日期</label>
          <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>备注</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="可选，如：午餐"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm text-ledger-muted hover:text-ledger-text bg-ledger-bg border border-ledger-primary/20 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
