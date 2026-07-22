'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Undo2 } from 'lucide-react';
import type { LedgerAgentDraft } from '@/lib/ledger-agent';
import {
  applyAmountKey,
  beginQuickEntryBudgetResolution,
  buildLedgerCreateFormValues,
  buildQuickEntryBudgetKey,
  completeQuickEntryBudgetResolution,
  evaluateAmountExpression,
  parseQuickEntryPreferences,
  partitionQuickEntryCategories,
  QUICK_ENTRY_PREFERENCES_KEY,
  serializeQuickEntryPreferences,
  type QuickEntryCategory,
  type QuickEntryBudgetResolution,
  type QuickEntryPreferences,
  type QuickEntryType,
} from '@/lib/ledger-quick-entry';
import LedgerAgentQuickEntry from '@/components/widgets/LedgerAgentQuickEntry';
import AmountKeypad from './AmountKeypad';
import FrequentCategoryGrid, { CategoryIcon } from './FrequentCategoryGrid';
import QuickEntryMoreSheet from './QuickEntryMoreSheet';

export type QuickEntrySubmitValues = {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: string;
  currency: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  occurredAt: string;
};

export type QuickEntrySubmitResult =
  | { success: true; feedback: string; transactionId: string }
  | { success: false; error: string; sessionExpired?: boolean };

export type QuickEntryUndoResult =
  | { success: true; feedback: string }
  | { success: false; error: string; sessionExpired?: boolean };

export type QuickEntryBudgetOption = { id: string; name: string };

type QuickEntryAsset = { id: string; name: string; currency?: string | null };

type MobileQuickEntryProps = {
  categories: QuickEntryCategory[];
  assets: QuickEntryAsset[];
  categoriesReady?: boolean;
  assetsReady?: boolean;
  loadBudgets: (date: string, categoryId: string) => Promise<QuickEntryBudgetOption[]>;
  onSubmit: (values: QuickEntrySubmitValues) => Promise<QuickEntrySubmitResult>;
  onUndo: (transactionId: string) => Promise<QuickEntryUndoResult>;
};

const emptyPreferences: QuickEntryPreferences = { categoryByType: {}, accountByType: {} };
const currencySymbols: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };
const currencyNames: Record<string, string> = { CNY: '人民币', USD: '美元', HKD: '港币', JPY: '日元' };
const invalidAmountError = '请输入大于 0 的有效金额。';

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validCategoryPreference(
  categories: QuickEntryCategory[],
  type: Exclude<QuickEntryType, 'TRANSFER'>,
  categoryId: string | undefined,
) {
  return categoryId && categories.some((category) => category.id === categoryId && category.type === type)
    ? categoryId
    : '';
}

function validAccountPreference(assets: QuickEntryAsset[], accountId: string | undefined) {
  return accountId && assets.some((asset) => asset.id === accountId) ? accountId : '';
}

export function sanitizeQuickEntryPreferences(
  preferences: QuickEntryPreferences,
  categories: QuickEntryCategory[],
  assets: QuickEntryAsset[],
): QuickEntryPreferences {
  const categoryByType: QuickEntryPreferences['categoryByType'] = {};
  const accountByType: QuickEntryPreferences['accountByType'] = {};

  for (const type of ['EXPENSE', 'INCOME'] as const) {
    const categoryId = validCategoryPreference(categories, type, preferences.categoryByType[type]);
    const accountId = validAccountPreference(assets, preferences.accountByType[type]);
    if (categoryId) categoryByType[type] = categoryId;
    if (accountId) accountByType[type] = accountId;
  }

  return {
    categoryByType,
    accountByType,
  };
}

export function resolveQuickEntryPreferenceApplication(
  preferences: QuickEntryPreferences,
  categories: QuickEntryCategory[],
  assets: QuickEntryAsset[],
  readiness: { categoriesReady: boolean; assetsReady: boolean },
) {
  const sanitized = sanitizeQuickEntryPreferences(preferences, categories, assets);
  const accountByType = readiness.assetsReady ? { ...sanitized.accountByType } : {};
  if (readiness.assetsReady && assets.length === 1) {
    accountByType.EXPENSE ??= assets[0].id;
    accountByType.INCOME ??= assets[0].id;
  }
  return {
    categoryReady: readiness.categoriesReady,
    accountReady: readiness.assetsReady,
    complete: readiness.categoriesReady && readiness.assetsReady,
    categoryByType: readiness.categoriesReady ? sanitized.categoryByType : {},
    accountByType,
  };
}

