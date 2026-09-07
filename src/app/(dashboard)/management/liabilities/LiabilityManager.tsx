'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { createLiability, updateLiability, deleteLiability } from '@/lib/actions/liabilities';
import { createTransaction, deleteTransaction, updateTransaction } from '@/lib/actions/ledger';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { useLiabilities } from '@/hooks/useLiabilities';
import { useTransactions } from '@/hooks/useTransactions';
import { useAssets } from '@/hooks/useAssets';
import { useSWRConfig } from 'swr';
import {
  LIABILITY_DRAWDOWN_TRANSACTION_TYPE,
  isLiabilityDrawdown,
  isRevolvingCredit,
} from '@/lib/liability-transactions';
import { getDrawdownTargetOptions } from '@/lib/liability-repayment';
import {
  MobileEditorBar,
  mobileEditorControlClass,
  useMobileEditorScroll,
} from '@/components/common/MobileEditorBar';

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

const paymentMethodLabel: Record<string, string> = {
  equal_interest: '等额本息',
  equal_principal: '等额本金',
  bullet: '一次性还本付息',
  revolving_credit: '循环额度（随借随还）',
};

const EMPTY_TRANSACTIONS: any[] = [];
const EMPTY_ASSETS: any[] = [];
const EMPTY_LIABILITIES: Liability[] = [];

