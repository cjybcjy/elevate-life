import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Asset {
  id: string;
  name: string;
  category: string;
  balance: string;
  quantity: number | null;
  stockCode: string | null;
  market: string | null;
  currency: string;
  liquidityTier: string | null;
  costBasis: string | null;
}

interface AssetFormModalProps {
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}

const categoryOptions = [
  { value: 'cash', label: '现金' },
  { value: 'real_estate', label: '房产' },
  { value: 'gold_physical', label: '实物黄金' },
  { value: 'gold_paper', label: '纸黄金' },
  { value: 'stock', label: '股票' },
  { value: 'fund', label: '基金' },
  { value: 'bond', label: '债券' },
  { value: 'vehicle', label: '车辆' },
  { value: 'crypto', label: '加密货币' },
  { value: 'other', label: '其他' },
];

const floatingCategories = ['gold_physical', 'gold_paper', 'stock', 'crypto'];

export default function AssetFormModal({ asset, onClose, onSaved }: AssetFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('cash');
  const [balance, setBalance] = useState('');
  const [quantity, setQuantity] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isFloating = floatingCategories.includes(category);
  const isGold = category === 'gold_physical' || category === 'gold_paper';

  useEffect(() => {
    if (asset) {
      setName(asset.name);
      setCategory(asset.category);
      setBalance(asset.balance || '');
      setQuantity(asset.quantity?.toString() || '');
      setStockCode(asset.stockCode || '');
      setCostBasis(asset.costBasis || '');
    } else {
      setName('');
      setCategory('cash');
      setBalance('');
      setQuantity('');
      setStockCode('');
      setCostBasis('');
    }
  }, [asset]);

  const handleSave = async () => {
    setValidationError('');
    if (!name.trim()) {
      setValidationError('请输入资产名称');
      return;
    }
    if (isGold && !quantity) {
      setValidationError('请输入黄金数量（克）');
      return;
    }
    if (!isGold && !balance) {
      setValidationError('请输入当前金额');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        category,
        balance: isGold ? undefined : (balance || undefined),
        quantity: quantity || undefined,
        stockCode: stockCode || undefined,
        costBasis: costBasis || undefined,
      };

      if (asset) {
        await api.patch(`/assets/${asset.id}`, payload);
      } else {
        await api.post('/assets', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save asset failed:', err);
      alert('保存失败，请检查数据');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-ledger-bg border border-ledger-primary/20 rounded-lg px-3 py-2.5 text-sm text-ledger-text placeholder:text-ledger-muted/50 focus:outline-none focus:border-ledger-primary/40';
  const labelClass = 'block text-sm text-ledger-muted mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-ledger-surface rounded-xl w-full max-w-lg mx-4 border border-ledger-primary/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ledger-primary/10">
          <h2 className="text-lg font-medium text-ledger-text">{asset ? '编辑资产' : '新增资产'}</h2>
          <button onClick={onClose} className="text-ledger-muted hover:text-ledger-text text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>名称 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="例如：招行储蓄卡" />
          </div>

          <div>
            <label className={labelClass}>类型 *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {!isGold && (
            <div>
              <label className={labelClass}>{isFloating ? '当前金额 / 市值' : '当前金额'} *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ledger-muted text-sm">¥</span>
                <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
          )}

          {isGold && (
            <div className="text-sm text-ledger-muted bg-ledger-bg rounded-lg px-3 py-2.5 border border-ledger-primary/20">
              <span className="text-yellow-500">⚡</span> 市值自动根据实时金价 × 数量计算，每晚 21:00 更新金价
            </div>
          )}

          {isFloating && (
            <>
              <div>
                <label className={labelClass}>数量</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} placeholder="例如：100" />
              </div>
              <div>
                <label className={labelClass}>持仓成本价</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ledger-muted text-sm">¥</span>
                  <input type="number" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
                </div>
              </div>
            </>
          )}

          {category === 'stock' && (
            <div>
              <label className={labelClass}>股票代码</label>
              <input type="text" value={stockCode} onChange={(e) => setStockCode(e.target.value)} className={inputClass} placeholder="例如：000001" />
            </div>
          )}

          {validationError && (
            <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
              {validationError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-ledger-muted hover:text-ledger-text bg-ledger-bg border border-ledger-primary/20">取消</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
