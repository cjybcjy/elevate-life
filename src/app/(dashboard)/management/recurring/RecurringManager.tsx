'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useAssets } from '@/hooks/useAssets';
import { getCategories } from '@/lib/actions/categories';
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRules,
  processMyDueRecurring,
  toggleRecurringRule,
  updateRecurringRule,
} from '@/lib/actions/recurring';
import { useToast } from '@/components/common/Toast';
import {
  MobileEditorBar,
  mobileEditorControlClass,
  useMobileEditorScroll,
} from '@/components/common/MobileEditorBar';

interface RecurringRule {
  id: string;
  name: string;
  type: string;
  amount: string;
  currency?: string | null;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  frequency: string;
  interval: number;
  nextDueDate: string | Date;
  isActive: boolean;
}

interface OptionItem {
  id: string;
  name: string;
}

const emptyRules: RecurringRule[] = [];
const emptyOptions: OptionItem[] = [];
const currencySymbol: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };
const frequencyLabel: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

function readClockSnapshot() {
  if (typeof window === 'undefined') return 0;
  return Math.floor(Date.now() / 60_000);
}

function subscribeClock(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const timeoutId = window.setTimeout(callback, 0);
  const intervalId = window.setInterval(callback, 60_000);
  return () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
  };
}

function typeLabel(type: string) {
  if (type === 'INCOME') return '收入';
  if (type === 'EXPENSE') return '支出';
  if (type === 'TRANSFER') return '转账';
  return type;
}

function typeBadgeClass(type: string) {
  if (type === 'INCOME') return 'bg-emerald-900/50 text-ledger-success';
  if (type === 'EXPENSE') return 'bg-red-900/50 text-ledger-danger';
  if (type === 'TRANSFER') return 'bg-blue-900/50 text-ledger-accent';
  return 'bg-ledger-bg text-ledger-muted';
}

function defaultCreateForm() {
  return {
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
  };
}

