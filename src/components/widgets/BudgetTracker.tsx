'use client';

import { useState } from 'react';
import { AmountDisplay } from '../common/AmountDisplay';
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/actions/ledger';
import { updateBudget } from '@/lib/actions/budget';
import { useToast } from '@/components/common/Toast';
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
  occurredAt: string;
  budgetId?: string | null;
  categoryId?: string | null;
  type: string;
  budget?: { id: string; name: string } | null;
}

export default function BudgetTracker({
  progress,
  transactions,
}: {
  progress: BudgetProgress[];
  transactions?: Transaction[];
}) {
  const { mutate } = useSWRConfig();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: '', description: '' });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '' });
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [error, setError] = useState('');

  if (progress.length === 0) return null;

  const txs = transactions || [];

  async function handleAddExpense(budgetId: string, categoryName: string) {
    if (!form.amount) return;
    setError('');
    // Find the budget to get its category
    const budget = progress.find(p => p.id === budgetId);
    const linkedTx = txs.find(t => t.budgetId === budgetId);
    const categoryId = linkedTx?.categoryId || undefined;
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: form.amount,
      budgetId,
      categoryId,
      description: form.description || undefined,
      occurredAt: new Date().toISOString().slice(0, 10),
    });
    if (result.success) {
      setForm({ amount: '', description: '' });
      mutate('budgets'); mutate('transactions');
    } else {
      setError(result.error || '添加失败');
    }
  }

  async function handleUpdateTx(txId: string) {
    if (!editForm.amount) return;
    const result = await updateTransaction(txId, {
      amount: editForm.amount || undefined,
      description: editForm.description || undefined,
    });
    if (result.success) {
      setEditingTxId(null);
      mutate('budgets'); mutate('transactions');
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDeleteTx(txId: string) {
    if (!confirm('确认删除这笔支出？')) return;
    const result = await deleteTransaction(txId);
    if (result.success) {
      mutate('budgets'); mutate('transactions');
    } else {
      setError(result.error || '删除失败');
    }
  }

  function startEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    setEditForm({
      amount: tx.amount?.toString() || '',
      description: tx.description || '',
    });
  }

  return (
    <div className="bg-ledger-surface rounded-xl p-4">
      <h2 className="text-base font-bold text-white mb-3">预算执行</h2>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-xs text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      <div className="space-y-3">
        {progress.map(p => {
          const isExpanded = expandedId === p.id;
          const budgetTxs = txs.filter(t => t.budgetId === p.id).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

          return (
            <div key={p.id}>
              <div
                className="flex items-center justify-between text-sm mb-1 cursor-pointer hover:bg-ledger-bg/30 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">{isExpanded ? '收起' : '记录'}</span>
                  <span className="text-white">{p.name}</span>
                  <span className="text-xs text-ledger-muted">{p.categoryName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <AmountDisplay amount={p.spent} className="text-white" />
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
                            mutate('budgets'); mutate('transactions');
                          }
                          if (e.key === 'Escape') setEditingBudgetId(null);
                        }}
                        onBlur={async () => {
                          if (editBudgetAmount) {
                            await updateBudget(p.id, { amount: editBudgetAmount });
                            setEditingBudgetId(null);
                            mutate('budgets'); mutate('transactions');
                          } else {
                            setEditingBudgetId(null);
                          }
                        }}
                        className="w-20 rounded bg-ledger-bg border border-ledger-accent px-2 py-0.5 text-xs text-white focus:outline-none"
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
                        onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id, p.categoryName); }}
                        className="w-24 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ledger-muted mb-1">备注</label>
                      <input
                        type="text"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddExpense(p.id, p.categoryName); }}
                        className="w-36 rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1 text-xs text-white focus:outline-none focus:border-ledger-accent"
                        placeholder="备注"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddExpense(p.id, p.categoryName)}
                      disabled={!form.amount}
                      className="rounded-md bg-ledger-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
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
                            <div className="flex items-end gap-2 bg-ledger-surface/50 rounded px-2 py-1.5">
                              <div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.amount}
                                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                  className="w-20 rounded bg-ledger-bg border border-ledger-bg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={editForm.description}
                                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                  className="w-28 rounded bg-ledger-bg border border-ledger-bg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
                                />
                              </div>
                              <button onClick={() => handleUpdateTx(tx.id)} className="text-xs text-green-400 hover:text-green-300">保存</button>
                              <button onClick={() => setEditingTxId(null)} className="text-xs text-ledger-muted hover:text-white">取消</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-xs bg-ledger-surface/30 rounded px-2 py-1">
                              <span className="text-ledger-muted w-16 shrink-0">
                                {new Date(tx.occurredAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                              </span>
                              <AmountDisplay amount={parseFloat(tx.amount || '0')} className="text-white w-20 shrink-0" />
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
