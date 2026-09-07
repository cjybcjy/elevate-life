'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBudget, updateBudget, deleteBudget, getBudgets } from '@/lib/actions/budget';
import { createTransaction } from '@/lib/actions/ledger';
import { getCategories } from '@/lib/actions/categories';
import BudgetTracker from '@/components/widgets/BudgetTracker';
import { useBudgets } from '@/hooks/useBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { useAssets } from '@/hooks/useAssets';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { buildAnnualBudgetOverview, getEffectiveBudgetRemaining } from '@/lib/annual-budget';
import {
  MobileEditorBar,
  useMobileEditorScroll,
} from '@/components/common/MobileEditorBar';

interface Budget {
  id: string;
  name: string;
  categoryId?: string | null;
  amount: { toString: () => string };
  startDate: string | Date;
  endDate: string | Date;
  category?: { id: string; name: string } | null;
}

interface Asset {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

type BudgetFocus = 'over' | 'create' | 'review' | null;

type EditBudgetForm = {
  name: string;
  amount: string;
  startDate: string;
  endDate: string;
};

type ExpenseBudgetForm = {
  amount: string;
  description: string;
  date: string;
  fromAccountId: string;
};

function parseAmount(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v);
  if (v && typeof v === 'object' && 'toString' in v && typeof v.toString === 'function') {
    return parseFloat(v.toString());
  }
  return 0;
}

function fmtDate(d: string | Date | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

function BudgetExpenseEditor({
  budgetId,
  assets,
  form,
  setForm,
  onSave,
  variant,
}: {
  budgetId: string;
  assets: Asset[];
  form: ExpenseBudgetForm;
  setForm: Dispatch<SetStateAction<ExpenseBudgetForm>>;
  onSave: (budgetId: string) => Promise<void>;
  variant: 'mobile' | 'desktop';
}) {
  const mobile = variant === 'mobile';
  const fieldClass = mobile ? 'min-w-0' : '';
  const fullFieldClass = mobile ? 'col-span-2 min-w-0' : '';
  const controlClass = mobile
    ? 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-tertiary)] bg-ledger-surface px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none'
    : 'rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none';

  return (
    <div
      id={`${variant}-${budgetId}-expense-editor`}
      data-budget-expense-editor={variant}
      className={mobile
        ? 'mt-4 border-t border-[var(--border-tertiary)] pt-4'
        : 'mt-2 rounded-lg border border-ledger-accent/30 bg-ledger-bg p-3'}
    >
      <div className={mobile ? 'grid grid-cols-2 gap-3' : 'flex flex-wrap items-end gap-2'}>
        <div className={fieldClass}>
          <label htmlFor={`${variant}-${budgetId}-expense-amount`} className="mb-1 block text-xs text-ledger-muted">金额</label>
          <input
            id={`${variant}-${budgetId}-expense-amount`}
            type="text"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            className={`${controlClass} ${mobile ? '' : 'w-24'}`}
            placeholder="0.00"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor={`${variant}-${budgetId}-expense-date`} className="mb-1 block text-xs text-ledger-muted">日期</label>
          <input
            id={`${variant}-${budgetId}-expense-date`}
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            className={controlClass}
          />
        </div>
        <div className={fullFieldClass}>
          <label htmlFor={`${variant}-${budgetId}-expense-account`} className="mb-1 block text-xs text-ledger-muted">来源资金账户</label>
          <select
            id={`${variant}-${budgetId}-expense-account`}
            name="fromAccountId"
            value={form.fromAccountId}
            onChange={(event) => setForm((current) => ({ ...current, fromAccountId: event.target.value }))}
            className={controlClass}
          >
            <option value="">不指定（只记总收支）</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
        </div>
        <div className={fullFieldClass}>
          <label htmlFor={`${variant}-${budgetId}-expense-description`} className="mb-1 block text-xs text-ledger-muted">备注</label>
          <input
            id={`${variant}-${budgetId}-expense-description`}
            type="text"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className={controlClass}
            placeholder="备注"
          />
        </div>
        <button
          type="button"
          onClick={() => onSave(budgetId)}
          disabled={!form.amount}
          className={mobile
            ? 'col-span-2 min-h-11 w-full rounded-lg bg-ledger-accent px-4 py-2 text-sm font-medium disabled:opacity-50'
            : 'rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50'}
          style={{ color: 'var(--color-text-inverse)' }}
        >
          保存支出
        </button>
      </div>
    </div>
  );
}

