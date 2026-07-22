'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createTransaction, deleteTransaction, updateTransactionReconciled, updateTransaction } from '@/lib/actions/ledger';
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
  processMyDueRecurring,
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

interface RecurringRule {
  id: string;
  name: string;
  type: string;
  amount: string;
  currency?: string | null;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  description?: string | null;
  frequency: string;
  interval: number;
  nextDueDate: string | Date;
  isActive: boolean;
}

type LedgerView = 'transactions' | 'recurring';

const TEMPLATES_CHANGED_EVENT = 'ledger-templates-changed';
const emptyTransactions: any[] = [];
const emptyTemplates: Template[] = [];

let cachedTemplatesRaw = '';
let cachedTemplates = emptyTemplates;

function readRecurringClockSnapshot() {
  if (typeof window === 'undefined') return 0;
  return Math.floor(Date.now() / 60_000);
}

function subscribeRecurringClock(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const timeoutId = window.setTimeout(callback, 0);
  const intervalId = window.setInterval(callback, 60_000);

  return () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
  };
}

function readTemplatesSnapshot(): Template[] {
  if (typeof window === 'undefined') return emptyTemplates;

  try {
    const raw = localStorage.getItem(TEMPLATES_KEY) ?? '';
    if (raw === cachedTemplatesRaw) return cachedTemplates;

    cachedTemplatesRaw = raw;
    if (!raw) {
      cachedTemplates = emptyTemplates;
      return cachedTemplates;
    }

    const parsed = JSON.parse(raw);
    cachedTemplates = Array.isArray(parsed) ? parsed : emptyTemplates;
    return cachedTemplates;
  } catch {
    cachedTemplates = emptyTemplates;
    return cachedTemplates;
  }
}

function saveTemplates(templates: Template[]) {
  if (!persistLedgerTemplates(localStorage, templates)) return false;
  window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
  return true;
}

function subscribeTemplates(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TEMPLATES_KEY) callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(TEMPLATES_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(TEMPLATES_CHANGED_EVENT, callback);
  };
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
import { getBudgetProgress, getBudgetsForCategory } from '@/lib/actions/budget';
import { buildTransactionUpdateInput } from '@/lib/ledger-edit';
import MobileQuickEntry, {
  type QuickEntrySubmitResult,
  type QuickEntrySubmitValues,
  type QuickEntryUndoResult,
} from '@/components/ledger/MobileQuickEntry';
import {
  buildQuickEntryFeedback,
  getQuickEntryBudgetRemainingSafely,
  isSessionExpiredError,
  LEDGER_TEMPLATES_KEY as TEMPLATES_KEY,
  persistLedgerTemplates,
  refreshLedgerCaches,
  withLedgerLoading,
} from '@/lib/ledger-quick-entry';

// ... (keep all existing type definitions and utility functions above)

