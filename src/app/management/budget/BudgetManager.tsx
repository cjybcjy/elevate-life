'use client';

import { useState, useOptimistic } from 'react';
import { createBudget, updateBudget, deleteBudget, getBudgets } from '@/lib/actions/budget';
import { createTransaction } from '@/lib/actions/ledger';
import { getCategories } from '@/lib/actions/categories';
import BudgetTracker from '@/components/widgets/BudgetTracker';
import { useBudgets } from '@/hooks/useBudgets';
import { useToast } from '@/components/common/Toast';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';

interface Budget {
  id: string;
  name: string;
  categoryId?: string | null;
  amount: { toString: () => string };
  startDate: string | Date;
  endDate: string | Date;
  category?: { id: string; name: string } | null;
}

interface BudgetProgress {
  id: string;
  name: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  pct: number;
  isOverBudget: boolean;
}

function parseAmount(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v);
  return parseFloat(v?.toString?.() || '0');
}

function fmtDate(d: string | Date | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export default function BudgetManager({ currentDate }: { currentDate: string }) {
  const { data: budgetData, isLoading: budgetLoading } = useBudgets(currentDate);
  const progress = budgetData?.data ?? [];
  const { data: budgetsData } = useSWR('budgets-list', () => getBudgets().then(r => r.success ? (r.data ?? []) : []));
  const budgets: Budget[] = budgetsData ?? [];
  const { data: catData } = useSWR('categories', () => getCategories().then(r => r.success ? (r.data ?? []) : []));
  const categories = catData ?? [];
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', amount: '', startDate: '', endDate: '' });
  const [expenseRowId, setExpenseRowId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', date: currentDate });

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
      mutate('budgets');
      setTimeout(() => setSuccessMsg(''), 2500);
    } else {
      setError(result.error || '创建失败');
    }
    setLoading(false);
  }

  async function handleDelete(formData: FormData) {
    const id = formData.get('id') as string;
    await deleteBudget(id);
    mutate('budgets');
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
    mutate('budgets');
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

  async function handleRecordExpense(budgetId: string) {
    if (!expenseForm.amount) return;
    setError('');
    const budget = budgets.find(b => b.id === budgetId);
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: expenseForm.amount,
      categoryId: budget?.categoryId || undefined,
      budgetId: budgetId,
      description: expenseForm.description || undefined,
      occurredAt: expenseForm.date,
    });
    if (result.success) {
      setExpenseRowId(null);
            mutate('budgets');
    } else {
      setError(result.error || '记录失败');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">预算管理</h1>
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

      {/* Budget Progress */}
      <div className="mb-6">
        <BudgetTracker progress={progress} />
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="如：餐饮预算"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="categoryId"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">总预算</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">金额</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '创建中...' : '添加预算'}
        </button>
      </form>

      {/* Budget List */}
      <div className="rounded-xl bg-ledger-surface overflow-hidden">
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
            {budgets.map((b: Budget) => (
              <tr key={b.id} className="border-b border-ledger-bg last:border-0">
                <td className="px-4 py-3 text-white">{b.name}</td>
                <td className="px-4 py-3 text-ledger-muted">{b.category?.name || '总计'}</td>
                <td className="px-4 py-3 text-ledger-muted text-xs">
                  {new Date(b.startDate).toLocaleDateString('zh-CN')} ~ {new Date(b.endDate).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  ¥{parseAmount(b.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseRowId(expenseRowId === b.id ? null : b.id);
                          setExpenseForm({ amount: '', description: '', date: currentDate });
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-ledger-accent/20 text-ledger-accent hover:bg-ledger-accent/30"
                      >
                        {expenseRowId === b.id ? '取消' : '记录支出'}
                      </button>
                      <button
                        type="button"
                        onClick={() => editingId === b.id ? setEditingId(null) : startEdit(b)}
                        className="text-xs px-2 py-0.5 rounded bg-ledger-bg text-ledger-muted hover:text-white"
                      >
                        {editingId === b.id ? '取消' : '编辑'}
                      </button>
                      <form action={handleDelete} className="inline">
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="text-ledger-danger hover:underline text-xs">
                          删除
                        </button>
                      </form>
                    </div>

                    {/* Inline expense form */}
                    {expenseRowId === b.id && (
                      <div className="mt-2 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">金额</label>
                            <input
                              type="number" step="0.01" required
                              value={expenseForm.amount}
                              onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">日期</label>
                            <input
                              type="date"
                              value={expenseForm.date}
                              onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">备注</label>
                            <input
                              type="text"
                              value={expenseForm.description}
                              onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                              placeholder="备注"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRecordExpense(b.id)}
                            disabled={!expenseForm.amount}
                            className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit form */}
                    {editingId === b.id && (
                      <div className="mt-2 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">名称</label>
                            <input
                              type="text" value={editForm.name}
                              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">金额</label>
                            <input
                              type="number" step="0.01" value={editForm.amount}
                              onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-28"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">开始</label>
                            <input
                              type="date" value={editForm.startDate}
                              onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">结束</label>
                            <input
                              type="date" value={editForm.endDate}
                              onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <button
                            type="button" onClick={handleUpdateBudget}
                            className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    )}
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
