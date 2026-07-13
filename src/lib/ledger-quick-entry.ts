import type { LedgerAgentDraft } from '@/lib/ledger-agent';
import { QUICK_ENTRY_CATEGORY_ORDER } from '@/lib/ledger-category-presets';

export type LedgerCreateFormValues = {
  type: string;
  amount: string;
  currency: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  occurredAt: string;
};

export function buildLedgerCreateFormValues(draft: LedgerAgentDraft): LedgerCreateFormValues {
  return {
    type: draft.type,
    amount: draft.amount,
    currency: draft.currency,
    categoryId: draft.categoryId,
    budgetId: '',
    fromAccountId: draft.fromAccountId,
    toAccountId: draft.toAccountId,
    description: draft.description,
    occurredAt: draft.occurredAt,
  };
}

type LedgerCacheKey = string | ((key: unknown) => boolean);

export async function refreshLedgerCaches(
  mutate: (key: LedgerCacheKey) => Promise<unknown>,
) {
  await Promise.allSettled([
    mutate('transactions'),
    mutate('assets'),
    mutate((key) => typeof key === 'string' && (key.startsWith('budgets') || key.startsWith('forecast'))),
  ]);
}

export async function withLedgerLoading<T>(
  setLoading: (loading: boolean) => void,
  work: () => Promise<T>,
) {
  setLoading(true);
  try {
    return await work();
  } finally {
    setLoading(false);
  }
}

export type QuickEntryType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type QuickEntryCategory = { id: string; name: string; type?: string | null };
export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | '+' | '-' | 'backspace';

export type QuickEntryPreferences = {
  categoryByType: Partial<Record<'EXPENSE' | 'INCOME', string>>;
  accountByType: Partial<Record<'EXPENSE' | 'INCOME', string>>;
};

export const QUICK_ENTRY_PREFERENCES_KEY = 'ledger-mobile-quick-entry-preferences-v1';

export function partitionQuickEntryCategories(
  categories: QuickEntryCategory[],
  type: 'EXPENSE' | 'INCOME',
) {
  const filtered = categories.filter((category) => category.type === type);
  const rank = new Map(QUICK_ENTRY_CATEGORY_ORDER[type].map((name, index) => [name, index]));
  const all = [...filtered].sort((left, right) => {
    const leftRank = rank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.name.localeCompare(right.name, 'zh-CN');
  });
  return { primary: all.slice(0, 7), all };
}

function currentOperand(expression: string) {
  return expression.split(/[+-]/).at(-1) ?? '';
}

export function applyAmountKey(expression: string, key: AmountKey) {
  if (key === 'backspace') return expression.slice(0, -1);
  if (key === '+' || key === '-') {
    if (!expression) return expression;
    if (/[+-]$/.test(expression)) return `${expression.slice(0, -1)}${key}`;
    if (expression.endsWith('.')) return expression;
    if (!/^\d+(?:\.\d{0,2})?(?:[+-]\d+(?:\.\d{0,2})?)*$/.test(expression)) return expression;
    return `${expression}${key}`;
  }

  const operand = currentOperand(expression);
  if (key === '.') {
    if (operand.includes('.')) return expression;
    return `${expression}${operand ? '' : '0'}.`;
  }
  const decimal = operand.split('.')[1];
  if (decimal !== undefined && decimal.length + key.length > 2) return expression;
  if (operand === '0' && !operand.includes('.') && key !== '00') {
    return `${expression.slice(0, -1)}${key}`;
  }
  return `${expression}${key}`;
}

export function evaluateAmountExpression(expression: string) {
  if (!/^\d+(?:\.\d{1,2})?(?:[+-]\d+(?:\.\d{1,2})?)*$/.test(expression)) {
    return { valid: false, amount: '', result: 0 };
  }
  const tokens = expression.match(/\d+(?:\.\d{1,2})?|[+-]/g) ?? [];
  let result = Number(tokens[0]);
  for (let index = 1; index < tokens.length; index += 2) {
    const value = Number(tokens[index + 1]);
    result = tokens[index] === '+' ? result + value : result - value;
  }
  result = Math.round((result + Number.EPSILON) * 100) / 100;
  const amount = result.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return { valid: Number.isFinite(result) && result > 0, amount, result };
}

function emptyPreferences(): QuickEntryPreferences {
  return { categoryByType: {}, accountByType: {} };
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePreferenceByType(value: unknown): Partial<Record<'EXPENSE' | 'INCOME', string>> {
  if (!isNonArrayObject(value)) return {};
  const preferences: Partial<Record<'EXPENSE' | 'INCOME', string>> = {};
  if (typeof value.EXPENSE === 'string') preferences.EXPENSE = value.EXPENSE;
  if (typeof value.INCOME === 'string') preferences.INCOME = value.INCOME;
  return preferences;
}

export function parseQuickEntryPreferences(raw: string | null): QuickEntryPreferences {
  if (!raw) return emptyPreferences();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isNonArrayObject(parsed)) return emptyPreferences();
    return {
      categoryByType: parsePreferenceByType(parsed.categoryByType),
      accountByType: parsePreferenceByType(parsed.accountByType),
    };
  } catch {
    return emptyPreferences();
  }
}

export function serializeQuickEntryPreferences(preferences: QuickEntryPreferences) {
  return JSON.stringify(preferences);
}

const currencySymbol: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };

export function buildQuickEntryFeedback(input: {
  amount: string;
  currency: string;
  categoryName: string;
  budgetRemaining?: number;
}) {
  const symbol = currencySymbol[input.currency] ?? input.currency;
  const base = `已记 ${symbol}${input.amount} · ${input.categoryName}`;
  return input.budgetRemaining === undefined
    ? base
    : `${base}预算还剩 ${symbol}${Math.round(input.budgetRemaining * 100) / 100}`;
}

export async function getQuickEntryBudgetRemainingSafely(
  budgetId: string,
  loader: () => Promise<{
    success: boolean;
    data?: Array<{ id: string; remaining: number }> | null;
  }>,
) {
  if (!budgetId) return undefined;

  try {
    const result = await loader();
    return result.success
      ? result.data?.find((item) => item.id === budgetId)?.remaining
      : undefined;
  } catch {
    return undefined;
  }
}
