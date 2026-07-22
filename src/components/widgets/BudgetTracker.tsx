'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/actions/ledger';
import { updateBudget } from '@/lib/actions/budget';
import { useSWRConfig } from 'swr';
import AnnualBudgetRingChart, {
  type AnnualBudgetExecutionRow,
} from '@/components/charts/AnnualBudgetRingChart';
import {
  buildAnnualBudgetOverview,
  getLivingBudgetTransactions,
  type AnnualBudgetProgress,
} from '@/lib/annual-budget';

type BudgetProgress = AnnualBudgetProgress;

interface Transaction {
  id: string;
  amount: string;
  description?: string | null;
  occurredAt: string | Date;
  budgetId?: string | null;
  categoryId?: string | null;
  fromAccountId?: string | null;
  type: string;
  budget?: { id: string; name: string } | null;
  fromAsset?: { id: string; name: string } | null;
}

interface Asset {
  id: string;
  name: string;
}

type BudgetFocus = 'over' | 'create' | 'review' | null;
type ExpandedBudgetId = string | '__none' | null;
type TransactionsProp = Transaction[] | { data?: Transaction[] } | null | undefined;
type BudgetAmountMode = 'hidden' | 'editable' | 'automatic';

function normalizeTransactions(transactions: TransactionsProp): Transaction[] {
  if (Array.isArray(transactions)) return transactions;
  if (transactions && Array.isArray(transactions.data)) return transactions.data;
  return [];
}

function formatDateInputValue(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;
  return new Date(value).toISOString().slice(0, 10);
}

