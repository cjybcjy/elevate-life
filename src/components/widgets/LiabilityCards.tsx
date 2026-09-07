'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { AmountDisplay } from '../common/AmountDisplay';
import { getDebtChartColor, PAID_PROGRESS_COLOR } from '@/lib/debt-colors';
import { createTransaction } from '@/lib/actions/ledger';
import {
  getDrawdownTargetOptions,
  getRepaymentAssetBalance,
  getRepaymentSourceOptions,
  getRepaymentSuggestions,
  type RepaymentAsset,
} from '@/lib/liability-repayment';
import {
  LIABILITY_DRAWDOWN_TRANSACTION_TYPE,
  isLiabilityDrawdown,
  isRevolvingCredit,
} from '@/lib/liability-transactions';

interface Liability {
  id: string;
  name: string;
  interestRate: number;
  currentBalance: string;
  principal: string;
  termMonths: number;
  startDate: string | Date;
  paymentMethod?: string | null;
  monthlyPayment?: string | null;
}

type Asset = RepaymentAsset;

interface Transaction {
  id: string;
  liabilityId?: string | null;
  type: string;
  amount: string;
  occurredAt: string | Date;
  description?: string | null;
}

const RATE_COLORS = { high: '#ef4444', mid: '#f59e0b', low: '#3b82f6' };