export function getQuickEntryOptionalFieldVisibility(type: QuickEntryType) {
  return {
    budget: type === 'EXPENSE',
    fromAccount: type === 'EXPENSE' || type === 'TRANSFER',
    toAccount: type === 'INCOME' || type === 'TRANSFER',
    transferAccountsRequired: type === 'TRANSFER',
  };
}

export function buildQuickEntryContextSummary(input: {
  type: QuickEntryType;
  occurredAt: string;
  today: string;
  currency: string;
  fromAccountId: string;
  toAccountId: string;
  assets: QuickEntryAsset[];
}) {
  const accountName = (id: string) => input.assets.find((asset) => asset.id === id)?.name;
  let accountLabel = '仅记总收支';
  if (input.type === 'EXPENSE' && input.fromAccountId) {
    accountLabel = accountName(input.fromAccountId) ?? '付款账户';
  } else if (input.type === 'INCOME' && input.toAccountId) {
    accountLabel = accountName(input.toAccountId) ?? '收款账户';
  } else if (input.type === 'TRANSFER') {
    accountLabel = input.fromAccountId && input.toAccountId
      ? `${accountName(input.fromAccountId) ?? '转出账户'} → ${accountName(input.toAccountId) ?? '转入账户'}`
      : '选择转账账户';
  }

  return {
    dateLabel: input.occurredAt === input.today ? '今天' : input.occurredAt,
    accountLabel,
    currencyLabel: currencyNames[input.currency] ?? input.currency,
  };
}

export function resolveQuickEntryBudgetId(options: QuickEntryBudgetOption[]) {
  return options.length === 1 ? options[0].id : '';
}

export function getQuickEntryAmountError(expression: string) {
  return expression && !evaluateAmountExpression(expression).valid ? invalidAmountError : '';
}

export function buildQuickEntrySubmitValues(
  values: QuickEntrySubmitValues,
): QuickEntrySubmitValues {
  return {
    ...values,
    categoryId: values.type === 'TRANSFER' ? '' : values.categoryId,
    budgetId: values.type === 'TRANSFER' ? '' : values.budgetId,
    fromAccountId: values.type === 'INCOME' ? '' : values.fromAccountId,
    toAccountId: values.type === 'EXPENSE' ? '' : values.toAccountId,
  };
}

export function mergeSuccessfulQuickEntryPreferences(
  preferences: QuickEntryPreferences,
  type: Exclude<QuickEntryType, 'TRANSFER'>,
  categoryId: string,
  accountId: string,
): QuickEntryPreferences {
  const categoryByType = {
    ...preferences.categoryByType,
    [type]: categoryId,
  };
  const accountByType = { ...preferences.accountByType };
  if (accountId) accountByType[type] = accountId;
  else delete accountByType[type];

  return { categoryByType, accountByType };
}

export function buildSuccessfulQuickEntryPreferenceSnapshots(
  storedPreferences: QuickEntryPreferences,
  activePreferences: QuickEntryPreferences,
  type: Exclude<QuickEntryType, 'TRANSFER'>,
  categoryId: string,
  accountId: string,
) {
  return {
    storedPreferences: mergeSuccessfulQuickEntryPreferences(
      storedPreferences,
      type,
      categoryId,
      accountId,
    ),
    activePreferences: mergeSuccessfulQuickEntryPreferences(
      activePreferences,
      type,
      categoryId,
      accountId,
    ),
  };
}

export function resolveQuickEntryTypeSelection(
  activePreferences: QuickEntryPreferences,
  categories: QuickEntryCategory[],
  type: Exclude<QuickEntryType, 'TRANSFER'>,
) {
  return {
    categoryId: validCategoryPreference(categories, type, activePreferences.categoryByType[type]),
    accountId: activePreferences.accountByType[type] ?? '',
  };
}