export default function BudgetTracker({
  progress,
  transactions,
  assets = [],
  focus = null,
}: {
  progress: BudgetProgress[];
  transactions?: TransactionsProp;
  assets?: Asset[];
  focus?: BudgetFocus;
}) {
  const { mutate } = useSWRConfig();
  const [expandedId, setExpandedId] = useState<ExpandedBudgetId>(null);
  const [form, setForm] = useState({ amount: '', description: '', fromAccountId: '' });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '', fromAccountId: '', occurredAt: '' });
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [error, setError] = useState('');
  const focusedOverBudgetId = focus === 'over'
    ? progress.find((p) => p.isOverBudget)?.id ?? null
    : null;
  const activeExpandedId = expandedId === '__none'
    ? null
    : expandedId ?? focusedOverBudgetId;
  const annualOverview = buildAnnualBudgetOverview(progress);

  if (progress.length === 0) return null;

  const txs = normalizeTransactions(transactions);
  const livingBudgetTransactions = annualOverview
    ? getLivingBudgetTransactions(progress, txs)
    : [];

  async function handleAddExpense(budgetId: string, categoryId?: string | null) {
    if (!form.amount) return;
    setError('');
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: form.amount,
      budgetId,
      categoryId: categoryId || undefined,
      fromAccountId: form.fromAccountId || undefined,
      description: form.description || undefined,
      occurredAt: new Date().toISOString().slice(0, 10),
    });
    if (result.success) {
      setForm({ amount: '', description: '', fromAccountId: '' });
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list')); mutate('transactions');
    } else {
      setError(result.error || '添加失败');
    }
  }

  async function handleUpdateTx(txId: string) {
    if (!editForm.amount) return;
    const result = await updateTransaction(txId, {
      amount: editForm.amount || undefined,
      description: editForm.description || undefined,
      fromAccountId: editForm.fromAccountId || null,
      occurredAt: editForm.occurredAt || undefined,
    });
    if (result.success) {
      setEditingTxId(null);
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list')); mutate('transactions');
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDeleteTx(txId: string) {
    if (!confirm('确认删除这笔支出？')) return;
    const result = await deleteTransaction(txId);
    if (result.success) {
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list')); mutate('transactions');
    } else {
      setError(result.error || '删除失败');
    }
  }

  function startEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    setEditForm({
      amount: tx.amount?.toString() || '',
      description: tx.description || '',
      fromAccountId: tx.fromAccountId || '',
      occurredAt: formatDateInputValue(tx.occurredAt),
    });
  }

  async function saveBudgetAmount(budgetId: string) {
    if (!editBudgetAmount) {
      setEditingBudgetId(null);
      return;
    }

    const result = await updateBudget(budgetId, { amount: editBudgetAmount });
    if (result.success) {
      setEditingBudgetId(null);
      mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list'));
      mutate('transactions');
    } else {
      setError(result.error || '更新预算失败');
    }
  }

  function toggleBudgetDetails(budgetId: string) {
    setExpandedId(activeExpandedId === budgetId ? '__none' : budgetId);
  }

  function renderBudgetDetails(
    p: BudgetProgress,
    {
      amountMode = 'hidden',
      detailTransactions,
    }: {
      amountMode?: BudgetAmountMode;
      detailTransactions?: Transaction[];
    } = {},
  ) {
    const budgetTxs = (detailTransactions ?? txs.filter(t => t.budgetId === p.id))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return (
      <div className="border-t border-[var(--border-tertiary)] bg-ledger-bg/60 p-3">
        {amountMode !== 'hidden' ? (
          <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-ledger-primary/10 pb-2 text-xs">
            <span className="text-ledger-muted">预算额度</span>
            {amountMode === 'automatic' ? (
              <span className="font-medium text-ledger-muted">
                自动归集 ¥{p.budgetAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </span>
            ) : editingBudgetId === p.id ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={editBudgetAmount}
                  onChange={e => setEditBudgetAmount(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') await saveBudgetAmount(p.id);
                    if (e.key === 'Escape') setEditingBudgetId(null);
                  }}
                  className="w-24 rounded-md border border-ledger-accent bg-white px-2 py-1 text-xs focus:outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                  aria-label={`${p.name}预算额度`}
                  autoFocus
                />
                <button type="button" onClick={() => saveBudgetAmount(p.id)} className="font-medium text-ledger-accent">
                  保存
                </button>
                <button type="button" onClick={() => setEditingBudgetId(null)} className="text-ledger-muted">
                  取消
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingBudgetId(p.id);
                  setEditBudgetAmount(p.budgetAmount.toString());
                }}
                className="font-medium text-ledger-accent"
              >
                调整额度 ¥{p.budgetAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </button>
            )}
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap items-end gap-2 border-b border-ledger-primary/10 pb-2">
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">金额</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id, p.categoryId); }}
              className="w-24 rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1 text-xs focus:border-ledger-accent focus:outline-none"
              style={{ color: 'var(--color-text-primary)' }}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">来源资金账户</label>
            <select
              value={form.fromAccountId}
              onChange={e => setForm(f => ({ ...f, fromAccountId: e.target.value }))}
              className="w-32 rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1 text-xs focus:border-ledger-accent focus:outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <option value="">不指定（只记总收支）</option>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ledger-muted">备注</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id, p.categoryId); }}
              className="w-36 rounded-md border border-ledger-bg bg-ledger-surface px-2 py-1 text-xs focus:border-ledger-accent focus:outline-none"
              style={{ color: 'var(--color-text-primary)' }}
              placeholder="备注"
            />
          </div>
          <button
            type="button"
            onClick={() => handleAddExpense(p.id, p.categoryId)}
            disabled={!form.amount}
            className="rounded-md bg-ledger-accent px-3 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            style={{ color: 'var(--color-text-inverse)' }}
          >
            添加
          </button>
        </div>

        {budgetTxs.length === 0 ? (
          <div className="py-2 text-xs text-ledger-muted">暂无支出记录</div>
        ) : (
          <div className="space-y-1">
            {budgetTxs.slice(0, 20).map(tx => (
              <div key={tx.id}>
                {editingTxId === tx.id ? (
                  <div className="flex flex-wrap items-end gap-2 rounded bg-ledger-surface/50 px-2 py-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editForm.amount}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-20 rounded border bg-white px-2 py-0.5 text-xs focus:border-ledger-accent focus:outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                      aria-label="支出金额"
                    />
                    <input
                      type="date"
                      value={editForm.occurredAt}
                      onChange={e => setEditForm(f => ({ ...f, occurredAt: e.target.value }))}
                      className="w-32 rounded border bg-white px-2 py-0.5 text-xs focus:border-ledger-accent focus:outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                      aria-label="支出日期"
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-28 rounded border bg-white px-2 py-0.5 text-xs focus:border-ledger-accent focus:outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                      aria-label="支出备注"
                    />
                    <select
                      value={editForm.fromAccountId}
                      onChange={e => setEditForm(f => ({ ...f, fromAccountId: e.target.value }))}
                      className="w-32 rounded border bg-white px-2 py-0.5 text-xs focus:border-ledger-accent focus:outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                      aria-label="来源资金账户"
                    >
                      <option value="">不指定（只记总收支）</option>
                      {assets.map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => handleUpdateTx(tx.id)} className="text-xs text-green-400 hover:text-green-300">保存</button>
                    <button type="button" onClick={() => setEditingTxId(null)} className="text-xs text-ledger-muted hover:text-white">取消</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded bg-ledger-surface/30 px-2 py-1 text-xs sm:grid-cols-[4rem_5rem_6rem_minmax(0,1fr)_auto]">
                    <span className="text-ledger-muted">
                      {new Date(tx.occurredAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    </span>
                    <AmountDisplay amount={parseFloat(tx.amount || '0')} className="text-[var(--color-text-primary)]" />
                    <span className="min-w-0 truncate text-ledger-muted" title={tx.fromAsset?.name || '未指定来源资金账户'}>
                      {tx.fromAsset?.name || '未指定账户'}
                    </span>
                    <span className="col-span-4 min-w-0 truncate text-ledger-muted sm:col-span-1">{tx.description || '--'}</span>
                    <span className="col-start-4 row-start-1 inline-flex shrink-0 items-center gap-2 sm:col-start-5">
                      <button type="button" onClick={() => startEdit(tx)} className="text-ledger-muted hover:text-white">编辑</button>
                      <button type="button" onClick={() => handleDeleteTx(tx.id)} className="text-ledger-danger hover:underline">删除</button>
                    </span>
                  </div>
                )}
              </div>
            ))}
            {budgetTxs.length > 20 ? (
              <div className="pt-1 text-xs text-ledger-muted">...还有 {budgetTxs.length - 20} 笔</div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  function renderAnnualBudgetDetails(
    budgetId: string,
    segment: AnnualBudgetExecutionRow,
  ) {
    const budget = progress.find(item => item.id === budgetId);
    if (!budget) return null;
    if (!segment.isLiving) {
      return renderBudgetDetails(budget, { amountMode: 'editable' });
    }

    const livingBudget: BudgetProgress = {
      ...budget,
      name: segment.name,
      categoryId: null,
      categoryName: '生活',
      budgetAmount: segment.budgetAmount,
      spent: segment.spent,
      remaining: segment.remaining,
      pct: segment.usedPercent,
      isOverBudget: segment.isOverBudget,
    };
    return renderBudgetDetails(livingBudget, {
      amountMode: 'automatic',
      detailTransactions: livingBudgetTransactions,
    });
  }

  return (
    <div className={annualOverview ? '' : 'rounded-xl bg-ledger-surface p-4'}>
      {annualOverview ? null : (
        <h2 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>预算执行</h2>
      )}

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-xs text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {annualOverview ? (
        <AnnualBudgetRingChart
          overview={annualOverview}
          expandedBudgetId={activeExpandedId}
          onToggleBudget={toggleBudgetDetails}
          renderBudgetDetails={renderAnnualBudgetDetails}
        />
      ) : null}

      {annualOverview ? null : <div className="space-y-3">
        {progress.map(p => {
          const isExpanded = activeExpandedId === p.id;

          return (
            <div key={p.id}>
              <div
                className="flex items-center justify-between text-sm mb-1 cursor-pointer hover:bg-ledger-bg/30 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={() => setExpandedId(isExpanded ? '__none' : p.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{isExpanded ? '收起' : '记录'}</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                  <span className="text-xs text-ledger-muted">{p.categoryName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <AmountDisplay amount={p.spent} className="text-[var(--color-text-primary)]" />
                  <span className="text-ledger-muted">/</span>
                  {editingBudgetId === p.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editBudgetAmount}
                        onChange={e => setEditBudgetAmount(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            await updateBudget(p.id, { amount: editBudgetAmount || undefined });
                            setEditingBudgetId(null);
                            mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list')); mutate('transactions');
                          }
                          if (e.key === 'Escape') setEditingBudgetId(null);
                        }}
                        onBlur={async () => {
                          if (editBudgetAmount) {
                            await updateBudget(p.id, { amount: editBudgetAmount });
                            setEditingBudgetId(null);
                            mutate(key => typeof key === 'string' && (key.startsWith('budgets') || key === 'budgets-list')); mutate('transactions');
                          } else {
                            setEditingBudgetId(null);
                          }
                        }}
                        className="w-20 rounded bg-white border border-ledger-accent px-2 py-0.5 text-xs focus:outline-none"
                        style={{ color: 'var(--color-text-primary)' }}
                        autoFocus
                      />
                    </span>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-ledger-accent border-b border-dashed border-ledger-muted/30"
                      onClick={() => { setEditingBudgetId(p.id); setEditBudgetAmount(p.budgetAmount.toString()); }}
                      title="点击修改预算金额"
                    >
                      <AmountDisplay amount={p.budgetAmount} />
                    </span>
                  )}
                  {p.isOverBudget && (
                    <span className="text-ledger-danger font-medium">超支!</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-ledger-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    p.isOverBudget
                      ? 'bg-gradient-to-r from-ledger-danger to-red-400'
                      : p.pct > 80
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                        : 'bg-gradient-to-r from-green-500 to-green-400'
                  }`}
                  style={{ width: `${Math.min(p.pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-ledger-muted mt-0.5">
                <span>{p.pct.toFixed(0)}%</span>
                <span>
                  剩余 <AmountDisplay amount={p.remaining} className={p.remaining < 0 ? 'text-ledger-danger' : ''} />
                </span>
              </div>

              {isExpanded ? renderBudgetDetails(p) : null}
            </div>
          );
        })}
      </div>}
    </div>
  );
}