function BudgetEditEditor({
  budgetId,
  form,
  setForm,
  onSave,
  onCancel,
  variant,
}: {
  budgetId: string;
  form: EditBudgetForm;
  setForm: Dispatch<SetStateAction<EditBudgetForm>>;
  onSave: () => Promise<void>;
  onCancel: () => void;
  variant: 'mobile' | 'desktop';
}) {
  const mobile = variant === 'mobile';
  const fullFieldClass = mobile ? 'col-span-2 min-w-0' : '';
  const fieldClass = mobile ? 'min-w-0' : '';
  const controlClass = mobile
    ? 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-tertiary)] bg-ledger-surface px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none'
    : 'rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1.5 text-xs focus:border-ledger-accent focus:outline-none';

  return (
    <div
      id={`${variant}-${budgetId}-edit-editor`}
      data-budget-edit-editor={variant}
      className={mobile
        ? 'mt-4 scroll-mt-24 border-t border-[var(--border-tertiary)] pt-4'
        : 'mt-2 rounded-lg border border-ledger-accent/30 bg-ledger-bg p-3'}
    >
      {mobile ? (
        <MobileEditorBar
          title="编辑预算"
          description="修改名称、金额和有效期"
          onCancel={onCancel}
          onSave={() => void onSave()}
          saveDisabled={!form.name.trim() || !form.amount.trim()}
        />
      ) : null}
      <div className={mobile ? 'grid grid-cols-2 gap-3' : 'flex flex-wrap items-end gap-2'}>
        <div className={fullFieldClass}>
          <label htmlFor={`${variant}-${budgetId}-edit-name`} className="mb-1 block text-xs text-ledger-muted">名称</label>
          <input
            id={`${variant}-${budgetId}-edit-name`}
            type="text"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className={controlClass}
          />
        </div>
        <div className={fullFieldClass}>
          <label htmlFor={`${variant}-${budgetId}-edit-amount`} className="mb-1 block text-xs text-ledger-muted">金额</label>
          <input
            id={`${variant}-${budgetId}-edit-amount`}
            type="text"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            className={`${controlClass} ${mobile ? '' : 'w-28'}`}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor={`${variant}-${budgetId}-edit-start`} className="mb-1 block text-xs text-ledger-muted">开始</label>
          <input
            id={`${variant}-${budgetId}-edit-start`}
            type="date"
            value={form.startDate}
            onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
            className={controlClass}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor={`${variant}-${budgetId}-edit-end`} className="mb-1 block text-xs text-ledger-muted">结束</label>
          <input
            id={`${variant}-${budgetId}-edit-end`}
            type="date"
            value={form.endDate}
            onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
            className={controlClass}
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          className={mobile
            ? 'hidden'
            : 'rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium hover:opacity-90'}
          style={{ color: 'var(--color-text-inverse)' }}
        >
          保存修改
        </button>
      </div>
    </div>
  );
}

