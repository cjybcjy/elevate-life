'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/actions/ledger';
import { updateBudget } from '@/lib/actions/budget';
import { useSWRConfig } from 'swr';

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

  if (progress.length === 0) return null;

  const txs = normalizeTransactions(transactions);

  async function handleAddExpense(budgetId: string) {
    if (!form.amount) return;
    setError('');
    const linkedTx = txs.find(t => t.budgetId === budgetId);
    const categoryId = linkedTx?.categoryId || undefined;
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: form.amount,
      budgetId,
      categoryId,
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

  return (
    <div className="bg-ledger-surface rounded-xl p-4">
      <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>预算执行</h2>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-xs text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      <div className="space-y-3">
        {progress.map(p => {
          const isExpanded = activeExpandedId === p.id;
          const budgetTxs = txs.filter(t => t.budgetId === p.id).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

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
                        type="number"
                        step="0.01"
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
                        className="w-20 rounded bg-white dark:bg-ledger-bg border border-ledger-accent px-2 py-0.5 text-xs focus:outline-none"
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

              {/* Expanded: transaction list + add form */}
              {isExpanded && (
                <div className="mt-2 ml-5 p-3 bg-ledger-bg rounded-lg border border-ledger-primary/10">
                  {/* Quick add form */}
                  <div className="flex items-end gap-2 mb-2 pb-2 border-b border-ledger-primary/10">
                    <div>
                      <label className="block text-xs text-ledger-muted mb-1">金额</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id); }}
                        className="w-24 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs focus:outline-none focus:border-ledger-accent"
                        style={{ color: 'var(--color-text-primary)' }}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ledger-muted mb-1">来源资金账户</label>
                      <select
                        value={form.fromAccountId}
                        onChange={e => setForm(f => ({ ...f, fromAccountId: e.target.value }))}
                        className="w-32 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs focus:outline-none focus:border-ledger-accent"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <option value="">不指定（只记总收支）</option>
                        {assets.map(asset => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ledger-muted mb-1">备注</label>
                      <input
                        type="text"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id); }}
                        className="w-36 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs focus:outline-none focus:border-ledger-accent"
                        style={{ color: 'var(--color-text-primary)' }}
                        placeholder="备注"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddExpense(p.id)}
                      disabled={!form.amount}
                      className="rounded-md bg-ledger-accent px-3 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      style={{ color: 'var(--color-text-inverse)' }}
                    >
                      添加
                    </button>
                  </div>

                  {/* Transaction list */}
                  {budgetTxs.length === 0 ? (
                    <div className="text-xs text-ledger-muted py-2">暂无支出记录</div>
                  ) : (
                    <div className="space-y-1">
                      {budgetTxs.slice(0, 20).map(tx => (
                        <div key={tx.id}>
                          {editingTxId === tx.id ? (
                            <div className="flex flex-wrap items-end gap-2 bg-ledger-surface/50 rounded px-2 py-1.5">
                              <div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.amount}
                                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                  className="w-20 rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-ledger-accent bg-white dark:bg-ledger-bg"
                                  style={{ color: 'var(--color-text-primary)' }}
                                />
                              </div>
                              <div>
                                <input
                                  type="date"
                                  value={editForm.occurredAt}
                                  onChange={e => setEditForm(f => ({ ...f, occurredAt: e.target.value }))}
                                  className="w-32 rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-ledger-accent bg-white dark:bg-ledger-bg"
                                  style={{ color: 'var(--color-text-primary)' }}
                                  aria-label="支出日期"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={editForm.description}
                                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                  className="w-28 rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-ledger-accent bg-white dark:bg-ledger-bg"
                                  style={{ color: 'var(--color-text-primary)' }}
                                />
                              </div>
                              <div>
                                <select
                                  value={editForm.fromAccountId}
                                  onChange={e => setEditForm(f => ({ ...f, fromAccountId: e.target.value }))}
                                  className="w-32 rounded border px-2 py-0.5 text-xs focus:outline-none focus:border-ledger-accent bg-white dark:bg-ledger-bg"
                                  style={{ color: 'var(--color-text-primary)' }}
                                  aria-label="来源资金账户"
                                >
                                  <option value="">不指定（只记总收支）</option>
                                  {assets.map(asset => (
                                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button onClick={() => handleUpdateTx(tx.id)} className="text-xs text-green-400 hover:text-green-300">保存</button>
                              <button onClick={() => setEditingTxId(null)} className="text-xs text-ledger-muted hover:text-white">取消</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-xs bg-ledger-surface/30 rounded px-2 py-1">
                              <span className="text-ledger-muted w-16 shrink-0">
                                {new Date(tx.occurredAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                              </span>
                              <AmountDisplay amount={parseFloat(tx.amount || '0')} className="text-[var(--color-text-primary)] w-20 shrink-0" />
                              <span className="text-ledger-muted w-24 shrink-0 truncate" title={tx.fromAsset?.name || '未指定来源资金账户'}>
                                {tx.fromAsset?.name || '未指定账户'}
                              </span>
                              <span className="text-ledger-muted flex-1 truncate">{tx.description || '--'}</span>
                              <button onClick={() => startEdit(tx)} className="text-ledger-muted hover:text-white shrink-0">编辑</button>
                              <button onClick={() => handleDeleteTx(tx.id)} className="text-ledger-danger hover:underline shrink-0">删除</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {budgetTxs.length > 20 && (
                        <div className="text-xs text-ledger-muted pt-1">...还有 {budgetTxs.length - 20} 笔</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