export default function LedgerManager({ view = 'transactions' }: { view?: LedgerView }) {
  const searchParams = useSearchParams();
  const needsSourceFromQuery = searchParams.get('needsSource') === '1';
  const isCreateFocus = searchParams.get('focus') === 'create';
  const activeTab = view;
  const { data: txData } = useTransactions();
  const transactions = txData?.data ?? emptyTransactions;
  const { data: assetData } = useAssets();
  const assets = assetData?.data ?? [];
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const { data: catData } = useSWR('categories', () => getCategories().then(r => r.success ? (r.data ?? []) : []));
  const categories = catData ?? [];

  const templates = useSyncExternalStore(subscribeTemplates, readTemplatesSnapshot, () => emptyTemplates);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingRecurring, setProcessingRecurring] = useState(false);
  const [autoRecordMessage, setAutoRecordMessage] = useState<string | null>(null);
  const autoProcessedDueKeys = useRef<Set<string>>(new Set());
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconAmount, setReconAmount] = useState('');
  const [reconDate, setReconDate] = useState(new Date().toISOString().split('T')[0]);
  const [reconDays, setReconDays] = useState(3);
  const [reconCandidates, setReconCandidates] = useState<any[]>([]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [budgetOptions, setBudgetOptions] = useState<any[]>([]);
  const [editTxForm, setEditTxForm] = useState({ amount: '', categoryId: '', budgetId: '', fromAccountId: '', description: '', occurredAt: '' });
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editRecurringForm, setEditRecurringForm] = useState({
    name: '', amount: '', frequency: 'monthly', interval: 1, nextDueDate: '', categoryId: '', fromAccountId: '', toAccountId: '',
  });
  const createFormRef = useRef<HTMLFormElement>(null);
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
    isActive: true,
  });
  const recurringClockMinute = useSyncExternalStore(subscribeRecurringClock, readRecurringClockSnapshot, () => 0);
  const { data: recurringRules = [], mutate: mutateRecurringRules } = useSWR<RecurringRule[]>(
    activeTab === 'recurring' ? 'recurring-rules' : null,
    async () => {
      const result = await getRecurringRules();
      if (result.success) return result.data ?? [];
      if (result.error?.includes('会话密钥')) {
        window.location.href = '/login';
        return [];
      }
      throw new Error(result.error || '获取周期交易失败');
    },
    {
      onError(error) {
        setError(error instanceof Error ? error.message : '获取周期交易失败');
      },
    },
  );
  const recurringClockTime = recurringClockMinute > 0 ? recurringClockMinute * 60_000 : 0;
  const activeRecurringRules = recurringRules.filter((rule) => rule.isActive);
  const dueRecurringRules = recurringClockTime > 0
    ? activeRecurringRules.filter((rule) => new Date(rule.nextDueDate).getTime() <= recurringClockTime)
    : [];
  const dueRecurringKey = dueRecurringRules
    .map((rule) => `${rule.id}:${new Date(rule.nextDueDate).toISOString()}`)
    .sort()
    .join('|');
  const nextRecurringRule = activeRecurringRules.reduce<RecurringRule | null>((nearest, rule) => {
    if (!nearest) return rule;
    return new Date(rule.nextDueDate).getTime() < new Date(nearest.nextDueDate).getTime() ? rule : nearest;
  }, null);

  // Fetch budget options when category or date changes
  useEffect(() => {
    if (formValues.categoryId && formValues.occurredAt) {
      import('@/lib/actions/budget').then(({ getBudgetsForCategory }) => {
        getBudgetsForCategory(formValues.occurredAt, formValues.categoryId)
          .then(res => { if (res.success) setBudgetOptions(res.data ?? []); });
      });
    }
  }, [formValues.categoryId, formValues.occurredAt]);

  const formBudgetOptions = formValues.categoryId && formValues.occurredAt ? budgetOptions : [];

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
    saveTemplates(updated);
    setTemplateName('');
    setShowTemplateSave(false);
  }, [templateName, formValues, templates]);

  const deleteTemplate = useCallback((name: string) => {
    const updated = templates.filter(t => t.name !== name);
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

  async function toggleReconciled(transactionId: string, _currentStatus: boolean) {
    await updateTransactionReconciled(transactionId, !_currentStatus);
    mutate('transactions');
  }

  async function handleCreate(formData: FormData) {
    setError('');
    await withLedgerLoading(setLoading, async () => {
      const result = await createTransaction({
        type: formData.get('type') as string,
        amount: formData.get('amount') as string,
        currency: (formData.get('currency') as string) || 'CNY',
        categoryId: (formData.get('categoryId') as string) || undefined,
        budgetId: (formData.get('budgetId') as string) || undefined,
        fromAccountId: (formData.get('fromAccountId') as string) || undefined,
        toAccountId: (formData.get('toAccountId') as string) || undefined,
        liabilityId: (formData.get('liabilityId') as string) || undefined,
        description: (formData.get('description') as string) || undefined,
        occurredAt: formData.get('occurredAt') as string,
      });
      if (result.success) {
        createFormRef.current?.reset();
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
        toast.success('已记账');
        await refreshLedgerCaches(mutate);
      } else if (isSessionExpiredError(result.error)) {
        window.location.href = '/login';
      } else {
        setError(result.error || '创建失败');
      }
    });
  }

  async function submitMobileQuickEntry(
    values: QuickEntrySubmitValues,
  ): Promise<QuickEntrySubmitResult> {
    setError('');
    const result = await createTransaction({
      ...values,
      categoryId: values.categoryId || undefined,
      budgetId: values.budgetId || undefined,
      fromAccountId: values.fromAccountId || undefined,
      toAccountId: values.toAccountId || undefined,
      description: values.description || undefined,
    });
    if (!result.success) {
      const resultError = result.error || '创建失败';
      if (isSessionExpiredError(resultError)) {
        window.location.href = '/login';
        return { success: false, error: resultError, sessionExpired: true };
      }
      return { success: false, error: resultError };
    }

    await refreshLedgerCaches(mutate);
    const categoryName = categories.find((category: any) => category.id === values.categoryId)?.name
      ?? (values.type === 'TRANSFER' ? '转账' : '未分类');
    const resolvedBudgetId = result.budgetId || values.budgetId;
    const budgetRemaining = await getQuickEntryBudgetRemainingSafely(
      resolvedBudgetId,
      () => getBudgetProgress(values.occurredAt),
    );
    const feedback = buildQuickEntryFeedback({
      amount: values.amount,
      currency: values.currency,
      categoryName,
      budgetRemaining,
    });
    toast.success(feedback);
    return { success: true, feedback, transactionId: result.transactionId };
  }

  async function undoMobileQuickEntry(transactionId: string): Promise<QuickEntryUndoResult> {
    const result = await deleteTransaction(transactionId);
    if (!result.success) {
      const resultError = result.error || '撤销失败';
      if (isSessionExpiredError(resultError)) {
        window.location.href = '/login';
        return { success: false, error: resultError, sessionExpired: true };
      }
      return { success: false, error: resultError };
    }

    await refreshLedgerCaches(mutate);
    return { success: true, feedback: '已撤销上一笔记账' };
  }

  const loadQuickEntryBudgets = useCallback(async (date: string, categoryId: string) => {
    const result = await getBudgetsForCategory(date, categoryId);
    return result.success
      ? (result.data ?? []).map(({ id, name }) => ({ id, name }))
      : [];
  }, []);

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    mutate('transactions', (current: any) => ({ ...current, data: (current?.data ?? []).filter((t: any) => t.id !== id) }), false);
    const result = await deleteTransaction(id);
    if (result.success) {
      mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      mutate('transactions');
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
      isActive: formData.get('isActive') === 'on',
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
        isActive: true,
      });
      await mutateRecurringRules();
      mutate('transactions'); toast.success('操作成功');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '创建失败');
    }
    setLoading(false);
  }

  const processDueRecurringNow = useCallback(async () => {
    setError('');
    setAutoRecordMessage(null);
    setProcessingRecurring(true);

    const result = await processMyDueRecurring();

    if (result.success && 'data' in result) {
      const processed = result.data ?? [];
      const successCount = processed.filter((item) => item.success && !item.skipped).length;
      const skippedCount = processed.filter((item) => item.success && item.skipped).length;
      const failedCount = processed.filter((item) => !item.success).length;
      const firstFailure = processed.find((item) => !item.success);
      await mutateRecurringRules();
      mutate('transactions');
      mutate('assets');

      if (successCount > 0) {
        const message = failedCount > 0
          ? `已自动记录 ${successCount} 笔，${failedCount} 笔失败`
          : `已自动记录 ${successCount} 笔到期周期交易`;
        setAutoRecordMessage(message);
        toast.success(message);
      } else if (failedCount > 0) {
        setError(firstFailure?.error || '到期周期交易记录失败');
      } else if (skippedCount > 0) {
        setAutoRecordMessage('到期周期交易已处理');
      } else {
        setAutoRecordMessage('暂无到期周期交易');
        toast.success('暂无到期周期交易');
      }
    } else {
      const resultError = 'error' in result ? result.error : '自动记录失败';
      if (resultError?.includes('会话密钥') || resultError === 'Unauthorized') {
        window.location.href = '/login';
      } else {
        setError(resultError || '自动记录失败');
      }
    }

    setProcessingRecurring(false);
  }, [mutate, mutateRecurringRules, toast]);

  async function handleProcessDueRecurring() {
    await processDueRecurringNow();
  }

  useEffect(() => {
    if (activeTab !== 'recurring' || !dueRecurringKey || processingRecurring) {
      return;
    }

    if (autoProcessedDueKeys.current.has(dueRecurringKey)) {
      return;
    }

    autoProcessedDueKeys.current.add(dueRecurringKey);
    void processDueRecurringNow();
  }, [activeTab, dueRecurringKey, processDueRecurringNow, processingRecurring]);

  async function handleToggleRecurring(ruleId: string) {
    mutateRecurringRules(prev => (prev ?? []).map(r =>
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    ), false);
    const result = await toggleRecurringRule(ruleId);
    if (result.success) {
      await mutateRecurringRules();
      mutate('transactions'); toast.success('操作成功');
    } else {
      await mutateRecurringRules();
      setError(result.error || '更新失败');
    }
  }

  async function handleDeleteRecurring(ruleId: string) {
    mutateRecurringRules(prev => (prev ?? []).filter(r => r.id !== ruleId), false);
    const result = await deleteRecurringRule(ruleId);
    if (result.success) {
      await mutateRecurringRules();
      mutate('transactions');
    } else {
      await mutateRecurringRules();
      setError(result.error || '删除失败');
    }
  }


  async function handleUpdateTransaction(txId: string) {
    if (!editTxForm.amount) return;
    setError('');
    const result = await updateTransaction(txId, buildTransactionUpdateInput(editTxForm));
    if (result.success) {
      setEditingTxId(null);
      mutate('transactions'); mutate('assets'); toast.success('操作成功');
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
      fromAccountId: tx.fromAccountId || '',
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
      await mutateRecurringRules();
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

  const needsSourceTransactions = transactions.filter((t: any) => (
    String(t.type).toUpperCase() === 'EXPENSE' && !t.fromAccountId
  ));
  const showNeedsSourceOnly = needsSourceFromQuery;
  const visibleTransactions = showNeedsSourceOnly ? needsSourceTransactions : transactions;

  return (
    <div>
      <div className={`items-start justify-between gap-3 mb-6 ${isCreateFocus ? 'hidden md:flex' : 'flex'}`}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {activeTab === 'recurring' ? '周期交易' : '流水管理'}
          </h1>
          {activeTab === 'recurring' ? (
            <p className="mt-1 text-sm text-ledger-muted">管理固定收支和定期转账，到期后自动记入流水。</p>
          ) : null}
        </div>
        {activeTab === 'recurring' ? (
          <Link
            href="/management/ledger"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--border-tertiary)] px-3 text-sm text-[var(--color-text-primary)] no-underline"
          >
            查看流水
          </Link>
        ) : null}
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
            <div className={`mb-4 items-center gap-2 flex-wrap ${isCreateFocus ? 'hidden md:flex' : 'flex'}`}>
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

          {isCreateFocus && (
            <section className="mb-4 hidden rounded-xl border border-ledger-accent/20 bg-ledger-surface p-4 md:block">
              <div className="text-xs font-semibold text-ledger-muted">流水行动</div>
              <h2 className="mt-1 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                先补齐本月流水
              </h2>
              <p className="mt-1 text-sm text-ledger-muted">
                先把本月收入、固定支出和最近几笔消费记进来；首页才能判断现金流、预算和流动性是否安全。
              </p>
            </section>
          )}

          {isCreateFocus ? (
            <section className="mb-4 md:hidden" aria-label="快速记一笔">
              <MobileQuickEntry
                categories={categories}
                assets={assets}
                categoriesReady={catData !== undefined}
                assetsReady={assetData !== undefined}
                loadBudgets={loadQuickEntryBudgets}
                onSubmit={submitMobileQuickEntry}
                onUndo={undoMobileQuickEntry}
              />
            </section>
          ) : null}

          {/* Create form */}
          <form
            ref={createFormRef}
            id="create-form"
            data-ledger-create-form="true"
            action={handleCreate}
            className="mb-4 hidden items-end gap-3 rounded-xl bg-ledger-surface p-4 md:flex md:flex-wrap"
          >
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">类型</label>
              <select
                name="type"
                required
                value={formValues.type}
                onChange={e => setFormValues(prev => ({ ...prev, type: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              >
                <option value="EXPENSE">支出</option>
                <option value="INCOME">收入</option>
                <option value="TRANSFER">转账</option>
              </select>
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">币种</label>
              <select
                name="currency"
                value={formValues.currency}
                onChange={e => setFormValues(prev => ({ ...prev, currency: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              >
                <option value="CNY">¥ 人民币</option>
                <option value="USD">$ 美元</option>
                <option value="HKD">HK$ 港币</option>
                <option value="JPY">JP¥ 日元</option>
              </select>
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">金额</label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                required
                value={formValues.amount}
                onChange={e => setFormValues(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
                placeholder="0.00"
              />
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">分类</label>
              <select
                name="categoryId"
                value={formValues.categoryId}
                onChange={e => setFormValues(prev => ({ ...prev, categoryId: e.target.value, budgetId: '' }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              >
                <option value="">--</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {formBudgetOptions.length > 0 && (
              <div className="min-w-0 w-full md:w-auto">
                <label className="block text-xs text-ledger-muted mb-1">预算</label>
                <select
                  name="budgetId"
                  value={formValues.budgetId}
                  onChange={e => setFormValues(prev => ({ ...prev, budgetId: e.target.value }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
                >
                  <option value="">-- 关联预算 --</option>
                  {formBudgetOptions.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">来源资金账户</label>
              <select
                name="fromAccountId"
                value={formValues.fromAccountId}
                onChange={e => setFormValues(prev => ({ ...prev, fromAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              >
                <option value="">不指定（只记总收支）</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">目标资金账户</label>
              <select
                name="toAccountId"
                value={formValues.toAccountId}
                onChange={e => setFormValues(prev => ({ ...prev, toAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              >
                <option value="">--</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">日期</label>
              <input
                name="occurredAt"
                type="date"
                required
                value={formValues.occurredAt}
                onChange={e => setFormValues(prev => ({ ...prev, occurredAt: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
              />
            </div>
            <div className="min-w-0 w-full md:w-auto">
              <label className="block text-xs text-ledger-muted mb-1">备注</label>
              <input
                name="description"
                value={formValues.description}
                onChange={e => setFormValues(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-full min-h-11 md:w-auto"
                placeholder="备注"
              />
            </div>
            <div className="flex min-w-0 w-full items-end gap-2 md:w-auto">
              <button
                type="submit"
                disabled={loading}
                className="min-h-11 flex-1 rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50 md:flex-none"
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
                className="flex-1 rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                onKeyDown={e => e.key === 'Enter' && saveCurrentAsTemplate()}
              />
              <button
                type="button"
                onClick={saveCurrentAsTemplate}
                disabled={!templateName.trim()}
                className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
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
                      type="text"
                      inputMode="decimal"
                      value={reconAmount}
                      onChange={e => setReconAmount(e.target.value)}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-28"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ledger-muted mb-1">参考日期</label>
                    <input
                      type="date"
                      value={reconDate}
                      onChange={e => setReconDate(e.target.value)}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-1.5 text-sm focus:outline-none focus:border-ledger-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ledger-muted mb-1">日期容差(天)</label>
                    <select
                      value={reconDays}
                      onChange={e => setReconDays(Number(e.target.value))}
                      className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-1.5 text-sm focus:outline-none focus:border-ledger-accent"
                    >
                      <option value={1}>±1天</option>
                      <option value={3}>±3天</option>
                      <option value={7}>±7天</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={searchReconciliation}
                    className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-3 py-1.5 text-xs font-medium hover:opacity-90"
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
                        <span className="text-[var(--color-text-primary)]">{(curSym[t.currency || 'CNY'] || '¥')}{t.amount}</span>
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

          <div className="mb-4 rounded-xl bg-ledger-surface p-3 border border-ledger-primary/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>待补来源资金账户</div>
                <p className="mt-1 text-xs text-ledger-muted">
                  {needsSourceTransactions.length} 笔支出还没有选择来源资金账户，补齐后会自动更新对应资金账户余额。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/management/ledger?needsSource=1"
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    showNeedsSourceOnly
                      ? 'bg-ledger-accent/20 border-ledger-accent text-ledger-accent'
                      : 'bg-ledger-bg border-ledger-bg text-ledger-muted hover:text-white'
                  }`}
                >
                  只看待补来源
                </Link>
                {showNeedsSourceOnly && (
                  <Link
                    href="/management/ledger"
                    className="text-xs px-3 py-1.5 rounded-md border border-ledger-bg bg-ledger-bg text-ledger-muted hover:text-white"
                  >
                    显示全部流水
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div
            data-transaction-list="true"
            data-transactions-ready={txData !== undefined ? 'true' : 'false'}
            className="rounded-xl bg-ledger-surface overflow-hidden"
          >
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
                {visibleTransactions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-ledger-muted">
                      {showNeedsSourceOnly ? '暂无待补来源资金账户的支出' : '暂无流水'}
                    </td>
                  </tr>
                )}
                {visibleTransactions.map((t: any) => (
                  <tr key={t.id} className="border-b border-ledger-bg last:border-0">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(t.type)}`}>
                        {typeLabel(t.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{(curSym[t.currency || 'CNY'] || '¥')}{t.amount}</td>
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
                                type="text" inputMode="decimal"
                                value={editTxForm.amount}
                                onChange={e => setEditTxForm(p => ({ ...p, amount: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent w-24"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">分类</label>
                              <select
                                value={editTxForm.categoryId}
                                onChange={e => setEditTxForm(p => ({ ...p, categoryId: e.target.value, budgetId: '' }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent"
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
                                  className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent"
                                >
                                  <option value="">--</option>
                                  {budgetOptions.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">来源资金账户</label>
                              <select
                                value={editTxForm.fromAccountId}
                                onChange={e => setEditTxForm(p => ({ ...p, fromAccountId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent"
                              >
                                <option value="">不指定（只记总收支）</option>
                                {assets.map((a: any) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">日期</label>
                              <input
                                type="date"
                                value={editTxForm.occurredAt}
                                onChange={e => setEditTxForm(p => ({ ...p, occurredAt: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">备注</label>
                              <input
                                type="text"
                                value={editTxForm.description}
                                onChange={e => setEditTxForm(p => ({ ...p, description: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateTransaction(t.id)}
                              className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-2 py-1.5 text-xs font-medium hover:opacity-90"
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
          <section className="mb-4 rounded-xl border border-ledger-primary/20 bg-ledger-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>自动记录</div>
                <div className="mt-1 text-xs text-ledger-muted">
                  已开启后台检查；启用中的周期交易到期后会自动写入流水，并推进下次到期日。
                </div>
              </div>
              <button
                type="button"
                onClick={handleProcessDueRecurring}
                disabled={processingRecurring || dueRecurringRules.length === 0}
                className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {processingRecurring
                  ? '记录中...'
                  : dueRecurringRules.length > 0
                    ? `立即记录 ${dueRecurringRules.length} 项`
                    : '暂无到期项'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
                自动记录中 {activeRecurringRules.length} 项
              </span>
              <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
                已到期 {dueRecurringRules.length} 项
              </span>
              {nextRecurringRule && (
                <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
                  下一项 {nextRecurringRule.name} · {new Date(nextRecurringRule.nextDueDate).toLocaleDateString('zh-CN')}
                </span>
              )}
              {autoRecordMessage && (
                <span className="rounded-full bg-green-900/20 px-2.5 py-1 text-green-400">
                  {autoRecordMessage}
                </span>
              )}
            </div>
          </section>

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
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-24"
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
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
                value={recurringForm.currency}
                onChange={e => setRecurringForm(prev => ({ ...prev, currency: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
                type="text"
                inputMode="decimal"
                required
                value={recurringForm.amount}
                onChange={e => setRecurringForm(prev => ({ ...prev, amount: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-24"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">分类</label>
              <select
                name="categoryId"
                value={recurringForm.categoryId}
                onChange={e => setRecurringForm(prev => ({ ...prev, categoryId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
              >
                <option value="">--</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">来源资金账户</label>
              <select
                name="fromAccountId"
                value={recurringForm.fromAccountId}
                onChange={e => setRecurringForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
              >
                <option value="">不指定（只记总收支）</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">目标资金账户</label>
              <select
                name="toAccountId"
                value={recurringForm.toAccountId}
                onChange={e => setRecurringForm(prev => ({ ...prev, toAccountId: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
                  type="text"
                  inputMode="numeric"
                  value={recurringForm.interval}
                  onChange={e => setRecurringForm(prev => ({ ...prev, interval: Number(e.target.value) || 1 }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm focus:outline-none focus:border-ledger-accent w-14 text-center"
                />
                <select
                  name="frequency"
                  value={recurringForm.frequency}
                  onChange={e => setRecurringForm(prev => ({ ...prev, frequency: e.target.value }))}
                  className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
              />
            </div>
            <label className="flex items-center gap-2 rounded-md bg-ledger-bg px-3 py-2 text-sm text-ledger-muted">
              <input
                name="isActive"
                type="checkbox"
                checked={recurringForm.isActive}
                onChange={e => setRecurringForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span>自动记录</span>
            </label>
            <div>
              <label className="block text-xs text-ledger-muted mb-1">备注</label>
              <input
                name="description"
                value={recurringForm.description}
                onChange={e => setRecurringForm(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                placeholder="备注"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
                  <th className="px-4 py-3 font-medium">自动记录</th>
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
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(r.type)}`}>
                        {typeLabel(r.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{(curSym[r.currency || 'CNY'] || '¥')}{r.amount.toString()}</td>
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
                        {r.isActive ? '记录中' : '已暂停'}
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
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent w-24" />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">金额</label>
                              <input type="text" inputMode="decimal" value={editRecurringForm.amount}
                                onChange={e => setEditRecurringForm(p => ({ ...p, amount: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent w-24" />
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">分类</label>
                              <select value={editRecurringForm.categoryId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, categoryId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent">
                                <option value="">--</option>
                                {categories.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">来源资金账户</label>
                              <select value={editRecurringForm.fromAccountId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, fromAccountId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent">
                                <option value="">不指定（只记总收支）</option>
                                {assets.map((a: any) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-ledger-muted mb-1">目标资金账户</label>
                              <select value={editRecurringForm.toAccountId}
                                onChange={e => setEditRecurringForm(p => ({ ...p, toAccountId: e.target.value }))}
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent">
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
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent">
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
                                className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs focus:outline-none focus:border-ledger-accent" />
                            </div>
                            <button type="button" onClick={handleUpdateRecurring}
                              className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-2 py-1.5 text-xs font-medium hover:opacity-90">
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