export default function BudgetManager({ currentDate }: { currentDate: string }) {
  const searchParams = useSearchParams();
  const focusParam = searchParams.get('focus');
  const budgetFocus: BudgetFocus =
    focusParam === 'over' || focusParam === 'create' || focusParam === 'review'
      ? focusParam
      : null;
  const { data: budgetData } = useBudgets(currentDate);
  const progress = budgetData?.data ?? [];
  const { data: budgetsData } = useSWR('budgets-list', () => getBudgets().then(r => r.success ? (r.data ?? []) : []));
  const budgets: Budget[] = budgetsData ?? [];
  const { data: catData } = useSWR('categories', () => getCategories().then(r => r.success ? (r.data ?? []) : []));
  const categories = catData ?? [];
  const { data: assetData } = useAssets();
  const assets: Asset[] = assetData?.data ?? [];
  const { data: txData } = useTransactions();
  const transactions = txData?.data ?? [];
  const { mutate } = useSWRConfig();

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', amount: '', startDate: '', endDate: '' });
  const [expenseRowId, setExpenseRowId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    date: currentDate,
    fromAccountId: '',
  });
  useMobileEditorScroll(editingId ? `mobile-${editingId}-edit-editor` : null);
  const overBudgetCount = progress.filter((item) => item.isOverBudget).length;
  const annualOverview = buildAnnualBudgetOverview(progress);
  const totalRemaining = getEffectiveBudgetRemaining(progress);

  const budgetFocusCopy = (() => {
    if (budgetFocus === 'over') {
      return {
        title: '先处理超支预算',
        detail: overBudgetCount > 0
          ? `已自动展开第一项超支预算；先补来源资金账户、删错账或调预算。当前有 ${overBudgetCount} 项超支。`
          : '当前没有超支预算，可以继续检查本月预算执行。',
        cta: '查看预算执行',
        href: '#budget-progress',
      };
    }

    if (budgetFocus === 'create') {
      return {
        title: '先建立本月预算',
        detail: '给本月可支出金额设一个上限；之后首页才能判断预算是否安全。',
        cta: '填写预算',
        href: '#budget-form',
      };
    }

    return {
      title: '检查本月预算执行',
      detail: progress.length > 0
        ? `${annualOverview ? '年度预算' : '本月预算合计'}剩余 ${totalRemaining.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 元；顺手补录今天的支出。`
        : '还没有本月预算，先创建一个总预算或常用分类预算。',
      cta: progress.length > 0 ? '快速记录支出' : '创建预算',
      href: progress.length > 0 ? '#budget-progress' : '#budget-form',
    };
  })();

  async function handleCreate(formData: FormData) {
    setError('');
    setLoading(true);
    const result = await createBudget({
      name: formData.get('name') as string,
      categoryId: (formData.get('categoryId') as string) || undefined,
      amount: formData.get('amount') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
    });
    if (result.success) {
      (document.getElementById('budget-form') as HTMLFormElement)?.reset();
      setSuccessMsg('预算已创建');
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list'));
      setTimeout(() => setSuccessMsg(''), 2500);
    } else {
      setError(result.error || '创建失败');
    }
    setLoading(false);
  }

  async function handleDelete(formData: FormData) {
    const id = formData.get('id') as string;
    await deleteBudget(id);
    mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list'));
  }

  async function handleUpdateBudget() {
    if (!editingId) return;
    setError('');
    await updateBudget(editingId, {
      name: editForm.name || undefined,
      amount: editForm.amount || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
    });
    setEditingId(null);
    mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list'));
  }

  function startEdit(b: Budget) {
    setEditingId(b.id);
    setEditForm({
      name: b.name,
      amount: b.amount?.toString?.() || '',
      startDate: fmtDate(b.startDate),
      endDate: fmtDate(b.endDate),
    });
  }

  function toggleExpenseEditor(budgetId: string) {
    const opening = expenseRowId !== budgetId;
    setExpenseRowId(opening ? budgetId : null);
    if (!opening) return;

    setEditingId(null);
    setExpenseForm({ amount: '', description: '', date: currentDate, fromAccountId: '' });
  }

  function toggleEditEditor(budget: Budget) {
    if (editingId === budget.id) {
      setEditingId(null);
      return;
    }

    setExpenseRowId(null);
    startEdit(budget);
  }

  async function handleRecordExpense(budgetId: string) {
    if (!expenseForm.amount) return;
    setError('');
    const budget = budgets.find(b => b.id === budgetId);
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: expenseForm.amount,
      categoryId: budget?.categoryId || undefined,
      budgetId: budgetId,
      fromAccountId: expenseForm.fromAccountId || undefined,
      description: expenseForm.description || undefined,
      occurredAt: expenseForm.date,
    });
    if (result.success) {
      setExpenseRowId(null);
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list'));
      mutate('transactions');
    } else {
      setError(result.error || '记录失败');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>预算管理</h1>
        <span className="text-sm text-ledger-muted">{currentDate}</span>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ {successMsg}
        </div>
      )}

      {budgetFocus && (
        <section className="mb-6 rounded-xl border border-ledger-accent/20 bg-ledger-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-ledger-muted">预算行动</div>
              <h2 className="mt-1 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {budgetFocusCopy.title}
              </h2>
              <p className="mt-1 text-sm text-ledger-muted">
                {budgetFocusCopy.detail}
              </p>
            </div>
            <a href={budgetFocusCopy.href} className="btn btn-outline btn-sm">
              {budgetFocusCopy.cta}
            </a>
          </div>
        </section>
      )}

      {/* Budget Progress */}
      <div id="budget-progress" className="mb-6">
        <BudgetTracker progress={progress} transactions={transactions} assets={assets} focus={budgetFocus} />
      </div>

      {/* Create Form */}
      <form
        id="budget-form"
        action={handleCreate}
        className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-ledger-muted mb-1">名称</label>
          <input
            name="name"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="如：餐饮预算"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="categoryId"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          >
            <option value="">总预算</option>
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">金额</label>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
          <input
            name="startDate"
            type="date"
            required
            defaultValue={currentDate.slice(0, 7) + '-01'}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">结束日期</label>
          <input
            name="endDate"
            type="date"
            required
            defaultValue={(() => {
              const d = new Date(currentDate);
              return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
            })()}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ color: 'var(--color-text-inverse)' }}
        >
          {loading ? '创建中...' : '添加预算'}
        </button>
      </form>

      {/* Mobile budget cards */}
      <section className="grid gap-3 md:hidden" aria-label="预算列表">
        {budgets.length === 0 ? (
          <div className="rounded-xl bg-ledger-surface px-4 py-8 text-center text-sm text-ledger-muted">
            暂无预算
          </div>
        ) : null}

        {budgets.map((budget) => {
          const expenseOpen = expenseRowId === budget.id;
          const editOpen = editingId === budget.id;
          const dateRange = `${new Date(budget.startDate).toLocaleDateString('zh-CN')} — ${new Date(budget.endDate).toLocaleDateString('zh-CN')}`;

          return (
            <article
              key={budget.id}
              data-budget-mobile-card={budget.id}
              className="min-w-0 rounded-xl border border-[var(--border-tertiary)] bg-ledger-surface p-4 shadow-[var(--shadow-xs)]"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {budget.name}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-ledger-muted">
                    {budget.category?.name || '总计'} · {dateRange}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] text-ledger-muted">预算金额</div>
                  <div className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    ¥{parseAmount(budget.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  aria-expanded={expenseOpen}
                  aria-controls={`mobile-${budget.id}-expense-editor`}
                  onClick={() => toggleExpenseEditor(budget.id)}
                  className="min-h-11 rounded-lg bg-ledger-accent/15 px-2 text-sm font-medium text-ledger-accent"
                >
                  {expenseOpen ? '取消' : '记录支出'}
                </button>
                <button
                  type="button"
                  aria-expanded={editOpen}
                  aria-controls={`mobile-${budget.id}-edit-editor`}
                  onClick={() => toggleEditEditor(budget)}
                  className="min-h-11 rounded-lg bg-ledger-bg px-2 text-sm font-medium text-ledger-muted"
                >
                  {editOpen ? '取消' : '编辑'}
                </button>
                <form action={handleDelete} className="min-w-0">
                  <input type="hidden" name="id" value={budget.id} />
                  <button
                    type="submit"
                    className="min-h-11 w-full rounded-lg bg-red-500/10 px-2 text-sm font-medium text-ledger-danger"
                  >
                    删除
                  </button>
                </form>
              </div>

              {expenseOpen ? (
                <BudgetExpenseEditor
                  budgetId={budget.id}
                  assets={assets}
                  form={expenseForm}
                  setForm={setExpenseForm}
                  onSave={handleRecordExpense}
                  variant="mobile"
                />
              ) : null}

              {editOpen ? (
                <BudgetEditEditor
                  budgetId={budget.id}
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleUpdateBudget}
                  onCancel={() => setEditingId(null)}
                  variant="mobile"
                />
              ) : null}
            </article>
          );
        })}
      </section>

      {/* Desktop budget table */}
      <div className="hidden overflow-hidden rounded-xl bg-ledger-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-bg text-left text-ledger-muted">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">日期范围</th>
              <th className="px-4 py-3 font-medium text-right">预算金额</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {budgets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ledger-muted">
                  暂无预算
                </td>
              </tr>
            )}
            {budgets.map((budget: Budget) => (
              <tr key={budget.id} className="border-b border-ledger-bg last:border-0">
                <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{budget.name}</td>
                <td className="px-4 py-3 text-ledger-muted">{budget.category?.name || '总计'}</td>
                <td className="px-4 py-3 text-ledger-muted text-xs">
                  {new Date(budget.startDate).toLocaleDateString('zh-CN')} ~ {new Date(budget.endDate).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>
                  ¥{parseAmount(budget.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-expanded={expenseRowId === budget.id}
                        aria-controls={`desktop-${budget.id}-expense-editor`}
                        onClick={() => toggleExpenseEditor(budget.id)}
                        className="text-xs px-2 py-0.5 rounded bg-ledger-accent/20 text-ledger-accent hover:bg-ledger-accent/30"
                      >
                        {expenseRowId === budget.id ? '取消' : '记录支出'}
                      </button>
                      <button
                        type="button"
                        aria-expanded={editingId === budget.id}
                        aria-controls={`desktop-${budget.id}-edit-editor`}
                        onClick={() => toggleEditEditor(budget)}
                        className="text-xs px-2 py-0.5 rounded bg-ledger-bg text-ledger-muted hover:text-white"
                      >
                        {editingId === budget.id ? '取消' : '编辑'}
                      </button>
                      <form action={handleDelete} className="inline">
                        <input type="hidden" name="id" value={budget.id} />
                        <button type="submit" className="text-ledger-danger hover:underline text-xs">
                          删除
                        </button>
                      </form>
                    </div>

                    {expenseRowId === budget.id ? (
                      <BudgetExpenseEditor
                        budgetId={budget.id}
                        assets={assets}
                        form={expenseForm}
                        setForm={setExpenseForm}
                        onSave={handleRecordExpense}
                        variant="desktop"
                      />
                    ) : null}

                    {editingId === budget.id ? (
                      <BudgetEditEditor
                        budgetId={budget.id}
                        form={editForm}
                        setForm={setEditForm}
                        onSave={handleUpdateBudget}
                        onCancel={() => setEditingId(null)}
                        variant="desktop"
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