export default function MobileQuickEntry({
  categories,
  assets,
  categoriesReady = true,
  assetsReady = true,
  loadBudgets,
  onSubmit,
  onUndo,
}: MobileQuickEntryProps) {
  const today = useMemo(() => localDate(), []);
  const [type, setType] = useState<QuickEntryType>('EXPENSE');
  const [expression, setExpression] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [categoryId, setCategoryId] = useState('');
  const [budgetResolution, setBudgetResolution] = useState<QuickEntryBudgetResolution>({
    key: '',
    resolvedKey: '',
    options: [],
    budgetId: '',
  });
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(today);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');
  const preferencesRef = useRef<QuickEntryPreferences>(emptyPreferences);
  const storedPreferencesRef = useRef<QuickEntryPreferences>(emptyPreferences);
  const preferencesReadRef = useRef(false);
  const categoryPreferencesAppliedRef = useRef(false);
  const accountPreferencesAppliedRef = useRef(false);
  const budgetRequestRef = useRef(0);

  const evaluation = evaluateAmountExpression(expression);
  const amountError = getQuickEntryAmountError(expression);
  const budgetKey = buildQuickEntryBudgetKey(type, categoryId, occurredAt);
  const currentBudgetResolution = beginQuickEntryBudgetResolution(budgetResolution, budgetKey);
  const budgets = currentBudgetResolution.options;
  const budgetId = currentBudgetResolution.budgetId;
  const optionalFields = getQuickEntryOptionalFieldVisibility(type);
  const categorySections = useMemo(
    () => partitionQuickEntryCategories(categories, type === 'INCOME' ? 'INCOME' : 'EXPENSE'),
    [categories, type],
  );

  useEffect(() => {
    if (!preferencesReadRef.current) {
      preferencesReadRef.current = true;
      try {
        storedPreferencesRef.current = parseQuickEntryPreferences(
          window.localStorage.getItem(QUICK_ENTRY_PREFERENCES_KEY),
        );
      } catch {
        // Access can throw when storage is blocked; defaults remain usable.
      }
    }

    const application = resolveQuickEntryPreferenceApplication(
      storedPreferencesRef.current,
      categories,
      assets,
      { categoriesReady, assetsReady },
    );

    if (application.categoryReady && !categoryPreferencesAppliedRef.current) {
      categoryPreferencesAppliedRef.current = true;
      storedPreferencesRef.current = {
        ...storedPreferencesRef.current,
        categoryByType: application.categoryByType,
      };
      preferencesRef.current = {
        ...preferencesRef.current,
        categoryByType: application.categoryByType,
      };
      if (type !== 'TRANSFER') {
        setCategoryId(application.categoryByType[type] ?? '');
      }
    }

    if (application.accountReady && !accountPreferencesAppliedRef.current) {
      accountPreferencesAppliedRef.current = true;
      storedPreferencesRef.current = {
        ...storedPreferencesRef.current,
        accountByType: application.accountByType,
      };
      preferencesRef.current = {
        ...preferencesRef.current,
        accountByType: application.accountByType,
      };
      const expenseAccountId = application.accountByType.EXPENSE ?? '';
      const incomeAccountId = application.accountByType.INCOME ?? '';
      setFromAccountId(expenseAccountId);
      setToAccountId(incomeAccountId);
      const initialAccount = assets.find((asset) => asset.id === expenseAccountId);
      if (initialAccount?.currency) setCurrency(initialAccount.currency);
    }
  }, [assets, assetsReady, categories, categoriesReady, type]);

  useEffect(() => {
    const requestId = ++budgetRequestRef.current;
    if (!budgetKey) return;

    let active = true;
    void loadBudgets(occurredAt, categoryId)
      .then((options) => {
        if (!active || requestId !== budgetRequestRef.current) return;
        setBudgetResolution((current) => (
          completeQuickEntryBudgetResolution(
            beginQuickEntryBudgetResolution(current, budgetKey),
            budgetKey,
            options,
          )
        ));
      })
      .catch(() => {
        if (!active || requestId !== budgetRequestRef.current) return;
        setBudgetResolution((current) => (
          completeQuickEntryBudgetResolution(
            beginQuickEntryBudgetResolution(current, budgetKey),
            budgetKey,
            [],
          )
        ));
      });

    return () => {
      active = false;
    };
  }, [budgetKey, categoryId, loadBudgets, occurredAt]);

  function clearMessage() {
    setError('');
    setFeedback('');
    setLastTransactionId('');
  }

  function syncCurrencyFromAccount(accountId: string) {
    const account = assets.find((asset) => asset.id === accountId);
    if (account?.currency) setCurrency(account.currency);
  }

  function selectType(nextType: QuickEntryType) {
    clearMessage();
    if (nextType === type) return;
    setType(nextType);

    if (nextType === 'TRANSFER') {
      setCategoryId('');
      setOptionsOpen(true);
      return;
    }

    const selection = resolveQuickEntryTypeSelection(
      preferencesRef.current,
      categories,
      nextType,
    );
    setCategoryId(selection.categoryId);
    if (nextType === 'EXPENSE') {
      setFromAccountId(selection.accountId);
    } else {
      setToAccountId(selection.accountId);
    }
    syncCurrencyFromAccount(selection.accountId);
  }

  function selectCategory(nextCategoryId: string) {
    clearMessage();
    setCategoryId(nextCategoryId);
  }

  function selectFromAccount(accountId: string) {
    clearMessage();
    setFromAccountId(accountId);
    if (type === 'EXPENSE' || type === 'TRANSFER') syncCurrencyFromAccount(accountId);
  }

  function selectToAccount(accountId: string) {
    clearMessage();
    setToAccountId(accountId);
    if (type === 'INCOME') syncCurrencyFromAccount(accountId);
  }

  function applyAgentDraft(draft: LedgerAgentDraft) {
    const values = buildLedgerCreateFormValues(draft);
    const nextType = values.type === 'INCOME' || values.type === 'TRANSFER' ? values.type : 'EXPENSE';
    clearMessage();
    setType(nextType);
    setExpression(values.amount);
    setCurrency(values.currency);
    setCategoryId(nextType === 'TRANSFER' ? '' : values.categoryId);
    setFromAccountId(values.fromAccountId);
    setToAccountId(values.toAccountId);
    setDescription(values.description);
    setOccurredAt(values.occurredAt);
    setAgentOpen(false);
  }

  function currentSubmitValues(): QuickEntrySubmitValues {
    return buildQuickEntrySubmitValues({
      type,
      amount: evaluation.amount,
      currency,
      categoryId,
      budgetId,
      fromAccountId,
      toAccountId,
      description,
      occurredAt,
    });
  }

  async function submit() {
    if (submitting) return;
    clearMessage();

    if (!evaluation.valid) {
      setError(invalidAmountError);
      return;
    }
    if (type !== 'TRANSFER' && !categoryId) {
      setError('请选择分类。');
      return;
    }
    if (type === 'TRANSFER' && (!fromAccountId || !toAccountId)) {
      setError('转账需要同时选择来源账户和目标账户。');
      return;
    }
    if (type === 'TRANSFER' && fromAccountId === toAccountId) {
      setError('转出账户和转入账户不能相同。');
      return;
    }

    const values = currentSubmitValues();
    setSubmitting(true);
    let result: QuickEntrySubmitResult;
    try {
      result = await onSubmit(values);
    } catch {
      setError('记账失败，请稍后重试。');
      setSubmitting(false);
      return;
    }

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setExpression('');
    setAgentOpen(false);
    setFeedback(result.feedback);
    setLastTransactionId(result.transactionId);
    setDescription('');
    setOccurredAt(today);

    if (type !== 'TRANSFER') {
      const accountId = type === 'EXPENSE' ? fromAccountId : toAccountId;
      const nextPreferences = buildSuccessfulQuickEntryPreferenceSnapshots(
        storedPreferencesRef.current,
        preferencesRef.current,
        type,
        categoryId,
        accountId,
      );
      storedPreferencesRef.current = nextPreferences.storedPreferences;
      preferencesRef.current = nextPreferences.activePreferences;
      try {
        window.localStorage.setItem(
          QUICK_ENTRY_PREFERENCES_KEY,
          serializeQuickEntryPreferences(nextPreferences.storedPreferences),
        );
      } catch {
        // Storage can be unavailable in private browsing; the successful ledger write still stands.
      }
    }

    setSubmitting(false);
  }

  async function undoLastTransaction() {
    if (!lastTransactionId || undoing) return;
    setError('');
    setUndoing(true);
    let result: QuickEntryUndoResult;
    try {
      result = await onUndo(lastTransactionId);
    } catch {
      setError('撤销失败，请稍后重试。');
      setUndoing(false);
      return;
    }

    if (!result.success) {
      setError(result.error);
      setUndoing(false);
      return;
    }

    setLastTransactionId('');
    setFeedback(result.feedback);
    setUndoing(false);
  }

  function startAnotherEntry() {
    setError('');
    setFeedback('');
    setLastTransactionId('');
  }

  const contextSummary = buildQuickEntryContextSummary({
    type,
    occurredAt,
    today,
    currency,
    fromAccountId,
    toAccountId,
    assets,
  });
  const completionLabel = submitting
    ? '记账中…'
    : evaluation.valid
      ? `记 ${currencySymbols[currency] ?? currency}${evaluation.amount}`
      : '完成';

  const fieldClass = 'min-h-11 w-full rounded-lg border border-[var(--border-tertiary)] bg-[var(--color-container)] px-3';

  return (
    <section data-mobile-quick-entry="true" className="mx-auto w-full max-w-md space-y-3 pb-4">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">记一笔</h1>
        <button
          type="button"
          aria-expanded={agentOpen}
          aria-controls="mobile-quick-entry-agent"
          onClick={() => {
            clearMessage();
            setAgentOpen((open) => !open);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-tertiary)] px-3 text-sm font-medium text-[var(--color-text-primary)]"
        >
          <Mic size={18} strokeWidth={1.9} aria-hidden />
          说一句
        </button>
      </div>

      {agentOpen ? (
        <div id="mobile-quick-entry-agent">
          <LedgerAgentQuickEntry embedded title="说一句记账" actionLabel="识别并填入" categories={categories} assets={assets} onApply={applyAgentDraft} />
        </div>
      ) : null}

      <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
        {type === 'TRANSFER'
          ? '选择转出、转入账户，再输入金额。'
          : '只需选择分类、输入金额；账户、日期和预算会自动处理。'}
      </p>

      <div role="group" aria-label="交易类型" className="grid grid-cols-3 rounded-xl bg-[var(--color-container)] p-1">
        <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => selectType('EXPENSE')} className="min-h-11 rounded-lg text-sm font-medium aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">支出</button>
        <button type="button" aria-pressed={type === 'INCOME'} onClick={() => selectType('INCOME')} className="min-h-11 rounded-lg text-sm font-medium aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">收入</button>
        <button type="button" aria-pressed={type === 'TRANSFER'} onClick={() => selectType('TRANSFER')} className="min-h-11 rounded-lg text-sm font-medium aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">转账</button>
      </div>

      {type === 'TRANSFER' ? (
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          className="flex min-h-14 w-full items-center justify-between rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] px-4 text-left text-sm"
        >
          <span className="text-[var(--color-text-secondary)]">转账账户</span>
          <span className="font-medium text-[var(--color-text-primary)]">{contextSummary.accountLabel}</span>
        </button>
      ) : (
        <FrequentCategoryGrid categories={categories} type={type} selectedId={categoryId} onSelect={selectCategory} onMore={() => setCategorySheetOpen(true)} />
      )}

      <div className="rounded-2xl bg-[var(--color-container)] p-3 text-right">
        <div className="min-h-4 text-xs text-[var(--color-text-secondary)]">{expression || '0'}</div>
        <output aria-label="金额" className="text-4xl font-bold tabular-nums text-[var(--color-text-primary)]">
          {currencySymbols[currency] ?? currency}{evaluation.valid ? evaluation.amount : '0'}
        </output>
      </div>

      {feedback ? (
        <div data-quick-entry-result="true" className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-3">
          <div role="status" aria-live="polite" className="text-sm font-medium text-ledger-success">{feedback}</div>
          <div className={`mt-2 grid gap-2 ${lastTransactionId ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {lastTransactionId ? (
              <button
                type="button"
                disabled={undoing}
                onClick={undoLastTransaction}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-tertiary)] text-sm text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <Undo2 size={17} aria-hidden />
                {undoing ? '撤销中…' : '撤销'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={startAnotherEntry}
              className="min-h-11 rounded-lg bg-[var(--color-accent)] text-sm font-medium text-[var(--color-text-inverse)]"
            >
              再记一笔
            </button>
          </div>
        </div>
      ) : (
        <AmountKeypad
          onKey={(key) => {
            clearMessage();
            setExpression((current) => applyAmountKey(current, key));
          }}
          onComplete={submit}
          completeLabel={completionLabel}
          completeDisabled={submitting || !evaluation.valid}
          completeBusy={submitting}
        />
      )}

      <button
        type="button"
        aria-label={`更多选项：${contextSummary.dateLabel}，${contextSummary.accountLabel}，${contextSummary.currencyLabel}`}
        onClick={() => setOptionsOpen(true)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-xs text-[var(--color-text-secondary)]"
      >
        <span className="truncate">{contextSummary.dateLabel} · {contextSummary.accountLabel} · {contextSummary.currencyLabel}</span>
        <span className="shrink-0 font-medium text-[var(--color-accent)]">更多选项</span>
      </button>

      {amountError || error ? <div role="alert" className="text-sm text-ledger-danger">{amountError || error}</div> : null}

      <QuickEntryMoreSheet open={categorySheetOpen} title="选择分类" onClose={() => setCategorySheetOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {categorySections.all.map((category) => (
            <button key={category.id} type="button" onClick={() => {
              selectCategory(category.id);
              setCategorySheetOpen(false);
            }} className="flex min-h-11 flex-col items-center justify-center rounded-xl border border-[var(--border-tertiary)] p-2">
              <CategoryIcon name={category.name} /><span>{category.name}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setCategorySheetOpen(false)} className="mt-3 min-h-11 w-full rounded-xl">完成</button>
      </QuickEntryMoreSheet>
      <QuickEntryMoreSheet open={optionsOpen} title={type === 'TRANSFER' ? '选择转账账户' : '更多记账选项'} onClose={() => setOptionsOpen(false)}>
        <div className="space-y-3">
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            {type === 'TRANSFER' ? '转出和转入账户必须选择，其余项目选填。' : '这里的项目都可以不填，系统会使用自动值。'}
          </p>
          {optionalFields.fromAccount ? (
            <label className="block space-y-1">{type === 'TRANSFER' ? '转出账户（必选）' : '付款账户（选填）'}
              <select aria-label={type === 'TRANSFER' ? '转出账户' : '付款账户（选填）'} value={fromAccountId} onChange={(event) => selectFromAccount(event.target.value)} className={fieldClass}>
                <option value="">{type === 'TRANSFER' ? '请选择转出账户' : '仅记总收支'}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
            </label>
          ) : null}
          {optionalFields.toAccount ? (
            <label className="block space-y-1">{type === 'TRANSFER' ? '转入账户（必选）' : '收款账户（选填）'}
              <select aria-label={type === 'TRANSFER' ? '转入账户' : '收款账户（选填）'} value={toAccountId} onChange={(event) => selectToAccount(event.target.value)} className={fieldClass}>
                <option value="">{type === 'TRANSFER' ? '请选择转入账户' : '仅记总收支'}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1">日期（选填）
            <input aria-label="日期" type="date" value={occurredAt} onChange={(event) => {
              clearMessage();
              setOccurredAt(event.target.value);
            }} className={fieldClass} />
          </label>
          <label className="block space-y-1">币种（选填）
            <select aria-label="币种（选填）" value={currency} onChange={(event) => {
              clearMessage();
              setCurrency(event.target.value);
            }} className={fieldClass}>
              <option value="CNY">人民币</option><option value="USD">美元</option><option value="HKD">港币</option><option value="JPY">日元</option>
            </select>
          </label>
          {optionalFields.budget ? (
            <label className="block space-y-1">预算（选填）
              <select aria-label="预算（选填）" value={budgetId} onChange={(event) => {
                const nextBudgetId = event.target.value;
                setBudgetResolution((current) => (
                  current.key === budgetKey ? { ...current, budgetId: nextBudgetId } : current
                ));
              }} className={fieldClass}>
                <option value="">自动匹配</option>{budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1">备注（选填）
            <input aria-label="备注（选填）" value={description} onChange={(event) => {
              clearMessage();
              setDescription(event.target.value);
            }} placeholder="例如：午饭、打车" className={fieldClass} />
          </label>
          <button type="button" onClick={() => setOptionsOpen(false)} className="mt-3 min-h-11 w-full rounded-xl bg-[var(--color-accent)] font-medium text-[var(--color-text-inverse)]">完成</button>
        </div>
      </QuickEntryMoreSheet>
    </section>
  );
}