export default function RecurringManager() {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const { data: assetData } = useAssets();
  const assets = (assetData?.data ?? emptyOptions) as OptionItem[];
  const { data: categories = emptyOptions } = useSWR<OptionItem[]>(
    'categories',
    async () => {
      const result = await getCategories();
      if (!result.success) throw new Error(result.error || '获取分类失败');
      return result.data ?? [];
    },
  );
  const {
    data: recurringRules = emptyRules,
    mutate: mutateRecurringRules,
  } = useSWR<RecurringRule[]>(
    'recurring-rules',
    async () => {
      const result = await getRecurringRules();
      if (result.success) return result.data ?? [];
      if (result.error?.includes('会话密钥')) {
        window.location.href = '/login';
        return [];
      }
      throw new Error(result.error || '获取周期交易失败');
    },
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [autoRecordMessage, setAutoRecordMessage] = useState<string | null>(null);
  const [form, setForm] = useState(defaultCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    interval: 1,
    nextDueDate: '',
    categoryId: '',
    fromAccountId: '',
    toAccountId: '',
  });
  const processedDueKeys = useRef<Set<string>>(new Set());
  const clockMinute = useSyncExternalStore(subscribeClock, readClockSnapshot, () => 0);
  useMobileEditorScroll(editingId ? `recurring-editor-${editingId}` : null);

  const recurringSummary = useMemo(() => {
    const clockTime = clockMinute > 0 ? clockMinute * 60_000 : 0;
    const activeRules = recurringRules.filter((rule) => rule.isActive);
    const dueRules = clockTime > 0
      ? activeRules.filter((rule) => new Date(rule.nextDueDate).getTime() <= clockTime)
      : [];
    const dueKey = dueRules
      .map((rule) => `${rule.id}:${new Date(rule.nextDueDate).toISOString()}`)
      .sort()
      .join('|');
    const nextRule = activeRules.reduce<RecurringRule | null>((nearest, rule) => {
      if (!nearest) return rule;
      return new Date(rule.nextDueDate).getTime() < new Date(nearest.nextDueDate).getTime()
        ? rule
        : nearest;
    }, null);

    return { activeRules, dueRules, dueKey, nextRule };
  }, [clockMinute, recurringRules]);

  const processDue = useCallback(async () => {
    setError('');
    setAutoRecordMessage(null);
    setProcessing(true);
    try {
      const result = await processMyDueRecurring();
      if (result.success && 'data' in result) {
        const processed = result.data ?? [];
        const successCount = processed.filter((item) => item.success && !item.skipped).length;
        const skippedCount = processed.filter((item) => item.success && item.skipped).length;
        const failedCount = processed.filter((item) => !item.success).length;
        const firstFailure = processed.find((item) => !item.success);
        await mutateRecurringRules();
        void mutate('transactions');
        void mutate('assets');

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
        return;
      }

      const resultError = 'error' in result ? result.error : '自动记录失败';
      if (resultError?.includes('会话密钥') || resultError === 'Unauthorized') {
        window.location.href = '/login';
      } else {
        setError(resultError || '自动记录失败');
      }
    } finally {
      setProcessing(false);
    }
  }, [mutate, mutateRecurringRules, toast]);

  useEffect(() => {
    if (!recurringSummary.dueKey || processing) return;
    if (processedDueKeys.current.has(recurringSummary.dueKey)) return;

    processedDueKeys.current.add(recurringSummary.dueKey);
    void processDue();
  }, [processDue, processing, recurringSummary.dueKey]);

  async function handleCreate(formData: FormData) {
    setError('');
    setLoading(true);
    try {
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
        setForm(defaultCreateForm());
        await mutateRecurringRules();
        void mutate('transactions');
        toast.success('操作成功');
      } else if (result.error?.includes('会话密钥')) {
        window.location.href = '/login';
      } else {
        setError(result.error || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(ruleId: string) {
    void mutateRecurringRules(
      (previous) => (previous ?? []).map((rule) => (
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
      )),
      false,
    );
    const result = await toggleRecurringRule(ruleId);
    await mutateRecurringRules();
    if (result.success) {
      void mutate('transactions');
      toast.success('操作成功');
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDelete(ruleId: string) {
    void mutateRecurringRules(
      (previous) => (previous ?? []).filter((rule) => rule.id !== ruleId),
      false,
    );
    const result = await deleteRecurringRule(ruleId);
    await mutateRecurringRules();
    if (result.success) {
      void mutate('transactions');
    } else {
      setError(result.error || '删除失败');
    }
  }

  function startEdit(rule: RecurringRule) {
    setEditingId(rule.id);
    setEditForm({
      name: rule.name,
      amount: rule.amount,
      categoryId: rule.categoryId || '',
      fromAccountId: rule.fromAccountId || '',
      toAccountId: rule.toAccountId || '',
      frequency: rule.frequency || 'monthly',
      interval: rule.interval || 1,
      nextDueDate: new Date(rule.nextDueDate).toISOString().split('T')[0],
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    setError('');
    const result = await updateRecurringRule(editingId, {
      name: editForm.name || undefined,
      amount: editForm.amount || undefined,
      categoryId: editForm.categoryId,
      fromAccountId: editForm.fromAccountId,
      toAccountId: editForm.toAccountId,
      frequency: editForm.frequency || undefined,
      interval: editForm.interval || undefined,
      nextDueDate: editForm.nextDueDate || undefined,
    });
    if (result.success) {
      setEditingId(null);
      await mutateRecurringRules();
      void mutate('transactions');
      toast.success('操作成功');
    } else {
      setError(result.error || '更新失败');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>周期交易</h1>
          <p className="mt-1 text-sm text-ledger-muted">管理固定收支和定期转账，到期后自动记入流水。</p>
        </div>
        <Link
          href="/management/ledger"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--border-tertiary)] px-3 text-sm text-[var(--color-text-primary)] no-underline"
        >
          查看流水
        </Link>
      </div>

      {error ? (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      ) : null}

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
            onClick={() => void processDue()}
            disabled={processing || recurringSummary.dueRules.length === 0}
            className="rounded-md bg-ledger-accent px-3 py-2 text-xs font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {processing
              ? '记录中...'
              : recurringSummary.dueRules.length > 0
                ? `立即记录 ${recurringSummary.dueRules.length} 项`
                : '暂无到期项'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
            自动记录中 {recurringSummary.activeRules.length} 项
          </span>
          <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
            已到期 {recurringSummary.dueRules.length} 项
          </span>
          {recurringSummary.nextRule ? (
            <span className="rounded-full bg-ledger-bg px-2.5 py-1 text-ledger-muted">
              下一项 {recurringSummary.nextRule.name} · {new Date(recurringSummary.nextRule.nextDueDate).toLocaleDateString('zh-CN')}
            </span>
          ) : null}
          {autoRecordMessage ? (
            <span className="rounded-full bg-green-900/20 px-2.5 py-1 text-green-400">{autoRecordMessage}</span>
          ) : null}
        </div>
      </section>

      <form action={handleCreate} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-ledger-surface p-4">
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">名称</label>
          <input name="name" required value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="w-24 rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none" placeholder="如：房租" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">类型</label>
          <select name="type" required value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none">
            <option value="EXPENSE">支出</option><option value="INCOME">收入</option><option value="TRANSFER">转账</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">币种</label>
          <select name="currency" value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-2 py-2 text-sm focus:border-ledger-accent focus:outline-none">
            <option value="CNY">¥</option><option value="USD">$</option><option value="HKD">HK$</option><option value="JPY">JP¥</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">金额</label>
          <input name="amount" type="text" inputMode="decimal" required value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} className="w-24 rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none" placeholder="0.00" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">分类</label>
          <select name="categoryId" value={form.categoryId} onChange={(event) => setForm((previous) => ({ ...previous, categoryId: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none">
            <option value="">--</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">来源资金账户</label>
          <select name="fromAccountId" value={form.fromAccountId} onChange={(event) => setForm((previous) => ({ ...previous, fromAccountId: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none">
            <option value="">不指定（只记总收支）</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">目标资金账户</label>
          <select name="toAccountId" value={form.toAccountId} onChange={(event) => setForm((previous) => ({ ...previous, toAccountId: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none">
            <option value="">--</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">频率</label>
          <div className="flex items-end gap-1">
            <span className="text-xs text-ledger-muted">每</span>
            <input name="interval" type="text" inputMode="numeric" value={form.interval} onChange={(event) => setForm((previous) => ({ ...previous, interval: Number(event.target.value) || 1 }))} className="w-14 rounded-md border border-ledger-bg bg-ledger-bg px-2 py-2 text-center text-sm focus:border-ledger-accent focus:outline-none" />
            <select name="frequency" value={form.frequency} onChange={(event) => setForm((previous) => ({ ...previous, frequency: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-2 py-2 text-sm focus:border-ledger-accent focus:outline-none">
              <option value="monthly">个月</option><option value="weekly">周</option><option value="daily">天</option><option value="yearly">年</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">开始日期</label>
          <input name="startDate" type="date" required value={form.startDate} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 rounded-md bg-ledger-bg px-3 py-2 text-sm text-ledger-muted">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.checked }))} className="h-4 w-4" style={{ accentColor: 'var(--color-accent)' }} />
          <span>自动记录</span>
        </label>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">备注</label>
          <input name="description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none" placeholder="备注" />
        </div>
        <button type="submit" disabled={loading} className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50">
          {loading ? '创建中...' : '添加周期'}
        </button>
      </form>

      <section className="grid gap-3 md:hidden" aria-label="周期交易列表">
        {recurringRules.length === 0 ? (
          <div className="rounded-xl bg-ledger-surface px-4 py-8 text-center text-sm text-ledger-muted">暂无周期交易</div>
        ) : null}

        {recurringRules.map((rule) => {
          const nextDate = new Date(rule.nextDueDate);
          const isEditing = editingId === rule.id;
          const frequency = rule.interval > 1
            ? `每${rule.interval}${frequencyLabel[rule.frequency]?.replace('每', '')}`
            : frequencyLabel[rule.frequency];

          return (
            <article
              key={rule.id}
              className={`min-w-0 rounded-xl border bg-ledger-surface p-4 ${isEditing ? 'border-ledger-accent/40' : 'border-[var(--border-tertiary)]'} ${rule.isActive ? '' : 'opacity-70'}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">{rule.name}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(rule.type)}`}>{typeLabel(rule.type)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ledger-muted">{frequency} · 下次 {nextDate.toLocaleDateString('zh-CN')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] text-ledger-muted">每次金额</div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {currencySymbol[rule.currency || 'CNY'] || '¥'}{rule.amount}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggle(rule.id)}
                  className={`min-h-11 rounded-lg px-2 text-sm font-medium ${rule.isActive ? 'bg-green-900/30 text-green-400' : 'bg-ledger-bg text-ledger-muted'}`}
                >
                  {rule.isActive ? '暂停' : '启用'}
                </button>
                <button
                  type="button"
                  aria-expanded={isEditing}
                  aria-controls={`recurring-editor-${rule.id}`}
                  onClick={() => isEditing ? setEditingId(null) : startEdit(rule)}
                  className="min-h-11 rounded-lg bg-ledger-bg px-2 text-sm font-medium text-[var(--color-text-primary)]"
                >
                  {isEditing ? '收起' : '编辑'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(rule.id)}
                  className="min-h-11 rounded-lg bg-red-500/10 px-2 text-sm font-medium text-ledger-danger"
                >
                  删除
                </button>
              </div>

              {isEditing ? (
                <div id={`recurring-editor-${rule.id}`} className="mt-3 scroll-mt-24 rounded-xl border border-ledger-accent/30 bg-ledger-bg p-3">
                  <MobileEditorBar
                    title={`编辑 ${rule.name}`}
                    description="修改执行规则与下次到期日"
                    onCancel={() => setEditingId(null)}
                    onSave={() => void handleUpdate()}
                    saveDisabled={!editForm.name.trim() || !editForm.amount.trim()}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="col-span-2 block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">名称</span>
                      <input type="text" value={editForm.name} onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))} className={mobileEditorControlClass} />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">金额</span>
                      <input type="text" inputMode="decimal" value={editForm.amount} onChange={(event) => setEditForm((previous) => ({ ...previous, amount: event.target.value }))} className={mobileEditorControlClass} />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">分类</span>
                      <select value={editForm.categoryId} onChange={(event) => setEditForm((previous) => ({ ...previous, categoryId: event.target.value }))} className={mobileEditorControlClass}>
                        <option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="col-span-2 block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">来源资金账户</span>
                      <select value={editForm.fromAccountId} onChange={(event) => setEditForm((previous) => ({ ...previous, fromAccountId: event.target.value }))} className={mobileEditorControlClass}>
                        <option value="">不指定（只记总收支）</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </label>
                    <label className="col-span-2 block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">目标资金账户</span>
                      <select value={editForm.toAccountId} onChange={(event) => setEditForm((previous) => ({ ...previous, toAccountId: event.target.value }))} className={mobileEditorControlClass}>
                        <option value="">不指定</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">间隔</span>
                      <input type="text" inputMode="numeric" value={editForm.interval} onChange={(event) => setEditForm((previous) => ({ ...previous, interval: Number(event.target.value) || 1 }))} className={mobileEditorControlClass} />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">频率</span>
                      <select value={editForm.frequency} onChange={(event) => setEditForm((previous) => ({ ...previous, frequency: event.target.value }))} className={mobileEditorControlClass}>
                        <option value="monthly">月</option><option value="weekly">周</option><option value="daily">天</option><option value="yearly">年</option>
                      </select>
                    </label>
                    <label className="col-span-2 block min-w-0">
                      <span className="mb-1 block text-xs text-ledger-muted">下次到期</span>
                      <input type="date" value={editForm.nextDueDate} onChange={(event) => setEditForm((previous) => ({ ...previous, nextDueDate: event.target.value }))} className={mobileEditorControlClass} />
                    </label>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <div className="hidden overflow-x-auto rounded-xl bg-ledger-surface md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ledger-bg text-left text-ledger-muted">
              <th className="px-4 py-3 font-medium">名称</th><th className="px-4 py-3 font-medium">类型</th><th className="px-4 py-3 font-medium">金额</th><th className="px-4 py-3 font-medium">频率</th><th className="px-4 py-3 font-medium">上次执行</th><th className="px-4 py-3 font-medium">下次到期</th><th className="px-4 py-3 font-medium">自动记录</th><th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {recurringRules.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ledger-muted">暂无周期交易</td></tr>
            ) : null}
            {recurringRules.map((rule) => {
              const nextDate = new Date(rule.nextDueDate);
              const days = ({ daily: 1, weekly: 7, monthly: 30, yearly: 365 } as Record<string, number>)[rule.frequency] || 30;
              const previousDate = new Date(nextDate.getTime() - (rule.interval || 1) * days * 86_400_000);
              return (
                <tr key={rule.id} className={`border-b border-ledger-bg last:border-0 ${rule.isActive ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{rule.name}</td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(rule.type)}`}>{typeLabel(rule.type)}</span></td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{currencySymbol[rule.currency || 'CNY'] || '¥'}{rule.amount}</td>
                  <td className="px-4 py-3 text-ledger-muted">{rule.interval > 1 ? `每${rule.interval}${frequencyLabel[rule.frequency]?.replace('每', '')}` : frequencyLabel[rule.frequency]}</td>
                  <td className="px-4 py-3 text-ledger-muted">{previousDate.toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3 text-ledger-muted">{nextDate.toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3"><button type="button" onClick={() => void handleToggle(rule.id)} className={`rounded-full px-2 py-0.5 text-xs ${rule.isActive ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-ledger-muted'}`}>{rule.isActive ? '记录中' : '已暂停'}</button></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => editingId === rule.id ? setEditingId(null) : startEdit(rule)} className="rounded bg-ledger-bg px-2 py-0.5 text-xs text-ledger-muted hover:text-white">{editingId === rule.id ? '取消' : '编辑'}</button>
                      <button type="button" onClick={() => void handleDelete(rule.id)} className="text-xs text-ledger-danger hover:underline">删除</button>
                    </div>
                    {editingId === rule.id ? (
                      <div className="mt-2 rounded-lg border border-ledger-accent/30 bg-ledger-bg p-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-xs text-ledger-muted">名称<input type="text" value={editForm.name} onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))} className="mt-1 block w-24 rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none" /></label>
                          <label className="text-xs text-ledger-muted">金额<input type="text" inputMode="decimal" value={editForm.amount} onChange={(event) => setEditForm((previous) => ({ ...previous, amount: event.target.value }))} className="mt-1 block w-24 rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none" /></label>
                          <label className="text-xs text-ledger-muted">分类<select value={editForm.categoryId} onChange={(event) => setEditForm((previous) => ({ ...previous, categoryId: event.target.value }))} className="mt-1 block rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none"><option value="">--</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                          <label className="text-xs text-ledger-muted">来源资金账户<select value={editForm.fromAccountId} onChange={(event) => setEditForm((previous) => ({ ...previous, fromAccountId: event.target.value }))} className="mt-1 block rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none"><option value="">不指定（只记总收支）</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                          <label className="text-xs text-ledger-muted">目标资金账户<select value={editForm.toAccountId} onChange={(event) => setEditForm((previous) => ({ ...previous, toAccountId: event.target.value }))} className="mt-1 block rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none"><option value="">--</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                          <label className="text-xs text-ledger-muted">频率<select value={editForm.frequency} onChange={(event) => setEditForm((previous) => ({ ...previous, frequency: event.target.value }))} className="mt-1 block rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none"><option value="monthly">每月</option><option value="weekly">每周</option><option value="daily">每天</option><option value="yearly">每年</option></select></label>
                          <label className="text-xs text-ledger-muted">下次到期<input type="date" value={editForm.nextDueDate} onChange={(event) => setEditForm((previous) => ({ ...previous, nextDueDate: event.target.value }))} className="mt-1 block rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none" /></label>
                          <button type="button" onClick={() => void handleUpdate()} className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-[var(--color-text-inverse)] hover:opacity-90">保存</button>
                        </div>
                      </div>
                    ) : null}
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
