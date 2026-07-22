'use client';

import { useState, useSyncExternalStore } from 'react';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import {
  GOLD_ALERT_THRESHOLD_CHANGED_EVENT,
  GOLD_ALERT_THRESHOLD_KEY,
  getGoldAlertDraftState,
  parseGoldAlertThreshold,
} from '@/lib/gold-alert';
import FinancialAiChat from './FinancialAiChat';
import {
  getEffectiveBudgetRemaining,
  type AnnualBudgetProgress,
} from '@/lib/annual-budget';

type BudgetProgress = AnnualBudgetProgress;

interface Transaction {
  id: string;
  type: string;
  amount: string;
  fromAccountId?: string | null;
  occurredAt: string | Date;
}

interface Asset {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type?: string | null;
}

interface Props {
  currentDate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  surplusRate: number;
  tier1Total: number;
  currentIncome: number;
  currentExpense: number;
  budgetProgress: BudgetProgress[];
  transactions: Transaction[];
  assets: Asset[];
  categories: Category[];
  pricesStale: boolean;
  goldUnitPrice?: number | null;
  goldPriceCurrency?: string | null;
}

type StatusTone = 'safe' | 'warning' | 'danger';

const toneConfig: Record<StatusTone, {
  accent: string;
  background: string;
}> = {
  safe: {
    accent: 'var(--color-success)',
    background: 'var(--color-success-bg)',
  },
  warning: {
    accent: 'var(--color-warning)',
    background: 'var(--color-warning-bg)',
  },
  danger: {
    accent: 'var(--color-danger)',
    background: 'var(--color-danger-bg)',
  },
};

function toMonthKey(value: string | Date) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  return value.slice(0, 7);
}

function currencyPrefix(currency?: string | null) {
  switch (currency) {
    case 'USD':
      return '$';
    case 'HKD':
      return 'HK$';
    case 'JPY':
      return '¥';
    default:
      return '¥';
  }
}

function formatPricePerGram(value: number, currency?: string | null) {
  return `${currencyPrefix(currency)}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/克`;
}

function readGoldAlertThresholdSnapshot() {
  if (typeof window === 'undefined') return '';

  try {
    return localStorage.getItem(GOLD_ALERT_THRESHOLD_KEY) ?? '';
  } catch {
    return '';
  }
}

function subscribeGoldAlertThreshold(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === GOLD_ALERT_THRESHOLD_KEY) callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(GOLD_ALERT_THRESHOLD_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(GOLD_ALERT_THRESHOLD_CHANGED_EVENT, callback);
  };
}

