'use client';

import { type FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSWRConfig } from 'swr';
import { addGoalSavings } from '@/lib/actions/goals';
import {
  getGoalDepositBalance,
  getGoalDepositSourceOptions,
  isGoalDepositAccountCategory,
  type GoalDepositAsset,
} from '@/lib/goal-deposit';

interface Goal {
  id: string;
  name: string;
  targetAmount: { toString: () => string } | number;
  currentAmount: { toString: () => string } | number;
  assetId?: string | null;
  deadline?: Date | string | null;
  icon?: string | null;
  color?: string | null;
  asset?: {
    id: string;
    name: string;
    category?: string | null;
    currency?: string | null;
  } | null;
}

interface Asset extends GoalDepositAsset {
  category?: string | null;
  balance?: string | number | null;
  currency?: string | null;
}

interface GoalViewModel extends Goal {
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  deadlineDate: Date | null;
  monthlyRequired: number | null;
  scheduledMonthly: number;
  estimatedCompletion: Date | null;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  displayColor: string;
}

function safeNumber(value: Goal['targetAmount']) {
  const parsed = typeof value === 'number' ? value : Number(value?.toString?.());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value?: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function monthsUntil(from: Date, to: Date) {
  const rawMonths = (to.getFullYear() - from.getFullYear()) * 12
    + to.getMonth() - from.getMonth()
    + (to.getDate() - from.getDate()) / 31;
  return Math.max(rawMonths, 0);
}

function addMonths(from: Date, months: number) {
  const result = new Date(from);
  result.setMonth(result.getMonth() + Math.max(0, Math.ceil(months)));
  return result;
}

function formatCny(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function formatYearMonth(value: Date) {
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}

function getStatusStyle(tone: GoalViewModel['statusTone']) {
  if (tone === 'success') return { color: 'var(--color-success)', background: 'var(--color-success-bg)' };
  if (tone === 'warning') return { color: 'var(--color-warning)', background: 'var(--color-warning-bg)' };
  if (tone === 'danger') return { color: 'var(--color-danger)', background: 'var(--color-danger-bg)' };
  return { color: 'var(--color-text-secondary)', background: 'var(--color-container-inset)' };
}

function buildGoalViewModel(
  goal: Goal,
  scheduledMonthly: number,
  now: Date,
  index: number,
): GoalViewModel {
  const current = Math.max(0, safeNumber(goal.currentAmount));
  const target = Math.max(0, safeNumber(goal.targetAmount));
  const remaining = Math.max(0, target - current);
  const progressPercent = target > 0 ? Math.min(100, current / target * 100) : 0;
  const deadlineDate = parseDate(goal.deadline);
  const remainingMonths = deadlineDate ? monthsUntil(now, deadlineDate) : 0;
  const monthlyRequired = deadlineDate && remaining > 0 && remainingMonths > 0
    ? remaining / Math.max(1, remainingMonths)
    : null;
  const safeScheduledMonthly = Math.max(0, scheduledMonthly);
  const estimatedCompletion = remaining > 0 && safeScheduledMonthly > 0
    ? addMonths(now, remaining / safeScheduledMonthly)
    : remaining === 0 ? now : null;

  let statusLabel = '待安排供款';
  let statusTone: GoalViewModel['statusTone'] = 'warning';

  if (remaining === 0 && target > 0) {
    statusLabel = '已达成';
    statusTone = 'success';
  } else if (deadlineDate && deadlineDate < now) {
    statusLabel = '已逾期';
    statusTone = 'danger';
  } else if (!deadlineDate) {
    statusLabel = safeScheduledMonthly > 0 ? '持续积累' : '待设置期限';
    statusTone = safeScheduledMonthly > 0 ? 'success' : 'neutral';
  } else if (monthlyRequired !== null && safeScheduledMonthly >= monthlyRequired) {
    statusLabel = '按计划';
    statusTone = 'success';
  } else if (estimatedCompletion && deadlineDate) {
    const delayMonths = Math.max(1, Math.ceil(monthsUntil(deadlineDate, estimatedCompletion)));
    statusLabel = `落后${delayMonths}个月`;
    statusTone = 'warning';
  }

  const fallbackColors = ['#2563eb', '#7c3aed', '#d97706', '#16a34a', '#dc2626'];
  const displayColor = goal.color && /^#[\da-f]{6}$/i.test(goal.color)
    ? goal.color
    : fallbackColors[index % fallbackColors.length];

  return {
    ...goal,
    current,
    target,
    remaining,
    progressPercent,
    deadlineDate,
    monthlyRequired,
    scheduledMonthly: safeScheduledMonthly,
    estimatedCompletion,
    statusLabel,
    statusTone,
    displayColor,
  };
}

function GoalDepositForm({
  goal,
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
  goal: GoalViewModel;
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
  const panelId = `goal-deposit-${goal.id}`;
  const targetCurrency = goal.asset?.currency || 'CNY';
  const sources = getGoalDepositSourceOptions(assets, goal.assetId, targetCurrency);
  const quickAmounts: { amount: number; label: string }[] = [500, 1000, 3000]
    .map((suggestion) => ({ amount: suggestion, label: `+${formatCny(suggestion)}` }));
  const roundedRemaining = Math.round(goal.remaining * 100) / 100;
  if (
    roundedRemaining > 0
    && roundedRemaining <= 10_000
    && !quickAmounts.some((suggestion) => suggestion.amount === roundedRemaining)
  ) {
    quickAmounts.push({ amount: roundedRemaining, label: `补足 ${formatCny(roundedRemaining)}` });
  }

  if (!goal.assetId || !goal.asset) {
    return (
      <div id={panelId} style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--color-container)' }}>
        <div style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700 }}>先关联目标账户</div>
        <div style={{ marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
          关联后，每次存入都会自动形成转账流水，并更新账户余额和目标进度。
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Link href="/management/goals" className="btn btn-primary btn-sm">去关联账户</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
        </div>
      </div>
    );
  }

  if (!isGoalDepositAccountCategory(goal.asset.category)) {
    return (
      <div id={panelId} style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--color-container)' }}>
        <div style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700 }}>目标账户需要调整</div>
        <div style={{ marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
          直接存入仅支持现金或银行活期账户，避免误改房产、股票等资产价值。
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Link href="/management/goals" className="btn btn-primary btn-sm">更换关联账户</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <form
      id={panelId}
      onSubmit={onSubmit}
      style={{ marginTop: 14, padding: 14, border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', background: 'var(--color-container)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700 }}>存入 {goal.name}</div>
          <div style={{ marginTop: 3, color: 'var(--color-text-secondary)', fontSize: 12 }}>
            自动转入目标账户 · {goal.asset.name}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSubmitting}>取消</button>
      </div>

      {quickAmounts.length > 0 && (
        <div aria-label="常用存入金额" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {quickAmounts.map((suggestion) => (
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 12 }}>
        <label>
          <span className="form-label">本次存入</span>
          <input
            className="form-input"
            name="goalDepositAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="输入金额"
            aria-label={`存入${goal.name}的金额`}
            disabled={isSubmitting}
          />
        </label>

        <label>
          <span className="form-label">从这里转出（选填）</span>
          <select
            className="form-select"
            value={sourceAssetId}
            onChange={(event) => onSourceChange(event.target.value)}
            aria-label={`存入${goal.name}的转出账户（选填）`}
            disabled={isSubmitting}
          >
            <option value="">不填（不扣减其他账户）</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} · 可用 {formatCny(getGoalDepositBalance(source))}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 10, color: 'var(--color-danger)', fontSize: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
        disabled={isSubmitting || !amount.trim()}
      >
        {isSubmitting ? '正在存入…' : '确认存入'}
      </button>
    </form>
  );
}

export default function GoalTracker({
  goals,
  assets = [],
  monthlyContributionByGoal = {},
}: {
  goals: Goal[];
  assets?: Asset[];
  monthlyContributionByGoal?: Record<string, number>;
}) {
  const { mutate } = useSWRConfig();
  const [now] = useState(() => new Date());
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositSuccess, setDepositSuccess] = useState('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const viewModels = goals
    .map((goal, index) => buildGoalViewModel(goal, monthlyContributionByGoal[goal.id] ?? 0, now, index))
    .sort((a, b) => {
      const aComplete = a.remaining === 0 ? 1 : 0;
      const bComplete = b.remaining === 0 ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;

      const aDeadline = a.deadlineDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDeadline = b.deadlineDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return aDeadline - bDeadline;
    });
  const primaryGoal = viewModels[0];
  const otherGoals = viewModels.slice(1);

  useEffect(() => {
    if (!depositGoalId) return;
    const panel = document.getElementById(`goal-deposit-${depositGoalId}`);
    panel?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [depositGoalId]);

  function closeDeposit() {
    if (isSubmittingDeposit) return;
    setDepositGoalId(null);
    setDepositAmount('');
    setSourceAssetId('');
    setDepositError('');
  }

  function openDeposit(goal: GoalViewModel) {
    if (depositGoalId === goal.id) {
      closeDeposit();
      return;
    }

    setDepositGoalId(goal.id);
    setDepositAmount('');
    setSourceAssetId('');
    setDepositError('');
    setDepositSuccess('');
  }

  async function handleDeposit(event: FormEvent<HTMLFormElement>, goal: GoalViewModel) {
    event.preventDefault();
    if (isSubmittingDeposit) return;

    setDepositError('');
    setIsSubmittingDeposit(true);
    const result = await addGoalSavings({
      goalId: goal.id,
      sourceAssetId,
      amount: depositAmount,
    });

    if (!result.success) {
      setDepositError(result.error || '存入失败，请稍后重试');
      setIsSubmittingDeposit(false);
      return;
    }

    const sourceName = assets.find((asset) => asset.id === sourceAssetId)?.name;
    const depositedAmount = Number.parseFloat(depositAmount);
    await Promise.allSettled([
      mutate('goals'),
      mutate('assets'),
      mutate((key) => typeof key === 'string' && key.startsWith('transactions')),
    ]);
    setDepositGoalId(null);
    setDepositAmount('');
    setSourceAssetId('');
    setDepositSuccess(sourceName
      ? `已从 ${sourceName} 存入 ${formatCny(depositedAmount)}，目标进度和流水已更新`
      : `已存入 ${formatCny(depositedAmount)}，未扣减其他账户，目标进度和流水已更新`);
    setIsSubmittingDeposit(false);
  }

  return (
    <div className="card" aria-label="储蓄目标">
      <div className="card-header" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div>储蓄目标</div>
          <div style={{ marginTop: 3, color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 400 }}>
            长期 · 安全之后，钱正在流向什么目标
          </div>
        </div>
        <Link href="/management/goals" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
          {goals.length === 0 ? '创建目标' : '查看全部目标'}
        </Link>
      </div>

      <div className="card-body">
        {depositSuccess && (
          <div
            role="status"
            style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', background: 'var(--color-success-bg)', fontSize: 12, lineHeight: 1.5 }}
          >
            ✓ {depositSuccess}
          </div>
        )}
        {!primaryGoal ? (
          <div
            style={{
              border: '1px dashed var(--border-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '28px 16px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
          >
            还没有储蓄目标。可以先建立家庭应急金，再规划教育、旅行等长期目标。
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <section
              aria-label={`优先目标：${primaryGoal.name}`}
              data-goal-id={primaryGoal.id}
              data-goal-current={primaryGoal.current}
              data-goal-target={primaryGoal.target}
              style={{
                border: '1px solid var(--border-tertiary)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                background: 'var(--color-container-inset)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                    优先目标
                  </div>
                  <h3 style={{ margin: '5px 0 0', color: 'var(--color-text-primary)', fontSize: 18, lineHeight: 1.3 }}>
                    {primaryGoal.icon ? `${primaryGoal.icon} ` : ''}{primaryGoal.name}
                  </h3>
                  {primaryGoal.asset?.name && (
                    <div style={{ marginTop: 4, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      目标账户 · {primaryGoal.asset.name}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    ...getStatusStyle(primaryGoal.statusTone),
                    flexShrink: 0,
                    borderRadius: 999,
                    padding: '5px 9px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {primaryGoal.statusLabel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 18 }}>
                <div style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
                  已存 <strong>{formatCny(primaryGoal.current)}</strong>
                  <span style={{ color: 'var(--color-text-secondary)' }}> / 目标 {formatCny(primaryGoal.target)}</span>
                </div>
                <strong style={{ color: primaryGoal.displayColor, fontSize: 24, lineHeight: 1 }}>
                  {primaryGoal.progressPercent.toFixed(0)}%
                </strong>
              </div>
              <div
                role="progressbar"
                aria-label={`${primaryGoal.name}进度`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(primaryGoal.progressPercent)}
                style={{ height: 10, marginTop: 10, overflow: 'hidden', borderRadius: 999, background: 'var(--color-gray-200)' }}
              >
                <div
                  style={{
                    width: `${primaryGoal.progressPercent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: primaryGoal.displayColor,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-container)' }}>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>每月需存</div>
                  <div style={{ marginTop: 3, color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 700 }}>
                    {primaryGoal.monthlyRequired === null ? '待设置' : formatCny(primaryGoal.monthlyRequired)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-container)' }}>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>已安排每月供款</div>
                  <div style={{ marginTop: 3, color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 700 }}>
                    {primaryGoal.scheduledMonthly > 0 ? formatCny(primaryGoal.scheduledMonthly) : '尚未安排'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                {primaryGoal.estimatedCompletion && primaryGoal.remaining > 0
                  ? `按当前供款安排预计 ${formatYearMonth(primaryGoal.estimatedCompletion)}完成`
                  : primaryGoal.deadlineDate
                    ? `目标日期 ${formatYearMonth(primaryGoal.deadlineDate)}`
                    : '设置截止日期后，可计算每月需要存入的金额'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  aria-expanded={depositGoalId === primaryGoal.id}
                  aria-controls={`goal-deposit-${primaryGoal.id}`}
                  onClick={() => openDeposit(primaryGoal)}
                >
                  {depositGoalId === primaryGoal.id ? '收起' : '+ 存一笔'}
                </button>
              </div>
              {depositGoalId === primaryGoal.id && (
                <GoalDepositForm
                  goal={primaryGoal}
                  assets={assets}
                  amount={depositAmount}
                  sourceAssetId={sourceAssetId}
                  error={depositError}
                  isSubmitting={isSubmittingDeposit}
                  onAmountChange={setDepositAmount}
                  onSourceChange={setSourceAssetId}
                  onSubmit={(event) => handleDeposit(event, primaryGoal)}
                  onCancel={closeDeposit}
                />
              )}
            </section>

            {otherGoals.length > 0 && (
              <section aria-label="其他储蓄目标">
                <div style={{ marginBottom: 10, color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 700 }}>
                  其他目标
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {otherGoals.map((goal) => (
                    <div key={goal.id}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                            {goal.icon ? `${goal.icon} ` : ''}{goal.name}
                          </span>
                          <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>
                            {formatCny(goal.current)} / {formatCny(goal.target)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                          <span style={getStatusStyle(goal.statusTone)}>{goal.statusLabel}</span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{goal.progressPercent.toFixed(0)}%</strong>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            aria-expanded={depositGoalId === goal.id}
                            aria-controls={`goal-deposit-${goal.id}`}
                            onClick={() => openDeposit(goal)}
                          >
                            {depositGoalId === goal.id ? '收起' : '存入'}
                          </button>
                        </div>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${goal.name}进度`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(goal.progressPercent)}
                        style={{ height: 6, marginTop: 7, overflow: 'hidden', borderRadius: 999, background: 'var(--color-gray-200)' }}
                      >
                        <div style={{ width: `${goal.progressPercent}%`, height: '100%', borderRadius: 999, background: goal.displayColor }} />
                      </div>
                      {depositGoalId === goal.id && (
                        <GoalDepositForm
                          goal={goal}
                          assets={assets}
                          amount={depositAmount}
                          sourceAssetId={sourceAssetId}
                          error={depositError}
                          isSubmitting={isSubmittingDeposit}
                          onAmountChange={setDepositAmount}
                          onSourceChange={setSourceAssetId}
                          onSubmit={(event) => handleDeposit(event, goal)}
                          onCancel={closeDeposit}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
