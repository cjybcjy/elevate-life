'use client';

import { useState, useEffect, useCallback, useOptimistic } from 'react';
import { createTransaction, deleteTransaction, updateTransactionReconciled, updateTransaction } from '@/lib/actions/ledger';
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
} from '@/lib/actions/recurring';

interface Template {
  name: string;
  type: string;
  amount: string;
  categoryId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
}

const TEMPLATES_KEY = 'ledger-templates';

function loadTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // localStorage full or unavailable
  }
}

const curSym: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };
const frequencyLabel: Record<string, string> = {
  daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年',
};

const typeLabel = (type: string) => {
  switch (type) {
    case 'INCOME': return '收入';
    case 'EXPENSE': return '支出';
    case 'TRANSFER': return '转账';
    default: return type;
  }
};

const typeBadgeClass = (type: string) => {
  switch (type) {
    case 'INCOME': return 'bg-emerald-900/50 text-ledger-success';
    case 'EXPENSE': return 'bg-red-900/50 text-ledger-danger';
    case 'TRANSFER': return 'bg-blue-900/50 text-ledger-accent';
    default: return 'bg-ledger-bg text-ledger-muted';
  }
};

import { useTransactions } from '@/hooks/useTransactions';
import { useAssets } from '@/hooks/useAssets';
import { useToast } from '@/components/common/Toast';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { getCategories } from '@/lib/actions/categories';

// ... (keep all existing type definitions and utility functions above)