export default function FamilySafetySummary({
  currentDate,
  netWorth,
  totalAssets,
  totalLiabilities,
  surplusRate,
  tier1Total,
  currentIncome,
  currentExpense,
  budgetProgress,
  transactions,
  assets,
  categories,
  pricesStale,
  goldUnitPrice,
  goldPriceCurrency,
}: Props) {
  const goldAlertSavedInput = useSyncExternalStore(
    subscribeGoldAlertThreshold,
    readGoldAlertThresholdSnapshot,
    () => '',
  );
  const [goldAlertDraftInput, setGoldAlertDraftInput] = useState('');
  const [hasGoldAlertDraft, setHasGoldAlertDraft] = useState(false);
  const goldAlertInput = hasGoldAlertDraft ? goldAlertDraftInput : goldAlertSavedInput;
  const goldAlertDraftState = getGoldAlertDraftState(goldAlertSavedInput, goldAlertInput);

  const coverageMonths = currentExpense > 0 ? tier1Total / currentExpense : null;
  const budgetRemaining = getEffectiveBudgetRemaining(budgetProgress);
  const overBudgetCount = budgetProgress.filter((budget) => budget.isOverBudget).length;
  const monthKey = currentDate.slice(0, 7);
  const missingSourceCount = transactions.filter((transaction) => (
    transaction.type.toUpperCase() === 'EXPENSE' &&
    !transaction.fromAccountId &&
    toMonthKey(transaction.occurredAt) === monthKey
  )).length;
  const parsedGoldPrice = typeof goldUnitPrice === 'number' ? goldUnitPrice : Number(goldUnitPrice);
  const goldPrice = Number.isFinite(parsedGoldPrice) && parsedGoldPrice > 0 ? parsedGoldPrice : null;
  const goldAlertThreshold = parseGoldAlertThreshold(goldAlertSavedInput);
  const hasGoldAlertThreshold = goldAlertThreshold !== null;
  const goldAlertNotice = goldPrice !== null && goldAlertThreshold !== null && goldPrice <= goldAlertThreshold
    ? {
        title: '已达到提醒价格',
        detail: `当前金价 ${formatPricePerGram(goldPrice, goldPriceCurrency)}，提醒价 ${formatPricePerGram(goldAlertThreshold, goldPriceCurrency)}`,
      }
    : null;
  const goldAlertTriggered = goldAlertNotice !== null;
  const goldAlertTone: StatusTone = goldAlertTriggered ? 'warning' : hasGoldAlertThreshold ? 'safe' : 'warning';
  const goldAlertToneConfig = toneConfig[goldAlertTone];
  const goldAlertLabel = goldAlertTriggered ? '已触发' : hasGoldAlertThreshold ? '已设置' : '待设置';
  const goldAlertDetail = goldPrice === null
    ? '暂无黄金报价'
    : hasGoldAlertThreshold
      ? `${formatPricePerGram(goldPrice, goldPriceCurrency)} · 提醒价 ${formatPricePerGram(goldAlertThreshold, goldPriceCurrency)}`
      : `${formatPricePerGram(goldPrice, goldPriceCurrency)} · 待设置提醒价`;
  const goldAlertStatusColor = goldAlertDraftState.validationError
    ? 'var(--color-danger)'
    : goldAlertDraftState.statusText === '已保存'
      ? 'var(--color-success)'
      : goldAlertDraftState.canSave
        ? 'var(--color-warning)'
        : 'var(--color-text-secondary)';

  function handleGoldAlertChange(value: string) {
    setGoldAlertDraftInput(value);
    setHasGoldAlertDraft(true);
  }

  function handleGoldAlertSave() {
    if (!goldAlertDraftState.canSave || goldAlertDraftState.validationError) return;

    try {
      if (goldAlertDraftState.willClear) {
        localStorage.removeItem(GOLD_ALERT_THRESHOLD_KEY);
      } else {
        localStorage.setItem(GOLD_ALERT_THRESHOLD_KEY, goldAlertDraftState.normalizedValue);
      }
      window.dispatchEvent(new Event(GOLD_ALERT_THRESHOLD_CHANGED_EVENT));
      setHasGoldAlertDraft(false);
    } catch {
      // localStorage can be unavailable in private or restricted browser modes.
    }
  }

  const financeAiSnapshot = {
    currentDate,
    netWorth,
    totalAssets,
    totalLiabilities,
    surplusRate,
    tier1Total,
    currentIncome,
    currentExpense,
    budgetRemaining,
    coverageMonths,
    overBudgetCount,
    missingSourceCount,
    pricesStale,
    goldUnitPrice: goldPrice,
    goldPriceCurrency: goldPriceCurrency ?? 'CNY',
    goldAlertThreshold,
  };

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-body" style={{ padding: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: 8,
              minHeight: 112,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>净资产</div>
            <div style={{ fontSize: 32, fontWeight: 850, color: 'var(--color-text-primary)', lineHeight: 1.12 }}>
              <AmountDisplay amount={netWorth} className="font-bold" />
            </div>
            <FinancialAiChat
              snapshot={financeAiSnapshot}
              ledgerAgentContext={{ categories, assets }}
            />
          </section>

          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 8,
              minHeight: 112,
              paddingLeft: 16,
              borderLeft: '1px solid var(--border-tertiary)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>净资产率</div>
            <div style={{ fontSize: 28, fontWeight: 850, color: 'var(--color-text-primary)', lineHeight: 1.12 }}>
              {surplusRate.toFixed(1)}%
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gap: 10,
              minHeight: 112,
              minWidth: 0,
              paddingLeft: 16,
              borderLeft: '1px solid var(--border-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  黄金低价提醒
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  {goldAlertDetail}
                </div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: goldAlertToneConfig.accent }}>
                {goldAlertLabel}
              </span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 7px',
                  borderRadius: 8,
                  border: '1px solid var(--border-tertiary)',
                  background: goldAlertToneConfig.background,
                }}
              >
                <span>低于</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={goldAlertInput}
                  onChange={(event) => handleGoldAlertChange(event.target.value)}
                  placeholder="提醒价"
                  aria-label="黄金低价提醒价"
                  aria-describedby="gold-alert-save-status"
                  style={{
                    width: 88,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span>{currencyPrefix(goldPriceCurrency)}/克</span>
              </label>
              <button
                type="button"
                onClick={handleGoldAlertSave}
                disabled={!goldAlertDraftState.canSave}
                style={{
                  border: '1px solid var(--color-accent)',
                  borderRadius: 8,
                  background: goldAlertDraftState.canSave ? 'var(--color-accent)' : 'transparent',
                  color: goldAlertDraftState.canSave ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  cursor: goldAlertDraftState.canSave ? 'pointer' : 'default',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '5px 9px',
                  opacity: goldAlertDraftState.canSave ? 1 : 0.65,
                }}
              >
                保存
              </button>
              <span
                id="gold-alert-save-status"
                aria-live="polite"
                style={{
                  minWidth: 42,
                  color: goldAlertStatusColor,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {goldAlertDraftState.statusText}
              </span>
            </div>

            {goldAlertNotice ? (
              <div
                role="status"
                aria-live="polite"
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${goldAlertToneConfig.accent}`,
                  background: goldAlertToneConfig.background,
                  color: 'var(--color-text-primary)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 850, color: goldAlertToneConfig.accent }}>
                  {goldAlertNotice.title}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
                  {goldAlertNotice.detail}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
