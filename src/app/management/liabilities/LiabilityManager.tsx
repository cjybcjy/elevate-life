'use client';

import { useState, useEffect, useOptimistic } from 'react';
import { createLiability, updateLiability, deleteLiability } from '@/lib/actions/liabilities';
import { createTransaction, deleteTransaction, updateTransaction } from '@/lib/actions/ledger';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { useLiabilities } from '@/hooks/useLiabilities';
import { useTransactions } from '@/hooks/useTransactions';
import { useAssets } from '@/hooks/useAssets';
import { useToast } from '@/components/common/Toast';
import { useSWRConfig } from 'swr';

interface Liability {
  id: string;
  name: string;
  category: string;
  principal: string;
  currentBalance: string;
  interestRate: number;
  termMonths: number;
  startDate: string | Date;
  paymentMethod: string;
  monthlyPayment?: string | null;
}

interface LiabilityManagerProps {
  liabilities: Liability[];
  transactions: any[];
  assets: any[];
}

const paymentMethodLabel: Record<string, string> = {
  equal_interest: '等额本息',
  equal_principal: '等额本金',
};

export default function LiabilityManager() {
  const { data: liabData, isLoading: liabLoading } = useLiabilities();
  const initial = liabData?.data ?? [];
  const { data: txData } = useTransactions();
  const transactions = txData?.data ?? [];
  const { data: assetData } = useAssets();
  const assets = assetData?.data ?? [];
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [liabilities, setLiabilities] = useState(initial);
  useEffect(() => { setLiabilities(initial); }, [initial]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRepayId, setExpandedRepayId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [repayForm, setRepayForm] = useState({
    amount: '',
    fromAccountId: '',
    description: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });
  const [repayMsg, setRepayMsg] = useState('');
  const [editingRepayId, setEditingRepayId] = useState<string | null>(null);
  const [editRepayForm, setEditRepayForm] = useState({ amount: '', description: '', occurredAt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', category: '', principal: '', currentBalance: '',
    interestRate: '', termMonths: '', startDate: '', paymentMethod: 'equal_interest',
  });

  async function handleCreate(formData: FormData) {
    setError('');
    setLoading(true);
    const result = await createLiability({
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      principal: formData.get('principal') as string,
      currentBalance: (formData.get('currentBalance') as string) || undefined,
      interestRate: formData.get('interestRate') as string,
      termMonths: Number(formData.get('termMonths')),
      startDate: formData.get('startDate') as string,
      paymentMethod: (formData.get('paymentMethod') as string) || 'equal_interest',
    });
    if (result.success) {
      (document.getElementById('create-form') as HTMLFormElement)?.reset();
      mutate('liabilities'); mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '创建失败，请检查数据是否正确');
    }
    setLoading(false);
  }

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    setLiabilities((prev) => prev.filter((l) => l.id !== id));
    const result = await deleteLiability(id);
    if (result.success) {
      mutate('liabilities'); mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setLiabilities((prev) => [...prev, liabilities.find((l) => l.id === id)!]);
      setError(result.error || '删除失败');
    }
  }

  async function handleRepay(liabilityId: string) {
    const amount = repayForm.amount;
    if (!amount || parseFloat(amount) <= 0) return;

    setRepayMsg('');
    setError('');
    setLoading(true);

    const result = await createTransaction({
      type: 'EXPENSE',
      amount,
      fromAccountId: repayForm.fromAccountId || undefined,
      liabilityId,
      description: repayForm.description || '还款',
      occurredAt: repayForm.occurredAt,
    });

    if (result.success) {
      setRepayMsg('还款记录已创建');
      setRepayForm({
        amount: '',
        fromAccountId: '',
        description: '',
        occurredAt: new Date().toISOString().split('T')[0],
      });
      mutate('liabilities'); mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '还款失败');
    }
    setLoading(false);
  }

  async function handleDeleteRepay(txId: string) {
    const result = await deleteTransaction(txId);
    if (result.success) {
      mutate('liabilities'); mutate('transactions');
    } else {
      setError(result.error || '删除失败');
    }
  }

  async function handleUpdateRepay() {
    if (!editingRepayId) return;
    setError('');
    const result = await updateTransaction(editingRepayId, {
      amount: editRepayForm.amount || undefined,
      description: editRepayForm.description || undefined,
      occurredAt: editRepayForm.occurredAt || undefined,
    });
    if (result.success) {
      setEditingRepayId(null);
      mutate('liabilities'); mutate('transactions');
    } else {
      setError(result.error || '更新失败');
    }
  }

  function startEditRepay(t: any) {
    setEditingRepayId(t.id);
    setEditRepayForm({
      amount: t.amount?.toString() || '',
      description: t.description || '',
      occurredAt: new Date(t.occurredAt).toISOString().split('T')[0],
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    setError('');
    setLoading(true);

    const result = await updateLiability(editingId, {
      name: editForm.name || undefined,
      category: editForm.category || undefined,
      principal: editForm.principal || undefined,
      currentBalance: editForm.currentBalance || undefined,
      interestRate: editForm.interestRate || undefined,
      termMonths: editForm.termMonths ? Number(editForm.termMonths) : undefined,
      startDate: editForm.startDate || undefined,
      paymentMethod: editForm.paymentMethod || undefined,
    });

    if (result.success) {
      setEditingId(null);
      mutate('liabilities'); mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '更新失败');
    }
    setLoading(false);
  }

  function startEdit(liability: Liability) {
    setEditingId(liability.id);
    setExpandedRepayId(null);
    setExpandedHistoryId(null);
    setEditForm({
      name: liability.name,
      category: liability.category,
      principal: liability.principal,
      currentBalance: liability.currentBalance,
      interestRate: liability.interestRate.toString(),
      termMonths: liability.termMonths.toString(),
      startDate: typeof liability.startDate === 'string'
        ? liability.startDate.split('T')[0]
        : new Date(liability.startDate).toISOString().split('T')[0],
      paymentMethod: liability.paymentMethod,
    });
  }

  // Get payment history for a liability
  const getPaymentHistory = (liabilityId: string) => {
    return transactions
      .filter((t: any) => t.liabilityId === liabilityId && t.type === 'EXPENSE')
      .sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">负债管理</h1>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {repayMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <span>{repayMsg}</span>
          <button onClick={() => setRepayMsg('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="负债名称"
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
            <option value="mortgage">🏠 房贷</option>
            <option value="car_loan">🚗 车贷</option>
            <option value="credit_card">💳 信用卡</option>
            <option value="personal_loan">👤 个人贷款</option>
            <option value="student_loan">🎓 助学贷款</option>
            <option value="business_loan">🏢 经营贷款</option>
            <option value="other">📦 其他</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">本金</label>
          <input
            name="principal"
            type="number"
            step="0.01"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">当前余额</label>
          <input
            name="currentBalance"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="默认等于本金"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">年利率</label>
          <input
            name="interestRate"
            type="number"
            step="0.0001"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.05"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">期限（月）</label>
          <input
            name="termMonths"
            type="number"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="12"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
          <input
            name="startDate"
            type="date"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">还款方式</label>
          <select
            name="paymentMethod"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="equal_interest">等额本息</option>
            <option value="equal_principal">等额本金</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '创建中...' : '创建'}
        </button>
      </form>

      <div className="rounded-xl bg-ledger-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-bg text-left text-ledger-muted">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">本金</th>
              <th className="px-4 py-3 font-medium">当前余额</th>
              <th className="px-4 py-3 font-medium">已还</th>
              <th className="px-4 py-3 font-medium">年利率</th>
              <th className="px-4 py-3 font-medium">还款方式</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {liabilities.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ledger-muted">
                  暂无负债
                </td>
              </tr>
            )}
            {liabilities.map((liability) => {
              const principalVal = parseFloat(liability.principal) || 0;
              const balanceVal = parseFloat(liability.currentBalance) || 0;
              const paidVal = principalVal - balanceVal;
              const isExpanded = expandedRepayId === liability.id;
              const isHistoryOpen = expandedHistoryId === liability.id;
              const isEditOpen = editingId === liability.id;
              const history = isHistoryOpen ? getPaymentHistory(liability.id) : [];
              const historyCount = getPaymentHistory(liability.id).length;

              return (
                <tr key={liability.id} className="border-b border-ledger-bg last:border-0">
                  <td className="px-4 py-3 text-white">
                    <div>{liability.name}</div>
                    <div className="text-xs text-ledger-muted mt-0.5">{paymentMethodLabel[liability.paymentMethod] || liability.paymentMethod}</div>
                  </td>
                  <td className="px-4 py-3 text-ledger-muted">{liability.category}</td>
                  <td className="px-4 py-3 text-white">
                    <AmountDisplay amount={principalVal} />
                  </td>
                  <td className="px-4 py-3 text-white">
                    <AmountDisplay amount={balanceVal} className="font-medium" />
                  </td>
                  <td className="px-4 py-3">
                    {paidVal > 0 ? (
                      <div>
                        <AmountDisplay amount={paidVal} className="text-green-400 text-xs" />
                        <div className="w-16 h-1.5 bg-ledger-bg rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                            style={{ width: `${Math.min((paidVal / principalVal) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-ledger-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ledger-muted">
                    {(liability.interestRate * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-ledger-muted">
                    {paymentMethodLabel[liability.paymentMethod] || liability.paymentMethod}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedRepayId(isExpanded ? null : liability.id);
                          setExpandedHistoryId(null);
                          setRepayForm({
                            amount: '',
                            fromAccountId: '',
                            description: '',
                            occurredAt: new Date().toISOString().split('T')[0],
                          });
                          setRepayMsg('');
                        }}
                        className={`text-xs px-2 py-1 rounded ${
                          isExpanded
                            ? 'bg-ledger-accent/20 text-ledger-accent'
                            : 'bg-ledger-bg text-ledger-muted hover:text-white'
                        }`}
                      >
                        {isExpanded ? '收起' : '还款'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedHistoryId(isHistoryOpen ? null : liability.id);
                          setExpandedRepayId(null);
                        }}
                        className={`text-xs px-2 py-1 rounded ${
                          isHistoryOpen
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'bg-ledger-bg text-ledger-muted hover:text-white'
                        }`}
                      >
                        {isHistoryOpen ? '收起' : `流水(${historyCount})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => isEditOpen ? setEditingId(null) : startEdit(liability)}
                        className={`text-xs px-2 py-1 rounded ${
                          isEditOpen
                            ? 'bg-ledger-accent/20 text-ledger-accent'
                            : 'bg-ledger-bg text-ledger-muted hover:text-white'
                        }`}
                      >
                        {isEditOpen ? '取消编辑' : '编辑'}
                      </button>
                      <form action={handleDelete} className="inline">
                        <input type="hidden" name="id" value={liability.id} />
                        <button type="submit" className="text-ledger-danger hover:underline text-xs">
                          删除
                        </button>
                      </form>
                    </div>

                    {/* Inline Edit Form */}
                    {isEditOpen && (
                      <div className="mt-3 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">名称</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">分类</label>
                            <select
                              value={editForm.category}
                              onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            >
                              <option value="mortgage">🏠 房贷</option>
                              <option value="car_loan">🚗 车贷</option>
                              <option value="credit_card">💳 信用卡</option>
                              <option value="personal_loan">👤 个人贷款</option>
                              <option value="student_loan">🎓 助学贷款</option>
                              <option value="business_loan">🏢 经营贷款</option>
                              <option value="other">📦 其他</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">本金</label>
                            <input
                              type="number" step="0.01"
                              value={editForm.principal}
                              onChange={e => setEditForm(prev => ({ ...prev, principal: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">余额</label>
                            <input
                              type="number" step="0.01"
                              value={editForm.currentBalance}
                              onChange={e => setEditForm(prev => ({ ...prev, currentBalance: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">年利率</label>
                            <input
                              type="number" step="0.0001"
                              value={editForm.interestRate}
                              onChange={e => setEditForm(prev => ({ ...prev, interestRate: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">期限(月)</label>
                            <input
                              type="number"
                              value={editForm.termMonths}
                              onChange={e => setEditForm(prev => ({ ...prev, termMonths: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-16"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={e => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={loading}
                            className="rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {loading ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Repayment Form */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-ledger-bg rounded-lg border border-ledger-primary/20">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">还款金额</label>
                            <input
                              type="number"
                              step="0.01"
                              value={repayForm.amount}
                              onChange={e => setRepayForm(prev => ({ ...prev, amount: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-28"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">日期</label>
                            <input
                              type="date"
                              value={repayForm.occurredAt}
                              onChange={e => setRepayForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">付款账户</label>
                            <select
                              value={repayForm.fromAccountId}
                              onChange={e => setRepayForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ledger-accent"
                            >
                              <option value="">不指定</option>
                              {assets.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">备注</label>
                            <input
                              type="text"
                              value={repayForm.description}
                              onChange={e => setRepayForm(prev => ({ ...prev, description: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                              placeholder="还款备注"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRepay(liability.id)}
                            disabled={loading || !repayForm.amount || parseFloat(repayForm.amount) <= 0}
                            className="rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {loading ? '处理中...' : '确认还款'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Payment History */}
                    {isHistoryOpen && (
                      <div className="mt-3 p-3 bg-ledger-bg rounded-lg border border-blue-500/20">
                        <div className="text-xs text-ledger-muted mb-2">
                          还款流水 · 共 {history.length} 笔
                        </div>
                        {history.length === 0 ? (
                          <div className="text-xs text-ledger-muted py-2">暂无还款记录</div>
                        ) : (
                          <div className="space-y-1.5">
                            {history.slice(0, 10).map((t: any) => (
                              <div key={t.id}>
                                <div className="flex items-center gap-3 text-xs bg-ledger-surface/50 rounded-md px-3 py-1.5">
                                  <span className="text-ledger-muted w-20 shrink-0">
                                    {new Date(t.occurredAt).toLocaleDateString('zh-CN')}
                                  </span>
                                  <AmountDisplay amount={parseFloat(t.amount || '0')} className="text-green-400 font-medium w-24 shrink-0" />
                                  {t.fromAsset && (
                                    <span className="text-ledger-muted shrink-0">{t.fromAsset.name}</span>
                                  )}
                                  <span className="text-ledger-muted flex-1 truncate">{t.description || '还款'}</span>
                                  <button
                                    type="button"
                                    onClick={() => editingRepayId === t.id ? setEditingRepayId(null) : startEditRepay(t)}
                                    className="text-ledger-muted hover:text-white shrink-0"
                                  >
                                    {editingRepayId === t.id ? '取消' : '编辑'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { if (confirm('确认删除这笔还款？')) handleDeleteRepay(t.id); }}
                                    className="text-ledger-danger hover:underline shrink-0"
                                  >
                                    删除
                                  </button>
                                </div>
                                {editingRepayId === t.id && (
                                  <div className="mt-1 p-2 bg-ledger-bg rounded-md border border-ledger-accent/30">
                                    <div className="flex flex-wrap gap-2 items-end">
                                      <div>
                                        <label className="block text-xs text-ledger-muted mb-1">金额</label>
                                        <input
                                          type="number" step="0.01"
                                          value={editRepayForm.amount}
                                          onChange={e => setEditRepayForm(p => ({ ...p, amount: e.target.value }))}
                                          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-ledger-muted mb-1">日期</label>
                                        <input
                                          type="date"
                                          value={editRepayForm.occurredAt}
                                          onChange={e => setEditRepayForm(p => ({ ...p, occurredAt: e.target.value }))}
                                          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-ledger-muted mb-1">备注</label>
                                        <input
                                          type="text"
                                          value={editRepayForm.description}
                                          onChange={e => setEditRepayForm(p => ({ ...p, description: e.target.value }))}
                                          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={handleUpdateRepay}
                                        className="rounded-md bg-ledger-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {history.length > 10 && (
                              <div className="text-xs text-ledger-muted pt-1">
                                ...还有 {history.length - 10} 笔
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
