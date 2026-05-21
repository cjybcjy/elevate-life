import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Liability {
  id: string;
  name: string;
  category: string;
  principal: string;
  currentBalance: string;
  interestRate: number;
  termMonths: number;
  startDate: string;
  paymentMethod: string;
  monthlyPayment: string | null;
  linkedAssetId: string | null;
}

interface Asset {
  id: string;
  name: string;
}

interface LiabilityFormModalProps {
  liability: Liability | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LiabilityFormModal({ liability, onClose, onSaved }: LiabilityFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('住房贷款');
  const [principal, setPrincipal] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [startDate, setStartDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('equal_interest');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [linkedAssetId, setLinkedAssetId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/assets').then((res: any) => setAssets(res.data || []));
  }, []);

  useEffect(() => {
    if (liability) {
      setName(liability.name);
      setCategory(liability.category);
      setPrincipal(liability.principal);
      setCurrentBalance(liability.currentBalance || '');
      setInterestRate((liability.interestRate * 100).toString());
      setTermMonths(liability.termMonths.toString());
      setStartDate(liability.startDate ? liability.startDate.slice(0, 10) : '');
      setPaymentMethod(liability.paymentMethod);
      setMonthlyPayment(liability.monthlyPayment || '');
      setLinkedAssetId(liability.linkedAssetId || '');
    } else {
      setName('');
      setCategory('住房贷款');
      setPrincipal('');
      setCurrentBalance('');
      setInterestRate('');
      setTermMonths('');
      setStartDate('');
      setPaymentMethod('equal_interest');
      setMonthlyPayment('');
      setLinkedAssetId('');
    }
  }, [liability]);

  const handleSave = async () => {
    if (!name.trim() || !principal || !interestRate || !termMonths || !startDate) return;

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        category: category.trim(),
        principal,
        currentBalance: currentBalance || principal,
        interestRate: Number(interestRate) / 100,
        termMonths: Number(termMonths),
        startDate: new Date(startDate).toISOString(),
        paymentMethod,
        monthlyPayment: monthlyPayment || undefined,
        linkedAssetId: linkedAssetId || undefined,
      };

      if (liability) {
        await api.patch(`/liabilities/${liability.id}`, payload);
      } else {
        await api.post('/liabilities', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save liability failed:', err);
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
          <h2 className="text-lg font-medium text-ledger-text">{liability ? '编辑负债' : '新增负债'}</h2>
          <button onClick={onClose} className="text-ledger-muted hover:text-ledger-text text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>名称 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="例如：招行住房贷款" />
          </div>

          <div>
            <label className={labelClass}>类型 *</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} placeholder="例如：住房贷款" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>本金 *</label>
              <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>当前余额</label>
              <input type="number" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} className={inputClass} placeholder="默认等于本金" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>年利率 (%) *</label>
              <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className={inputClass} placeholder="4.5" />
            </div>
            <div>
              <label className={labelClass}>期限（月）*</label>
              <input type="number" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className={inputClass} placeholder="360" />
            </div>
          </div>

          <div>
            <label className={labelClass}>起始日期 *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>还款方式 *</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
              <option value="equal_interest">等额本息</option>
              <option value="equal_principal">等额本金</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>月供（自填）</label>
            <input type="number" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>

          <div>
            <label className={labelClass}>关联资产</label>
            <select value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className={inputClass}>
              <option value="">无</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
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