export default function LiabilityManager() {
  const { data: liabData } = useLiabilities();
  const { data: txData } = useTransactions();
  const transactions = txData?.data ?? EMPTY_TRANSACTIONS;
  const { data: assetData } = useAssets();
  const assets = assetData?.data ?? EMPTY_ASSETS;
  const drawdownTargets = useMemo(() => getDrawdownTargetOptions(assets), [assets]);
  const { mutate } = useSWRConfig();

  const liabilities = liabData?.data ?? EMPTY_LIABILITIES;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRepayId, setExpandedRepayId] = useState<string | null>(null);
  const [expandedDrawId, setExpandedDrawId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [repayForm, setRepayForm] = useState({
    amount: '',
    fromAccountId: '',
    description: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });
  const [drawForm, setDrawForm] = useState({
    amount: '',
    toAccountId: '',
    description: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });
  const [movementMsg, setMovementMsg] = useState('');
  const [editingRepayId, setEditingRepayId] = useState<string | null>(null);
  const [editRepayForm, setEditRepayForm] = useState({ amount: '', description: '', occurredAt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', category: '', principal: '', currentBalance: '',
    interestRate: '', termMonths: '', startDate: '', paymentMethod: 'equal_interest',
  });
  useMobileEditorScroll(editingRepayId ? `liability-movement-editor-${editingRepayId}` : null);

  useEffect(() => {
    if (!editingId || !window.matchMedia('(max-width: 767px)').matches) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`liability-editor-${editingId}`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingId]);

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
    // Optimistic: remove from SWR cache immediately
    mutate('liabilities',
      (current: any) => ({ ...current, data: (current?.data ?? []).filter((l: any) => l.id !== id) }),
      false
    );
    const result = await deleteLiability(id);
    if (result.success) {
      mutate('liabilities');
      mutate('transactions');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      mutate('liabilities'); // rollback
      setError(result.error || '删除失败');
    }
  }

  async function handleRepay(liabilityId: string) {
    const amount = repayForm.amount;
    if (!amount || parseFloat(amount) <= 0) return;

    setMovementMsg('');
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
      setMovementMsg('还款记录已创建，负债余额已减少');
      setRepayForm({
        amount: '',
        fromAccountId: '',
        description: '',
        occurredAt: new Date().toISOString().split('T')[0],
      });
      mutate('liabilities'); mutate('transactions'); mutate('assets');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '还款失败');
    }
    setLoading(false);
  }

  async function handleDraw(liability: Liability) {
    const amount = Number.parseFloat(drawForm.amount);
    const balance = Number.parseFloat(liability.currentBalance) || 0;
    const creditLimit = Number.parseFloat(liability.principal) || 0;
    const available = Math.max(0, creditLimit - balance);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!drawForm.toAccountId) {
      setError('借入循环贷时必须选择收款账户');
      return;
    }
    if (amount > available) {
      setError(`本次最多还能借入 ¥${available.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
      return;
    }

    setMovementMsg('');
    setError('');
    setLoading(true);
    const result = await createTransaction({
      type: LIABILITY_DRAWDOWN_TRANSACTION_TYPE,
      amount: String(amount),
      toAccountId: drawForm.toAccountId,
      liabilityId: liability.id,
      description: drawForm.description || `循环贷借入 · ${liability.name}`,
      occurredAt: drawForm.occurredAt,
    });

    if (result.success) {
      setMovementMsg('借入记录已创建，负债余额和收款账户已同步增加');
      setDrawForm({
        amount: '',
        toAccountId: '',
        description: '',
        occurredAt: new Date().toISOString().split('T')[0],
      });
      mutate('liabilities'); mutate('transactions'); mutate('assets');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setError(result.error || '借入失败');
    }
    setLoading(false);
  }

  async function handleDeleteRepay(txId: string) {
    const result = await deleteTransaction(txId);
    if (result.success) {
      mutate('liabilities'); mutate('transactions'); mutate('assets');
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
      mutate('liabilities'); mutate('transactions'); mutate('assets');
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
    setExpandedDrawId(null);
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

  const liabilityMovements = useMemo(() => {
    const movements = new Map<string, any[]>();
    for (const transaction of transactions) {
      if (!transaction.liabilityId || (transaction.type !== 'EXPENSE' && !isLiabilityDrawdown(transaction.type))) continue;
      const history = movements.get(transaction.liabilityId) ?? [];
      history.push(transaction);
      movements.set(transaction.liabilityId, history);
    }
    for (const history of movements.values()) {
      history.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
    }
    return movements;
  }, [transactions]);
  const hasRevolvingLiability = liabilities.some((liability) => isRevolvingCredit(liability.paymentMethod));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">负债管理</h1>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {movementMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <span>{movementMsg}</span>
          <button onClick={() => setMovementMsg('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {liabilities.length > 0 && !hasRevolvingLiability && (
        <div
          data-revolving-credit-migration-hint="true"
          className="mb-4 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)]"
        >
          <span className="font-medium text-[var(--color-warning)]">“借一笔”还没显示：</span>{' '}
          当前负债仍是固定还款方式。请在下表点“编辑”，把对应贷款改为“循环额度（随借随还）”，并确认“本金 / 授信额度”和“当前余额 / 已用额度”后保存。
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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="负债名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="category"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
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
          <label className="block text-xs text-ledger-muted mb-1">本金 / 授信额度</label>
          <input
            name="principal"
            type="text"
            inputMode="decimal"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">当前余额 / 已用额度</label>
          <input
            name="currentBalance"
            type="text"
            inputMode="decimal"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="循环额度留空为 0"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">年利率</label>
          <input
            name="interestRate"
            type="text"
            inputMode="decimal"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.05"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">期限（月）</label>
          <input
            name="termMonths"
            type="text"
            inputMode="numeric"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="12"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
          <input
            name="startDate"
            type="date"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">还款方式</label>
          <select
            name="paymentMethod"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          >
            <option value="equal_interest">等额本息</option>
            <option value="equal_principal">等额本金</option>
            <option value="bullet">一次性还本付息</option>
            <option value="revolving_credit">循环额度（随借随还）</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '创建中...' : '创建'}
        </button>
        <p className="w-full text-xs text-ledger-muted">
          循环额度账户：本金栏填写授信额度，当前余额填写已用额度；以后用“借入”和“还款”维护双向流水。
        </p>
      </form>

      <div className="md:overflow-x-auto md:rounded-xl md:bg-ledger-surface">
        <table data-liability-manager-list="true" className="block w-full text-sm md:table md:min-w-[980px]">
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-ledger-bg text-left text-ledger-muted">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">本金 / 额度</th>
              <th className="px-4 py-3 font-medium">当前余额</th>
              <th className="px-4 py-3 font-medium">已还 / 可用</th>
              <th className="px-4 py-3 font-medium">年利率</th>
              <th className="px-4 py-3 font-medium">还款方式</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="block space-y-3 md:table-row-group md:space-y-0">
            {liabilities.length === 0 && (
              <tr className="block rounded-xl bg-ledger-surface md:table-row">
                <td colSpan={8} className="block px-4 py-8 text-center text-ledger-muted md:table-cell">
                  暂无负债
                </td>
              </tr>
            )}
            {liabilities.map((liability) => {
              const principalVal = parseFloat(liability.principal) || 0;
              const balanceVal = parseFloat(liability.currentBalance) || 0;
              const isRevolving = isRevolvingCredit(liability.paymentMethod);
              const paidVal = Math.max(0, principalVal - balanceVal);
              const availableVal = Math.max(0, principalVal - balanceVal);
              const isExpanded = expandedRepayId === liability.id;
              const isDrawExpanded = expandedDrawId === liability.id;
              const isHistoryOpen = expandedHistoryId === liability.id;
              const isEditOpen = editingId === liability.id;
              const allHistory = liabilityMovements.get(liability.id) ?? [];
              const history = isHistoryOpen ? allHistory : [];
              const historyCount = allHistory.length;

              return (
                <Fragment key={liability.id}>
                <tr className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-ledger-surface p-4 whitespace-normal md:table-row md:rounded-none md:border-b md:border-ledger-bg md:bg-transparent md:p-0 md:whitespace-nowrap">
                  <td className="col-span-2 p-0 md:table-cell md:px-4 md:py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="flex items-start justify-between gap-3 md:block">
                      <div className="font-semibold md:font-normal">{liability.name}</div>
                      <span className="shrink-0 rounded-full bg-ledger-bg px-2 py-1 text-[11px] text-ledger-muted md:hidden">
                        {paymentMethodLabel[liability.paymentMethod] || liability.paymentMethod}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ledger-muted md:hidden">
                      <span>{liability.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{(liability.interestRate * 100).toFixed(2)}%</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ledger-muted md:table-cell">{liability.category}</td>
                  <td className="p-0 md:table-cell md:px-4 md:py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="mb-1 text-[11px] text-ledger-muted md:hidden">{isRevolving ? '授信额度' : '本金'}</div>
                    <AmountDisplay amount={principalVal} />
                  </td>
                  <td className="p-0 md:table-cell md:px-4 md:py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="mb-1 text-[11px] text-ledger-muted md:hidden">{isRevolving ? '已用额度' : '当前余额'}</div>
                    <AmountDisplay amount={balanceVal} className="font-medium" />
                  </td>
                  <td className="col-span-2 p-0 md:table-cell md:px-4 md:py-3">
                    {(isRevolving || paidVal > 0) ? (
                      <div>
                        <div className="text-[10px] text-ledger-muted">{isRevolving ? '可用' : '已还'}</div>
                        <AmountDisplay amount={isRevolving ? availableVal : paidVal} className="text-green-400 text-xs" />
                        <div className="w-16 h-1.5 bg-ledger-bg rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                            style={{ width: `${principalVal > 0 ? Math.min(((isRevolving ? availableVal : paidVal) / principalVal) * 100, 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-ledger-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-ledger-muted md:table-cell">
                    {(liability.interestRate * 100).toFixed(2)}%
                  </td>
                  <td className="hidden px-4 py-3 text-ledger-muted md:table-cell">
                    {paymentMethodLabel[liability.paymentMethod] || liability.paymentMethod}
                  </td>
                  <td className="col-span-2 p-0 md:table-cell md:px-4 md:py-3">
                    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedRepayId(isExpanded ? null : liability.id);
                          setExpandedDrawId(null);
                          setExpandedHistoryId(null);
                          setRepayForm({
                            amount: '',
                            fromAccountId: '',
                            description: '',
                            occurredAt: new Date().toISOString().split('T')[0],
                          });
                          setMovementMsg('');
                        }}
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm md:min-h-0 md:rounded md:px-2 md:py-1 md:text-xs ${
                          isExpanded
                            ? 'bg-ledger-accent/20 text-ledger-accent'
                            : 'bg-ledger-bg text-ledger-muted hover:text-white'
                        }`}
                      >
                        {isExpanded ? '收起' : '还款'}
                      </button>
                      {isRevolving && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedDrawId(isDrawExpanded ? null : liability.id);
                            setExpandedRepayId(null);
                            setExpandedHistoryId(null);
                            setDrawForm({
                              amount: '',
                              toAccountId: '',
                              description: '',
                              occurredAt: new Date().toISOString().split('T')[0],
                            });
                            setMovementMsg('');
                          }}
                          disabled={availableVal <= 0}
                          className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm disabled:opacity-40 md:min-h-0 md:rounded md:px-2 md:py-1 md:text-xs ${
                            isDrawExpanded
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-ledger-bg text-ledger-muted hover:text-white'
                          }`}
                        >
                          {availableVal <= 0 ? '额度已用完' : isDrawExpanded ? '收起' : '借入'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedHistoryId(isHistoryOpen ? null : liability.id);
                          setExpandedRepayId(null);
                          setExpandedDrawId(null);
                        }}
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm md:min-h-0 md:rounded md:px-2 md:py-1 md:text-xs ${
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
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm md:min-h-0 md:rounded md:px-2 md:py-1 md:text-xs ${
                          isEditOpen
                            ? 'bg-ledger-accent/20 text-ledger-accent'
                            : 'bg-ledger-bg text-ledger-muted hover:text-white'
                        }`}
                      >
                        {isEditOpen ? '取消编辑' : '编辑'}
                      </button>
                      <form action={handleDelete} className="block md:inline">
                        <input type="hidden" name="id" value={liability.id} />
                        <button type="submit" className="min-h-11 w-full rounded-lg px-3 text-sm text-ledger-danger hover:underline md:min-h-0 md:w-auto md:rounded-none md:px-0 md:text-xs">
                          删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>

                {(isEditOpen || isDrawExpanded || isExpanded || isHistoryOpen) && (
                  <tr className="block rounded-xl bg-ledger-surface md:table-row md:rounded-none md:border-b md:border-ledger-bg md:bg-transparent md:last:border-0">
                  <td colSpan={8} className="block p-4 md:table-cell md:px-4 md:pb-4 md:pt-0">

                    {/* Inline Edit Form */}
                    {isEditOpen && (
                      <div
                        id={`liability-editor-${liability.id}`}
                        data-mobile-liability-editor="true"
                        className="scroll-mt-20 rounded-xl border border-ledger-accent/30 bg-ledger-bg p-4 md:mt-3 md:rounded-lg md:p-3"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">编辑负债</div>
                            <div className="mt-0.5 text-xs text-ledger-muted">修改后点击右侧保存</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={loading}
                              className="min-h-11 rounded-lg border border-[var(--border-tertiary)] px-3 text-sm text-[var(--color-text-primary)] disabled:opacity-50"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              data-mobile-liability-save="true"
                              onClick={handleUpdate}
                              disabled={loading}
                              className="min-h-11 rounded-lg bg-ledger-accent px-4 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50"
                            >
                              {loading ? '保存中…' : '保存'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-2">
                          <div className="col-span-2 min-w-0 md:block">
                            <label className="block text-xs text-ledger-muted mb-1">名称</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-24 md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="col-span-2 min-w-0 md:block">
                            <label className="block text-xs text-ledger-muted mb-1">分类</label>
                            <select
                              value={editForm.category}
                              onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-auto md:rounded-md md:px-2 md:py-1.5 md:text-xs"
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
                          <div className="min-w-0">
                            <label className="block text-xs text-ledger-muted mb-1">{isRevolving ? '授信额度' : '本金'}</label>
                            <input
                              type="text" inputMode="decimal"
                              value={editForm.principal}
                              onChange={e => setEditForm(prev => ({ ...prev, principal: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-24 md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs text-ledger-muted mb-1">{isRevolving ? '已用额度' : '余额'}</label>
                            <input
                              type="text" inputMode="decimal"
                              value={editForm.currentBalance}
                              onChange={e => setEditForm(prev => ({ ...prev, currentBalance: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-24 md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs text-ledger-muted mb-1">年利率</label>
                            <input
                              type="text" inputMode="decimal"
                              value={editForm.interestRate}
                              onChange={e => setEditForm(prev => ({ ...prev, interestRate: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-20 md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs text-ledger-muted mb-1">期限(月)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editForm.termMonths}
                              onChange={e => setEditForm(prev => ({ ...prev, termMonths: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-16 md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="col-span-2 min-w-0 md:block">
                            <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={e => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-auto md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            />
                          </div>
                          <div className="col-span-2 min-w-0 md:block">
                            <label className="block text-xs text-ledger-muted mb-1">还款方式</label>
                            <select
                              value={editForm.paymentMethod}
                              onChange={e => setEditForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                              className="min-h-11 w-full rounded-lg border border-ledger-bg bg-ledger-surface px-3 text-sm focus:outline-none focus:border-ledger-accent md:min-h-0 md:w-auto md:rounded-md md:px-2 md:py-1.5 md:text-xs"
                            >
                              <option value="equal_interest">等额本息</option>
                              <option value="equal_principal">等额本金</option>
                              <option value="bullet">一次性还本付息</option>
                              <option value="revolving_credit">循环额度（随借随还）</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={loading}
                            className="hidden rounded-md bg-ledger-accent px-3 py-1.5 text-xs font-medium text-[var(--color-text-inverse)] hover:opacity-90 disabled:opacity-50 md:inline-flex"
                          >
                            {loading ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Revolving Credit Drawdown Form */}
                    {isDrawExpanded && (
                      <div className="mt-3 p-3 bg-ledger-bg rounded-lg border border-amber-500/25">
                        <div className="mb-2 text-xs text-ledger-muted">
                          可用额度 <AmountDisplay amount={availableVal} className="text-green-400 font-medium" />；借入后，负债余额和收款账户会同时增加。
                        </div>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">借入金额</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={drawForm.amount}
                              onChange={e => setDrawForm(prev => ({ ...prev, amount: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-amber-400 w-28"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">日期</label>
                            <input
                              type="date"
                              value={drawForm.occurredAt}
                              onChange={e => setDrawForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">收款账户</label>
                            <select
                              value={drawForm.toAccountId}
                              onChange={e => setDrawForm(prev => ({ ...prev, toAccountId: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                            >
                              <option value="">请选择</option>
                              {drawdownTargets.map((asset) => (
                                <option key={asset.id} value={asset.id}>{asset.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">备注</label>
                            <input
                              type="text"
                              value={drawForm.description}
                              onChange={e => setDrawForm(prev => ({ ...prev, description: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-amber-400"
                              placeholder="借入用途（选填）"
                            />
                          </div>
                          {drawdownTargets.length === 0 && (
                            <div className="w-full text-xs text-ledger-danger">请先创建人民币现金或活期账户，用于接收借款。</div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDraw(liability)}
                            disabled={loading || !drawForm.amount || !drawForm.toAccountId || parseFloat(drawForm.amount) <= 0}
                            className="rounded-md bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-medium hover:bg-amber-400 disabled:opacity-50"
                          >
                            {loading ? '处理中...' : '确认借入'}
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
                              type="text"
                              inputMode="decimal"
                              value={repayForm.amount}
                              onChange={e => setRepayForm(prev => ({ ...prev, amount: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent w-28"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">日期</label>
                            <input
                              type="date"
                              value={repayForm.occurredAt}
                              onChange={e => setRepayForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm focus:outline-none focus:border-ledger-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ledger-muted mb-1">付款账户</label>
                            <select
                              value={repayForm.fromAccountId}
                              onChange={e => setRepayForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm focus:outline-none focus:border-ledger-accent"
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
                              className="rounded-md bg-ledger-surface border border-ledger-bg px-3 py-1.5 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
                              placeholder="还款备注"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRepay(liability.id)}
                            disabled={loading || !repayForm.amount || parseFloat(repayForm.amount) <= 0}
                            className="rounded-md bg-ledger-accent text-[var(--color-text-inverse)] px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
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
                          {isRevolving ? '额度流水' : '还款流水'} · 共 {history.length} 笔
                        </div>
                        {history.length === 0 ? (
                          <div className="text-xs text-ledger-muted py-2">暂无{isRevolving ? '借还' : '还款'}记录</div>
                        ) : (
                          <div className="space-y-1.5">
                            {history.slice(0, 10).map((t: any) => {
                              const isDrawdown = isLiabilityDrawdown(t.type);
                              const linkedAsset = isDrawdown ? t.toAsset : t.fromAsset;
                              return (
                              <div key={t.id}>
                                <div className="rounded-lg bg-ledger-surface/50 p-3 text-xs md:flex md:items-center md:gap-3 md:rounded-md md:px-3 md:py-1.5">
                                  <div className="flex items-center justify-between gap-2 md:contents">
                                    <span className="shrink-0 text-ledger-muted md:w-20">
                                      {new Date(t.occurredAt).toLocaleDateString('zh-CN')}
                                    </span>
                                    <span className={`shrink-0 font-medium md:w-10 ${isDrawdown ? 'text-amber-300' : 'text-green-400'}`}>
                                      {isDrawdown ? '借入' : '还款'}
                                    </span>
                                    <span className={`shrink-0 font-medium md:w-28 ${isDrawdown ? 'text-amber-300' : 'text-green-400'}`}>
                                      {isDrawdown ? '+' : '-'}<AmountDisplay amount={parseFloat(t.amount || '0')} />
                                    </span>
                                  </div>
                                  <div className="mt-2 min-w-0 text-ledger-muted md:mt-0 md:contents">
                                    {linkedAsset ? <span className="block truncate md:shrink-0">{linkedAsset.name}</span> : null}
                                    <span className="mt-1 block truncate md:mt-0 md:flex-1">{t.description || (isDrawdown ? '循环贷借入' : '还款')}</span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex md:shrink-0 md:items-center md:gap-2">
                                    <button
                                      type="button"
                                      onClick={() => editingRepayId === t.id ? setEditingRepayId(null) : startEditRepay(t)}
                                      className="min-h-11 rounded-lg bg-ledger-bg px-3 text-ledger-muted hover:text-white md:min-h-0 md:bg-transparent md:px-0"
                                    >
                                      {editingRepayId === t.id ? '收起编辑' : '编辑'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { if (confirm(`确认删除这笔${isDrawdown ? '借入' : '还款'}？账户余额和负债余额会同步回退。`)) handleDeleteRepay(t.id); }}
                                      className="min-h-11 rounded-lg bg-red-500/10 px-3 text-ledger-danger hover:underline md:min-h-0 md:bg-transparent md:px-0"
                                    >
                                      删除
                                    </button>
                                  </div>
                                </div>
                                {editingRepayId === t.id && (
                                  <div id={`liability-movement-editor-${t.id}`} className="mt-2 scroll-mt-24 rounded-lg border border-ledger-accent/30 bg-ledger-bg p-3 md:mt-1 md:p-2">
                                    <MobileEditorBar
                                      title={`编辑${isDrawdown ? '借入' : '还款'}记录`}
                                      description="保存后同步回算负债与账户余额"
                                      onCancel={() => setEditingRepayId(null)}
                                      onSave={() => void handleUpdateRepay()}
                                      saveDisabled={!editRepayForm.amount.trim()}
                                    />
                                    <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-2">
                                      <div className="min-w-0">
                                        <label className="block text-xs text-ledger-muted mb-1">金额</label>
                                        <input
                                          type="text" inputMode="decimal"
                                          value={editRepayForm.amount}
                                          onChange={e => setEditRepayForm(p => ({ ...p, amount: e.target.value }))}
                                          className={`${mobileEditorControlClass} md:min-h-0 md:w-24 md:rounded-md md:px-2 md:py-1 md:text-xs`}
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <label className="block text-xs text-ledger-muted mb-1">日期</label>
                                        <input
                                          type="date"
                                          value={editRepayForm.occurredAt}
                                          onChange={e => setEditRepayForm(p => ({ ...p, occurredAt: e.target.value }))}
                                          className={`${mobileEditorControlClass} md:min-h-0 md:w-auto md:rounded-md md:px-2 md:py-1 md:text-xs`}
                                        />
                                      </div>
                                      <div className="col-span-2 min-w-0 md:col-span-1">
                                        <label className="block text-xs text-ledger-muted mb-1">备注</label>
                                        <input
                                          type="text"
                                          value={editRepayForm.description}
                                          onChange={e => setEditRepayForm(p => ({ ...p, description: e.target.value }))}
                                          className={`${mobileEditorControlClass} md:min-h-0 md:w-auto md:rounded-md md:px-2 md:py-1 md:text-xs`}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={handleUpdateRepay}
                                        className="hidden rounded-md bg-ledger-accent px-2 py-1 text-xs font-medium text-[var(--color-text-inverse)] hover:opacity-90 md:block"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              );
                            })}
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
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