export default function LedgerManager() {
  const { data: txData, isLoading: txLoading } = useTransactions();
  const initialTx = txData?.data ?? [];
  const { data: assetData } = useAssets();
  const assets = assetData?.data ?? [];
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const { data: catData } = useSWR('categories', () => getCategories().then(r => r.success ? (r.data ?? []) : []));
  const categories = catData ?? [];

  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring'>('transactions');
  const [transactions, setTransactions] = useState(initialTx);
  const [recurringRules, setRecurringRules] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconAmount, setReconAmount] = useState('');
  const [reconDate, setReconDate] = useState(new Date().toISOString().split('T')[0]);
  const [reconDays, setReconDays] = useState(3);
  const [reconCandidates, setReconCandidates] = useState<any[]>([]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [budgetOptions, setBudgetOptions] = useState<any[]>([]);
  const [editTxForm, setEditTxForm] = useState({ amount: '', categoryId: '', budgetId: '', description: '', occurredAt: '' });
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editRecurringForm, setEditRecurringForm] = useState({
    name: '', amount: '', frequency: 'monthly', interval: 1, nextDueDate: '', categoryId: '', fromAccountId: '', toAccountId: '',
  });
  const [formValues, setFormValues] = useState({
    type: 'EXPENSE',
    amount: '',
    currency: 'CNY',
    categoryId: '',
    budgetId: '',
    fromAccountId: '',
    toAccountId: '',
    description: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });

  // Recurring form state
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    type: 'EXPENSE',
    amount: '',
    currency: 'CNY',
    categoryId: '',
    fromAccountId: '',
    toAccountId: '',
    description: '',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    setTemplates(loadTemplates());
    try {
      const tab = localStorage.getItem('ledger-tab');
      if (tab === 'recurring' || tab === 'transactions') setActiveTab(tab);
    } catch {}
  }, []);

  // Fetch budget options when category or date changes
  useEffect(() => {
    if (formValues.categoryId && formValues.occurredAt) {
      import('@/lib/actions/budget').then(({ getBudgetsForCategory }) => {
        getBudgetsForCategory(formValues.occurredAt, formValues.categoryId)
          .then(res => { if (res.success) setBudgetOptions(res.data ?? []); });
      });
    } else {
      setBudgetOptions([]);
    }
  }, [formValues.categoryId, formValues.occurredAt]);

  // Sync state when SWR data changes
  useEffect(() => { setTransactions(initialTx); }, [initialTx]);

  const applyTemplate = useCallback((t: Template) => {
    setFormValues({
      type: t.type,
      amount: t.amount,
      currency: (t as any).currency || 'CNY',
      categoryId: t.categoryId || '',
      budgetId: '',
      fromAccountId: t.fromAccountId || '',
      toAccountId: t.toAccountId || '',
      description: t.description || '',
      occurredAt: new Date().toISOString().split('T')[0],
    });
  }, []);

  const saveCurrentAsTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    const newTemplate: Template = {
      name: templateName.trim(),
      type: formValues.type,
      amount: formValues.amount,
      categoryId: formValues.categoryId,
      fromAccountId: formValues.fromAccountId,
      toAccountId: formValues.toAccountId,
      description: formValues.description,
    };
    const updated = [...templates.filter(t => t.name !== newTemplate.name), newTemplate];
    setTemplates(updated);
    saveTemplates(updated);
    setTemplateName('');
    setShowTemplateSave(false);
  }, [templateName, formValues, templates]);

  const deleteTemplate = useCallback((name: string) => {
    const updated = templates.filter(t => t.name !== name);
    setTemplates(updated);
    saveTemplates(updated);
  }, [templates]);

  const searchReconciliation = useCallback(() => {
    if (!reconAmount) return;
    const refAmount = parseFloat(reconAmount);
    const refDate = new Date(reconDate);
    const threshold = Math.max(refAmount * 0.05, 1); // 5% or at least 1 yuan
    const candidates = transactions.filter((t: any) => {
      const tAmount = parseFloat(t.amount || '0');
      const tDate = new Date(t.occurredAt);
      const dayDiff = Math.abs(tDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.abs(tAmount - refAmount) <= threshold && dayDiff <= reconDays;
    });
    setReconCandidates(candidates);
  }, [reconAmount, reconDate, reconDays, transactions]);

  async function toggleReconciled(transactionId: string, currentStatus: boolean) {
    setTransactions(prev => prev.map(t =>
      t.id === transactionId ? { ...t, reconciled: !currentStatus } : t
    ));
    await updateTransactionReconciled(transactionId, !currentStatus);
    mutate('transactions'); toast.success('操作成功');
  }

  async function handleCreate(formData: FormData) {
    setError('');
    setLoading(true);
    const result = await createTransaction({
      type: formData.get('type') as string,
      amount: formData.get('amount') as string,
      currency: (formData.get('currency') as string) || 'CNY',
      categoryId: (formData.get('categoryId') as string) || undefined,
      fromAccountId: (formData.get('fromAccountId') as string) || undefined,
      toAccountId: (formData.get('toAccountId') as string) || undefined,
      liabilityId: (formData.get('liabilityId') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      occurredAt: formData.get('occurredAt') as string,
    });
    if (result.success) {
      (document.getElementById('create-form') as HTMLFormElement)?.reset();
      setFormValues({
        type: 'EXPENSE',
        amount: '',
        currency: 'CNY',
        categoryId: '',
        budgetId: '',
        fromAccountId: '',
        toAccountId: '',
        description: '',
        occurredAt: new Date().toISOString().split('T')[0],
      });
      mutate('transactions'); toast.success('操作成功');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '创建失败');
    }
    setLoading(false);
  }

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    setTransactions(prev => prev.filter(t => t.id !== id));
    const result = await deleteTransaction(id);
    if (result.success) {
      mutate('transactions'); toast.success('操作成功');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setTransactions(prev => [...prev, initialTx.find((t: any) => t.id === id)!]);
      setError(result.error || '删除失败');
    }
  }

  async function handleCreateRecurring(formData: FormData) {
    setError('');
    setLoading(true);
    const result = await createRecurringRule({
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      amount: formData.get('amount') as string,
      currency: (formData.get('currency') as string) || 'CNY',
      categoryId: (formData.get('categoryId') as string) || undefined,
      fromAccountId: (formData.get('fromAccountId') as string) || undefined,
      toAccountId: (formData.get('toAccountId') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      frequency: formData.get('frequency') as string,
      interval: Number(formData.get('interval') || 1),
      startDate: formData.get('startDate') as string,
    });
    if (result.success) {
      (document.getElementById('recurring-form') as HTMLFormElement)?.reset();
      setRecurringForm({
        name: '',
        type: 'EXPENSE',
        amount: '',
        currency: 'CNY',
        categoryId: '',
        fromAccountId: '',
        toAccountId: '',
        description: '',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date().toISOString().split('T')[0],
      });
      mutate('transactions'); toast.success('操作成功');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '创建失败');
    }
    setLoading(false);
  }

  async function handleToggleRecurring(ruleId: string) {
    setRecurringRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    ));
    await toggleRecurringRule(ruleId);
    mutate('transactions'); toast.success('操作成功');
  }

  async function handleDeleteRecurring(ruleId: string) {
    setRecurringRules(prev => prev.filter(r => r.id !== ruleId));
    const result = await deleteRecurringRule(ruleId);
    if (result.success) {
      mutate('transactions'); toast.success('操作成功');
    } else {
      setError(result.error || '删除失败');
    }
  }


  async function handleUpdateTransaction(txId: string) {
    if (!editTxForm.amount) return;
    setError('');
    const result = await updateTransaction(txId, {
      amount: editTxForm.amount || undefined,
      categoryId: editTxForm.categoryId || undefined,
      budgetId: editTxForm.budgetId || undefined,
      description: editTxForm.description || undefined,
      occurredAt: editTxForm.occurredAt || undefined,
    });
    if (result.success) {
      setEditingTxId(null);
      mutate('transactions'); toast.success('操作成功');
    } else {
      setError(result.error || '更新失败');
    }
  }

  function startEditTx(tx: any) {
    setEditingTxId(tx.id);
    setEditTxForm({
      amount: tx.amount?.toString() || '',
      categoryId: tx.categoryId || '',
      budgetId: tx.budgetId || '',
      description: tx.description || '',
      occurredAt: new Date(tx.occurredAt).toISOString().split('T')[0],
    });
    // Fetch budgets for the editing transaction
    if (tx.categoryId) {
      const txDate = new Date(tx.occurredAt).toISOString().slice(0, 10);
      import('@/lib/actions/budget').then(({ getBudgetsForCategory }) => {
        getBudgetsForCategory(txDate, tx.categoryId)
          .then(res => { if (res.success) setBudgetOptions(res.data ?? []); });
      });
    }
  }

  async function handleUpdateRecurring() {
    if (!editingRecurringId) return;
    setError('');
    const result = await updateRecurringRule(editingRecurringId, {
      name: editRecurringForm.name || undefined,
      categoryId: editRecurringForm.categoryId || undefined,
      fromAccountId: editRecurringForm.fromAccountId || undefined,
      toAccountId: editRecurringForm.toAccountId || undefined,
      amount: editRecurringForm.amount || undefined,
      frequency: editRecurringForm.frequency || undefined,
      interval: editRecurringForm.interval || undefined,
      nextDueDate: editRecurringForm.nextDueDate || undefined,
    });
    if (result.success) {
      setEditingRecurringId(null);
      mutate('transactions'); toast.success('操作成功');
    } else {
      setError(result.error || '更新失败');
    }
  }

  function startEditRecurring(r: any) {
    setEditingRecurringId(r.id);
    setEditRecurringForm({
      name: r.name,
      amount: r.amount?.toString() || '',
      categoryId: r.categoryId || '',
      fromAccountId: r.fromAccountId || '',
      toAccountId: r.toAccountId || '',
      frequency: r.frequency || 'monthly',
      interval: r.interval || 1,
      nextDueDate: new Date(r.nextDueDate).toISOString().split('T')[0],
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">流水管理</h1>
        <div className="flex rounded-lg bg-ledger-surface p-1">
          <button
            onClick={() => { setActiveTab('transactions'); try { localStorage.setItem('ledger-tab', 'transactions'); } catch {} }}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'transactions'
                ? 'bg-ledger-accent text-white'
                : 'text-ledger-muted hover:text-white'
            }`}
          >
            流水记录
          </button>
          <button
            onClick={() => { setActiveTab('recurring'); try { localStorage.setItem('ledger-tab', 'recurring'); } catch {} }}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'recurring'
                ? 'bg-ledger-accent text-white'
                : 'text-ledger-muted hover:text-white'
            }`}
          >
            周期交易
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {activeTab === 'transactions' && (
        <>
          {/* Template Quick Bar */}
          {templates.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-ledger-muted shrink-0">模板:</span>
              {templates.map(t => (
                <div key={t.name} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="px-2.5 py-1 text-xs rounded-full bg-ledger-surface border border-ledger-primary/20 text-ledger-muted hover:text-white hover:border-ledger-accent transition-colors"
                    title={`${typeLabel(t.type)} ¥${t.amount}${t.description ? ` - ${t.description}` : ''}`}
                  >
                    {t.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t.name)}
                    className="hidden group-hover:inline text-ledger-muted hover:text-ledger-danger text-xs leading-none"
                    title="删除模板"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create form */}
          <form
            id="create-form"
            action={handleCreate}
            className="mb-4 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-ledger-muted mb-1">类型</label>
              <select
                name="type"
                required
                value={formValues.type}
                onChange={e => setFormValues(prev => ({ ...prev, type: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="EXPENSE">支出</option>
                <option value="INCOME">收入</option>
                <option value="TRANSFER">转账</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">币种</label>
              <select
                name="currency"
                value={formValues.currency}
                onChange={e => setFormValues(prev => ({ ...prev, currency: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="CNY">¥ 人民币</option>
                <option value="USD">$ 美元</option>
                <option value="HKD">HK$ 港币</option>
                <option value="JPY">JP¥ 日元</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">金额</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                value={formValues.amount}
                onChange={e => setFormValues(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">分类</label>
              <select
                name="categoryId"
                value={formValues.categoryId}
                onChange={e => setFormValues(prev => ({ ...prev, categoryId: e.target.value, budgetId: '' }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {budgetOptions.length > 0 && (
              <div>
                <label className="block text-xs text-ledger-muted mb-1">预算</label>
                <select
                  name="budgetId"
                  value={formValues.budgetId}
                  onChange={e => setFormValues(prev => ({ ...prev, budgetId: e.target.value }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
                >
                  <option value="">-- 关联预算 --</option>
                  {budgetOptions.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-ledger-muted mb-1">来源账户</label>
              <select
                name="fromAccountId"
                value={formValues.fromAccountId}
                onChange={e => setFormValues(prev => ({ ...prev, fromAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">目标账户</label>
              <select
                name="toAccountId"
                value={formValues.toAccountId}
                onChange={e => setFormValues(prev => ({ ...prev, toAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">日期</label>
              <input
                name="occurredAt"
                type="date"
                required
                value={formValues.occurredAt}
                onChange={e => setFormValues(prev => ({ ...prev, occurredAt: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">备注</label>
              <input
                name="description"
                value={formValues.description}
                onChange={e => setFormValues(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                placeholder="备注"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建'}
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateSave(!showTemplateSave)}
                className="rounded-md bg-ledger-bg border border-ledger-primary/20 px-3 py-2 text-xs text-ledger-muted hover:text-white transition-colors"
                title="保存为模板"
              >
                📋
              </button>
            </div>
          </form>

          {/* Template Save Popup */}
          {showTemplateSave && (
            <div className="mb-4 flex items-center gap-2 bg-ledger-surface rounded-lg p-3 border border-ledger-primary/20">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="模板名称（如：午餐）"
                className="flex-1 rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                onKeyDown={e => e.key === 'Enter' && saveCurrentAsTemplate()}
              />
              <button
                type="button"
                onClick={saveCurrentAsTemplate}
                disabled={!templateName.trim()}
                className="rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                保存模板
              </button>
              <button
                type="button"
                onClick={() => { setShowTemplateSave(false); setTemplateName(''); }}
                className="text-ledger-muted hover:text-white text-xs"
              >
                取消
              </button>
            </div>
          )}

          {/* Reconciliation Toggle & Panel */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowReconciliation(!showReconciliation)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                showReconciliation
                  ? 'bg-ledger-accent/20 border-ledger-accent text-ledger-accent'
                  : 'bg-ledger-surface border-ledger-primary/20 text-ledger-muted hover:text-white'
              }`}
            >
              🔍 对账模式
            </button>
            {showReconciliation && (
              <div className="mt-3 rounded-xl bg-ledger-surface p-4 border border-ledger-primary/20">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs text-ledger-muted mb-1">参考金额</label>
                    <input
                      type="number"
                      step="0.01"
                      value={reconAmount}
                      onChange={e => setReconAmount(e.target.value)}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-28"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ledger-muted mb-1">参考日期</label>
                    <input
                      type="date"
                      value={reconDate}
                      onChange={e => setReconDate(e.target.value)}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-ledger-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ledger-muted mb-1">日期容差(天)</label>
                    <select
                      value={reconDays}
                      onChange={e => setReconDays(Number(e.target.value))}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-ledger-accent"
                    >
                      <option value={1}>±1天</option>
                      <option value={3}>±3天</option>
                      <option value={7}>±7天</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={searchReconciliation}
                    className="rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    搜索匹配
                  </button>
                </div>
                {reconCandidates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ledger-bg">
                    <p className="text-xs text-ledger-muted mb-2">
                      找到 {reconCandidates.length} 笔候选交易（金额差 &lt;5%，日期在 ±{reconDays} 天内）
                    </p>
                    {reconCandidates.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className={typeBadgeClass(t.type) + ' inline-block rounded-full px-2 py-0.5 text-xs font-medium'}>
                          {typeLabel(t.type)}
                        </span>
                        <span className="text-white">{(curSym[t.currency || 'CNY'] || '¥')}{t.amount}</span>
                        <span className="text-ledger-muted text-xs">{new Date(t.occurredAt).toLocaleDateString('zh-CN')}</span>
                        <span className="text-ledger-muted text-xs">{t.description || '--'}</span>
                        <button
                          type="button"
                          onClick={() => toggleReconciled(t.id, t.reconciled)}
                          className={`text-xs ml-auto px-2 py-0.5 rounded ${t.reconciled ? 'bg-green-900/30 text-green-400' : 'bg-ledger-bg text-ledger-muted hover:text-white'}`}
                        >
                          {t.reconciled ? '✅ 已对账' : '标记对账'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {reconCandidates.length === 0 && reconAmount && (
                  <p className="mt-3 pt-3 border-t border-ledger-bg text-xs text-ledger-muted">
                    未找到匹配交易
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl bg-ledger-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ledger-bg text-left text-ledger-muted">
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">金额</th>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">预算</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">目标</th>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">备注</th>
                  <th className="px-4 py-3 font-medium w-16">对账</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-ledger-muted">
                      暂无流水
                    </td>
                  </tr>
                )}
                {transactions.map((t: any) => (
                  <tr key={t.id} className="border-b border-ledger-bg last:border-0">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(t.type)}`}>
                        {typeLabel(t.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{(curSym[t.currency || 'CNY'] || '¥')}{t.amount}</td>
                    <td className="px-4 py-3 text-ledger-muted">{t.category?.name || '--'}</td>
                    <td className="px-4 py-3 text-ledger-muted text-xs">{t.budget?.name || '--'}</td>
                    <td className="px-4 py-3 text-ledger-muted">{t.fromAsset?.name || '--'}</td>
                    <td className="px-4 py-3 text-ledger-muted">{t.toAsset?.name || '--'}</td>
                    <td className="px-4 py-3 text-ledger-muted">
                      {new Date(t.occurredAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-ledger-muted">{t.description || '--'}</td>
                    <td className="px-4 py-3 text-center">
                      {t.reconciled ? (
                        <span className="text-green-400 text-xs" title="已对账">✓</span>
                      ) : (
                        <span className="text-ledger-muted/30 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => editingTxId === t.id ? setEditingTxId(null) : startEditTx(t)}
                          className="text-xs px-2 py-0.5 rounded bg-ledger-bg text-ledger-muted hover:text-white"
                        >
                          {editingTxId === t.id ? '取消' : '编辑'}
                        </button>
                        <form action={handleDelete} className="inline">
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className="text-ledger-danger hover:underline text-xs">
                            删除
                          </button>
                        </form>
                      </div>
                      {editingTxId === t.id && (
                        <div className="mt-2 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">金额</label>
                              <input
                                type="number" step="0.01"
                                value={editTxForm.amount}
                                onChange={e => setEditTxForm(p => ({ ...p, amount: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">分类</label>
                              <select
                                value={editTxForm.categoryId}
                                onChange={e => setEditTxForm(p => ({ ...p, categoryId: e.target.value, budgetId: '' }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                              >
                                <option value="">--</option>
                                {categories.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            {budgetOptions.length > 0 && (
                              <div>
                                <label className="block text-xs text-ledger-muted mb-1">预算</label>
                                <select
                                  value={editTxForm.budgetId}
                                  onChange={e => setEditTxForm(p => ({ ...p, budgetId: e.target.value }))}
                                  className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                                >
                                  <option value="">--</option>
                                  {budgetOptions.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">日期</label>
                              <input
                                type="date"
                                value={editTxForm.occurredAt}
                                onChange={e => setEditTxForm(p => ({ ...p, occurredAt: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">备注</label>
                              <input
                                type="text"
                                value={editTxForm.description}
                                onChange={e => setEditTxForm(p => ({ ...p, description: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateTransaction(t.id)}
                              className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'recurring' && (
        <>
          {/* Recurring Rule Create Form */}
          <form
            id="recurring-form"
            action={handleCreateRecurring}
            className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-ledger-muted mb-1">名称</label>
              <input
                name="name"
                required
                value={recurringForm.name}
                onChange={e => setRecurringForm(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-24"
                placeholder="如：房租"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">类型</label>
              <select
                name="type"
                required
                value={recurringForm.type}
                onChange={e => setRecurringForm(prev => ({ ...prev, type: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="EXPENSE">支出</option>
                <option value="INCOME">收入</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">币种</label>
              <select
                name="currency"
                value={recurringForm.currency}
                onChange={e => setRecurringForm(prev => ({ ...prev, currency: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="CNY">¥</option>
                <option value="USD">$</option>
                <option value="HKD">HK$</option>
                <option value="JPY">JP¥</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">金额</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                value={recurringForm.amount}
                onChange={e => setRecurringForm(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-24"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">分类</label>
              <select
                name="categoryId"
                value={recurringForm.categoryId}
                onChange={e => setRecurringForm(prev => ({ ...prev, categoryId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">来源账户</label>
              <select
                name="fromAccountId"
                value={recurringForm.fromAccountId}
                onChange={e => setRecurringForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">目标账户</label>
              <select
                name="toAccountId"
                value={recurringForm.toAccountId}
                onChange={e => setRecurringForm(prev => ({ ...prev, toAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">频率</label>
              <div className="flex gap-1 items-end">
                <span className="text-xs text-ledger-muted">每</span>
                <input
                  name="interval"
                  type="number"
                  min={1}
                  max={99}
                  value={recurringForm.interval}
                  onChange={e => setRecurringForm(prev => ({ ...prev, interval: Number(e.target.value) || 1 }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent w-14 text-center"
                />
                <select
                  name="frequency"
                  value={recurringForm.frequency}
                  onChange={e => setRecurringForm(prev => ({ ...prev, frequency: e.target.value }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
                >
                  <option value="monthly">个月</option>
                  <option value="weekly">周</option>
                  <option value="daily">天</option>
                  <option value="yearly">年</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
              <input
                name="startDate"
                type="date"
                required
                value={recurringForm.startDate}
                onChange={e => setRecurringForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">备注</label>
              <input
                name="description"
                value={recurringForm.description}
                onChange={e => setRecurringForm(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                placeholder="备注"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '创建中...' : '添加周期'}
            </button>
          </form>

          {/* Recurring Rules List */}
          <div className="rounded-xl bg-ledger-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ledger-bg text-left text-ledger-muted">
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">金额</th>
                  <th className="px-4 py-3 font-medium">频率</th>
                  <th className="px-4 py-3 font-medium">上次执行</th>
                  <th className="px-4 py-3 font-medium">下次到期</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {recurringRules.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-ledger-muted">
                      暂无周期交易
                    </td>
                  </tr>
                )}
                {recurringRules.map((r: any) => (
                  <tr key={r.id} className={`border-b border-ledger-bg last:border-0 ${!r.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-white">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(r.type)}`}>
                        {typeLabel(r.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{(curSym[r.currency || 'CNY'] || '¥')}{r.amount.toString()}</td>
                    <td className="px-4 py-3 text-ledger-muted">
                      {r.interval > 1 ? `每${r.interval}${frequencyLabel[r.frequency]?.replace('每', '')}` : frequencyLabel[r.frequency]}
                    </td>
                    <td className="px-4 py-3 text-ledger-muted">
                      {(() => {
                        const next = new Date(r.nextDueDate);
                        const mult = ({ daily: 1, weekly: 7, monthly: 30, yearly: 365 } as Record<string, number>)[r.frequency] || 30;
                        const last = new Date(next.getTime() - (r.interval || 1) * mult * 86400000);
                        return last.toLocaleDateString('zh-CN');
                      })()}
                    </td>
                    <td className="px-4 py-3 text-ledger-muted">
                      {new Date(r.nextDueDate).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleRecurring(r.id)}
                        className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-ledger-muted'}`}
                      >
                        {r.isActive ? '暂停' : '启用'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => editingRecurringId === r.id ? setEditingRecurringId(null) : startEditRecurring(r)}
                          className="text-xs px-2 py-0.5 rounded bg-ledger-bg text-ledger-muted hover:text-white"
                        >
                          {editingRecurringId === r.id ? '取消' : '编辑'}
                        </button>
                        <button
                          onClick={() => handleDeleteRecurring(r.id)}
                          className="text-ledger-danger hover:underline text-xs"
                        >
                          删除
                        </button>
                      </div>
                      {editingRecurringId === r.id && (
                        <div className="mt-2 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">名称</label>
                              <input type="text" value={editRecurringForm.name}
                                onChange={e => setEditRecurringForm(p => ({ ...p, name: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24" />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">金额</label>
                              <input type="number" step="0.01" value={editRecurringForm.amount}
                                onChange={e => setEditRecurringForm(p => ({ ...p, amount: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24" />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">分类</label>
                              <select value={editRecurringForm.categoryId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, categoryId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent">
                                <option value="">--</option>
                                {categories.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">来源账户</label>
                              <select value={editRecurringForm.fromAccountId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, fromAccountId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent">
                                <option value="">--</option>
                                {assets.map((a: any) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">目标账户</label>
                              <select value={editRecurringForm.toAccountId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, toAccountId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent">
                                <option value="">--</option>
                                {assets.map((a: any) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">频率</label>
                              <select value={editRecurringForm.frequency}
                                onChange={e => setEditRecurringForm(p => ({ ...p, frequency: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent">
                                <option value="monthly">每月</option>
                                <option value="weekly">每周</option>
                                <option value="daily">每天</option>
                                <option value="yearly">每年</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">下次到期</label>
                              <input type="date" value={editRecurringForm.nextDueDate}
                                onChange={e => setEditRecurringForm(p => ({ ...p, nextDueDate: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent" />
                            </div>
                            <button type="button" onClick={handleUpdateRecurring}
                              className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90">
                              保存
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