function formatCny(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export default function LiabilityCards({
  liabilities,
  transactions = [],
  assets = [],
}: {
  liabilities: Liability[];
  transactions?: Transaction[];
  assets?: Asset[];
}) {
  const { mutate } = useSWRConfig();
  const [repaymentLiabilityId, setRepaymentLiabilityId] = useState<string | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [repaymentError, setRepaymentError] = useState('');
  const [repaymentSuccess, setRepaymentSuccess] = useState('');
  const [isSubmittingRepayment, setIsSubmittingRepayment] = useState(false);
  const [drawdownLiabilityId, setDrawdownLiabilityId] = useState<string | null>(null);
  const [drawdownAmount, setDrawdownAmount] = useState('');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [drawdownError, setDrawdownError] = useState('');
  const [isSubmittingDrawdown, setIsSubmittingDrawdown] = useState(false);

  useEffect(() => {
    if (!repaymentLiabilityId) return;
    document.getElementById(`liability-repayment-${repaymentLiabilityId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [repaymentLiabilityId]);

  useEffect(() => {
    if (!drawdownLiabilityId) return;
    document.getElementById(`liability-drawdown-${drawdownLiabilityId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [drawdownLiabilityId]);

  if (liabilities.length === 0) return <div className="text-ledger-muted text-sm py-4 text-center">暂无负债</div>;

  function closeRepayment() {
    if (isSubmittingRepayment) return;
    setRepaymentLiabilityId(null);
    setRepaymentAmount('');
    setSourceAssetId('');
    setRepaymentError('');
  }

  function openRepayment(liability: Liability) {
    if (repaymentLiabilityId === liability.id) {
      closeRepayment();
      return;
    }
    setDrawdownLiabilityId(null);
    setDrawdownAmount('');
    setTargetAssetId('');
    setDrawdownError('');
    setRepaymentLiabilityId(liability.id);
    setRepaymentAmount('');
    setSourceAssetId('');
    setRepaymentError('');
    setRepaymentSuccess('');
  }

  function closeDrawdown() {
    if (isSubmittingDrawdown) return;
    setDrawdownLiabilityId(null);
    setDrawdownAmount('');
    setTargetAssetId('');
    setDrawdownError('');
  }

  function openDrawdown(liability: Liability) {
    if (drawdownLiabilityId === liability.id) {
      closeDrawdown();
      return;
    }
    setRepaymentLiabilityId(null);
    setRepaymentAmount('');
    setSourceAssetId('');
    setRepaymentError('');
    setDrawdownLiabilityId(liability.id);
    setDrawdownAmount('');
    setTargetAssetId('');
    setDrawdownError('');
    setRepaymentSuccess('');
  }

  async function handleRepayment(event: FormEvent<HTMLFormElement>, liability: Liability) {
    event.preventDefault();
    if (isSubmittingRepayment) return;

    const amount = Number(repaymentAmount.trim());
    const balance = Number.parseFloat(liability.currentBalance) || 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      setRepaymentError('请选择或输入还款金额');
      return;
    }
    if (amount > balance) {
      setRepaymentError('还款金额不能超过剩余负债');
      return;
    }

    setRepaymentError('');
    setIsSubmittingRepayment(true);
    const result = await createTransaction({
      type: 'EXPENSE',
      amount: String(amount),
      currency: 'CNY',
      fromAccountId: sourceAssetId || undefined,
      liabilityId: liability.id,
      description: `偿还负债 · ${liability.name}`,
      occurredAt: new Date().toISOString(),
    });

    if (!result.success) {
      setRepaymentError(result.error || '还款失败，请稍后重试');
      setIsSubmittingRepayment(false);
      return;
    }

    const sourceName = assets.find((asset) => asset.id === sourceAssetId)?.name;
    await Promise.allSettled([
      mutate('liabilities'),
      mutate('assets'),
      mutate((key) => typeof key === 'string' && key.startsWith('transactions')),
    ]);
    setRepaymentLiabilityId(null);
    setRepaymentAmount('');
    setSourceAssetId('');
    setRepaymentSuccess(sourceName
      ? `已从 ${sourceName} 还款 ${formatCny(amount)}，负债余额和流水已更新`
      : `已记录还款 ${formatCny(amount)}，未扣减资金账户，负债余额和流水已更新`);
    setIsSubmittingRepayment(false);
  }

  async function handleDrawdown(event: FormEvent<HTMLFormElement>, liability: Liability) {
    event.preventDefault();
    if (isSubmittingDrawdown) return;

    const amount = Number(drawdownAmount.trim());
    const balance = Number.parseFloat(liability.currentBalance) || 0;
    const creditLimit = Number.parseFloat(liability.principal) || 0;
    const available = Math.max(0, creditLimit - balance);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDrawdownError('请输入借入金额');
      return;
    }
    if (amount > available) {
      setDrawdownError(`本次最多还能借入 ${formatCny(available)}`);
      return;
    }
    if (!targetAssetId) {
      setDrawdownError('请选择收款账户');
      return;
    }

    setDrawdownError('');
    setIsSubmittingDrawdown(true);
    const result = await createTransaction({
      type: LIABILITY_DRAWDOWN_TRANSACTION_TYPE,
      amount: String(amount),
      currency: 'CNY',
      toAccountId: targetAssetId,
      liabilityId: liability.id,
      description: `循环贷借入 · ${liability.name}`,
      occurredAt: new Date().toISOString(),
    });

    if (!result.success) {
      setDrawdownError(result.error || '借入失败，请稍后重试');
      setIsSubmittingDrawdown(false);
      return;
    }

    const targetName = assets.find((asset) => asset.id === targetAssetId)?.name;
    await Promise.allSettled([
      mutate('liabilities'),
      mutate('assets'),
      mutate((key) => typeof key === 'string' && key.startsWith('transactions')),
    ]);
    setDrawdownLiabilityId(null);
    setDrawdownAmount('');
    setTargetAssetId('');
    setRepaymentSuccess(`已借入 ${formatCny(amount)}${targetName ? ` 至 ${targetName}` : ''}，负债余额和额度流水已更新`);
    setIsSubmittingDrawdown(false);
  }

  const sortedLiabilities = [...liabilities]
    .sort((a, b) => (parseFloat(b.currentBalance) || 0) - (parseFloat(a.currentBalance) || 0));
  const hasRevolvingLiability = liabilities.some((liability) => isRevolvingCredit(liability.paymentMethod));

  return (
    <div
      data-liability-list="true"
      className="space-y-2"
      style={{ width: '100%', display: 'grid', justifyItems: 'stretch' }}
    >
      {repaymentSuccess && (
        <div
          role="status"
          style={{ width: '100%', padding: '9px 11px', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', background: 'var(--color-success-bg)', fontSize: 12, lineHeight: 1.5 }}
        >
          ✓ {repaymentSuccess}
        </div>
      )}
      {!hasRevolvingLiability && (
        <div
          data-revolving-credit-setup="true"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
        >
          <span>
            有循环贷？先把对应负债的还款方式设为“循环额度（随借随还）”，保存后这里会出现“借一笔”。
          </span>
          <Link
            href="/management/liabilities"
            className="shrink-0 font-medium text-[var(--color-warning)] underline underline-offset-2 hover:opacity-80"
          >
            去负债管理设置
          </Link>
        </div>
      )}
      {sortedLiabilities.map((l, i) => {
          const balance = parseFloat(l.currentBalance) || 0;
          const principal = parseFloat(l.principal) || 1;
          const revolving = isRevolvingCredit(l.paymentMethod);
          const paid = Math.max(0, principal - balance);
          const available = Math.max(0, principal - balance);
          const start = new Date(l.startDate);
          const now = new Date();
          const remaining = Math.max(0, l.termMonths - ((now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())));
          const paidPercent = Math.max(0, Math.min((paid / principal * 100), 100));
          const remainingPercent = Math.max(0, 100 - paidPercent);
          const movements = transactions.filter(
            (t: Transaction) => t.liabilityId === l.id && (t.type === 'EXPENSE' || isLiabilityDrawdown(t.type))
          );
          const isRepaymentOpen = repaymentLiabilityId === l.id;
          const isDrawdownOpen = drawdownLiabilityId === l.id;

          return (
            <CollapsibleLiabilityCard
              key={l.id}
              liabilityId={l.id}
              name={l.name}
              interestRate={l.interestRate}
              balance={balance}
              principal={principal}
              paid={paid}
              available={available}
              isRevolving={revolving}
              remaining={remaining}
              paidPercent={paidPercent}
              remainingPercent={remainingPercent}
              startDate={start}
              termMonths={l.termMonths}
              movements={movements}
              paymentMethod={l.paymentMethod}
              dotColor={getDebtChartColor(i)}
              rateColor={l.interestRate > 0.06 ? RATE_COLORS.high : l.interestRate > 0.05 ? RATE_COLORS.mid : RATE_COLORS.low}
              isRepaymentOpen={isRepaymentOpen}
              onToggleRepayment={() => openRepayment(l)}
              isDrawdownOpen={isDrawdownOpen}
              onToggleDrawdown={() => openDrawdown(l)}
              repaymentForm={isRepaymentOpen ? (
                <LiabilityRepaymentForm
                  liability={l}
                  assets={assets}
                  amount={repaymentAmount}
                  sourceAssetId={sourceAssetId}
                  error={repaymentError}
                  isSubmitting={isSubmittingRepayment}
                  onAmountChange={setRepaymentAmount}
                  onSourceChange={setSourceAssetId}
                  onSubmit={(event) => handleRepayment(event, l)}
                  onCancel={closeRepayment}
                />
              ) : null}
              drawdownForm={isDrawdownOpen ? (
                <LiabilityDrawdownForm
                  liability={l}
                  assets={assets}
                  amount={drawdownAmount}
                  targetAssetId={targetAssetId}
                  error={drawdownError}
                  isSubmitting={isSubmittingDrawdown}
                  onAmountChange={setDrawdownAmount}
                  onTargetChange={setTargetAssetId}
                  onSubmit={(event) => handleDrawdown(event, l)}
                  onCancel={closeDrawdown}
                />
              ) : null}
            />
          );
        })}
    </div>
  );
}

function LiabilityRepaymentForm({
  liability,
  assets,
  amount,
  sourceAssetId,
  error,
  isSubmitting,
  onAmountChange,
  onSourceChange,
  onSubmit,
  onCancel,
}: {
  liability: Liability;
  assets: Asset[];
  amount: string;
  sourceAssetId: string;
  error: string;
  isSubmitting: boolean;
  onAmountChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const balance = Number.parseFloat(liability.currentBalance) || 0;
  const suggestions = getRepaymentSuggestions({
    balance,
    monthlyPayment: liability.monthlyPayment,
  });
  const sourceOptions = getRepaymentSourceOptions(assets);

  return (
    <form
      id={`liability-repayment-${liability.id}`}
      onSubmit={onSubmit}
      style={{ marginTop: 10, padding: 12, border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', background: 'var(--color-container)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            偿还 {liability.name}
          </div>
          <div className="mt-0.5 text-xs text-ledger-muted">当前剩余 {formatCny(balance)}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSubmitting}>取消</button>
      </div>

      {suggestions.length > 0 && (
        <div aria-label="常用还款金额" className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.amount}
              type="button"
              className={Number(amount) === suggestion.amount ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => onAmountChange(String(suggestion.amount))}
              disabled={isSubmitting}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
        <label>
          <span className="form-label">本次还款</span>
          <input
            className="form-input"
            name="liabilityRepaymentAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="输入金额"
            aria-label={`偿还${liability.name}的金额`}
            disabled={isSubmitting}
          />
        </label>
        <label>
          <span className="form-label">从这里扣款（选填）</span>
          <select
            className="form-select"
            value={sourceAssetId}
            onChange={(event) => onSourceChange(event.target.value)}
            aria-label={`偿还${liability.name}的扣款账户（选填）`}
            disabled={isSubmitting}
          >
            <option value="">不填（不扣减资金账户）</option>
            {sourceOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} · 可用 {formatCny(getRepaymentAssetBalance(asset))}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div role="alert" className="mt-2 text-xs text-ledger-danger">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary mt-2.5 w-full justify-center"
        disabled={isSubmitting || !amount.trim()}
      >
        {isSubmitting ? '正在还款…' : '确认还款'}
      </button>
    </form>
  );
}

function LiabilityDrawdownForm({
  liability,
  assets,
  amount,
  targetAssetId,
  error,
  isSubmitting,
  onAmountChange,
  onTargetChange,
  onSubmit,
  onCancel,
}: {
  liability: Liability;
  assets: Asset[];
  amount: string;
  targetAssetId: string;
  error: string;
  isSubmitting: boolean;
  onAmountChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const balance = Number.parseFloat(liability.currentBalance) || 0;
  const creditLimit = Number.parseFloat(liability.principal) || 0;
  const available = Math.max(0, creditLimit - balance);
  const targetOptions = getDrawdownTargetOptions(assets);
  const suggestions = [500, 1000, 3000].filter((value) => value <= available);

  return (
    <form
      id={`liability-drawdown-${liability.id}`}
      onSubmit={onSubmit}
      style={{ marginTop: 10, padding: 12, border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 'var(--radius-md)', background: 'var(--color-container)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            从 {liability.name} 借入
          </div>
          <div className="mt-0.5 text-xs text-ledger-muted">
            授信 {formatCny(creditLimit)} · 已用 {formatCny(balance)} · 可用 {formatCny(available)}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSubmitting}>取消</button>
      </div>

      {suggestions.length > 0 && (
        <div aria-label="常用借入金额" className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={Number(amount) === suggestion ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => onAmountChange(String(suggestion))}
              disabled={isSubmitting}
            >
              ¥{suggestion.toLocaleString('zh-CN')}
            </button>
          ))}
          <button
            type="button"
            className={Number(amount) === available ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => onAmountChange(String(available))}
            disabled={isSubmitting || available <= 0}
          >
            全部可用
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
        <label>
          <span className="form-label">本次借入</span>
          <input
            className="form-input"
            name="liabilityDrawdownAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="输入金额"
            aria-label={`从${liability.name}借入的金额`}
            disabled={isSubmitting}
          />
        </label>
        <label>
          <span className="form-label">转入账户</span>
          <select
            className="form-select"
            value={targetAssetId}
            onChange={(event) => onTargetChange(event.target.value)}
            aria-label={`从${liability.name}借入的收款账户`}
            disabled={isSubmitting}
          >
            <option value="">请选择收款账户</option>
            {targetOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} · 当前 {formatCny(getRepaymentAssetBalance(asset))}
              </option>
            ))}
          </select>
        </label>
      </div>

      {targetOptions.length === 0 && (
        <div role="alert" className="mt-2 text-xs text-ledger-danger">请先创建一个人民币现金或活期账户，用于接收借款。</div>
      )}
      {error && <div role="alert" className="mt-2 text-xs text-ledger-danger">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary mt-2.5 w-full justify-center"
        disabled={isSubmitting || !amount.trim() || !targetAssetId}
      >
        {isSubmitting ? '正在借入…' : '确认借入'}
      </button>
    </form>
  );
}

function CollapsibleLiabilityCard({
  liabilityId,
  name,
  interestRate,
  balance,
  principal,
  paid,
  available,
  isRevolving,
  remaining,
  paidPercent,
  remainingPercent,
  startDate,
  termMonths,
  movements,
  paymentMethod,
  dotColor,
  rateColor,
  isRepaymentOpen,
  onToggleRepayment,
  isDrawdownOpen,
  onToggleDrawdown,
  repaymentForm,
  drawdownForm,
}: {
  liabilityId: string;
  name: string;
  interestRate: number;
  balance: number;
  principal: number;
  paid: number;
  available: number;
  isRevolving: boolean;
  remaining: number;
  paidPercent: number;
  remainingPercent: number;
  startDate: Date;
  termMonths: number;
  movements: Transaction[];
  paymentMethod?: string | null;
  dotColor: string;
  rateColor: string;
  isRepaymentOpen: boolean;
  onToggleRepayment: () => void;
  isDrawdownOpen: boolean;
  onToggleDrawdown: () => void;
  repaymentForm: ReactNode;
  drawdownForm: ReactNode;
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div
      data-liability-card="true"
      data-liability-id={liabilityId}
      data-liability-balance={balance}
      className="bg-ledger-bg/50 rounded-lg p-2.5"
      style={{ width: '100%', maxWidth: '100%' }}
    >
      {/* Row 1: colored dot + name + start date + rate + remaining */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 2, flexShrink: 0,
            background: dotColor,
          }} />
          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
          <span className="text-xs text-ledger-muted/60 shrink-0">
            {startDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })}
          </span>
          <span className="text-xs font-medium shrink-0" style={{ color: rateColor }}>
            {(interestRate * 100).toFixed(1)}%
          </span>
        </div>
        <span className="text-xs text-ledger-muted shrink-0">{remaining}期剩余</span>
      </div>

      {/* Row 2: progress bar */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div
          role="img"
          aria-label={isRevolving
            ? `${name}额度使用：已用 ${remainingPercent.toFixed(0)}%，可用 ${paidPercent.toFixed(0)}%`
            : `${name}还款进度：已还 ${paidPercent.toFixed(0)}%，剩余 ${remainingPercent.toFixed(0)}%`}
          className="h-2 bg-ledger-bg rounded-full overflow-hidden"
          style={{ flex: '0 1 260px', width: 'min(260px, 100%)', maxWidth: '100%' }}
        >
          <div className="flex h-full">
            {isRevolving ? (
              <>
                <div
                  data-progress-part="used"
                  className="h-full rounded-l-full"
                  style={{ width: `${remainingPercent}%`, background: dotColor }}
                />
                {paidPercent > 0 && (
                  <div
                    data-progress-part="available"
                    className="h-full rounded-r-full"
                    style={{ width: `${paidPercent}%`, background: PAID_PROGRESS_COLOR }}
                  />
                )}
              </>
            ) : (
              <>
                <div
                  data-progress-part="paid"
                  className="h-full rounded-l-full"
                  style={{ width: `${paidPercent}%`, background: PAID_PROGRESS_COLOR }}
                />
                {remainingPercent > 0 && (
                  <div
                    data-progress-part="remaining"
                    className="h-full rounded-r-full"
                    style={{ width: `${remainingPercent}%`, background: dotColor }}
                  />
                )}
              </>
            )}
          </div>
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: dotColor }}>
          {isRevolving ? `已用 ${remainingPercent.toFixed(0)}%` : `剩余 ${remainingPercent.toFixed(0)}%`}
        </span>
        <span className="text-xs text-ledger-muted shrink-0">
          {isRevolving ? `可用 ${paidPercent.toFixed(0)}%` : `已还 ${paidPercent.toFixed(0)}%`}
        </span>
      </div>

      {/* Row 3: amount details + toggle history */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-ledger-muted">
          {isRevolving ? '已用' : '余额'} <AmountDisplay amount={balance} className="font-medium" />
        </span>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="text-ledger-muted hover:text-white transition-colors flex flex-col items-start leading-tight"
        >
          <span className="inline-flex items-center gap-0.5">
            <span>{showHistory ? '▾' : '▸'}</span>
            <span>{isRevolving ? '借还流水' : '已还'}</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            {isRevolving ? (
              <span className="text-ledger-muted/80">{movements.length} 笔</span>
            ) : (
              <AmountDisplay amount={paid} className="text-green-400" />
            )}
            {!isRevolving && movements.length > 0 && (
              <span className="text-ledger-muted/60">({movements.length}笔)</span>
            )}
          </span>
        </button>
        <span className="text-ledger-muted">
          {isRevolving ? '额度' : '本金'} <AmountDisplay amount={principal} />
        </span>
        {isRevolving && (
          <span className="text-ledger-muted">
            可用 <AmountDisplay amount={available} className="text-green-400" />
          </span>
        )}
        {paymentMethod === 'bullet' && (
          <span className="text-ledger-muted">
            到期应还{' '}
            <AmountDisplay
              amount={principal * (1 + interestRate * termMonths / 12)}
              className="font-medium"
            />
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {isRevolving && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-expanded={isDrawdownOpen}
              aria-controls={`liability-drawdown-${liabilityId}`}
              onClick={onToggleDrawdown}
              disabled={available <= 0}
            >
              {available <= 0 ? '额度已用完' : isDrawdownOpen ? '收起' : '+ 借一笔'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            aria-expanded={isRepaymentOpen}
            aria-controls={`liability-repayment-${liabilityId}`}
            onClick={onToggleRepayment}
            disabled={balance <= 0}
          >
            {balance <= 0 ? (isRevolving ? '暂无待还' : '已结清') : isRepaymentOpen ? '收起' : '+ 还一笔'}
          </button>
        </div>
      </div>

      {drawdownForm}
      {repaymentForm}

      {/* Collapsible repayment history */}
      {showHistory && (
        <div className="mt-2 pt-2 border-t border-ledger-bg/60">
          {movements.length === 0 ? (
            <div className="text-xs text-ledger-muted/50 py-1">暂无{isRevolving ? '借还' : '还款'}记录</div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...movements].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 8).map((t) => {
                const drawdown = isLiabilityDrawdown(t.type);
                return (
                <div key={t.id} className="flex items-center gap-2 text-xs text-ledger-muted">
                  <span className="w-16 shrink-0">
                    {new Date(t.occurredAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={`w-8 shrink-0 font-medium ${drawdown ? 'text-amber-400' : 'text-green-400'}`}>
                    {drawdown ? '借入' : '还款'}
                  </span>
                  <span className={`shrink-0 ${drawdown ? 'text-amber-400' : 'text-green-400'}`}>
                    {drawdown ? '+' : '-'}<AmountDisplay amount={parseFloat(t.amount || '0')} />
                  </span>
                  <span className="truncate">{t.description || (drawdown ? '循环贷借入' : '还款')}</span>
                </div>
                );
              })}
              {movements.length > 8 && (
                <div className="text-xs text-ledger-muted/50">...还有 {movements.length - 8} 笔</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
