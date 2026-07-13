'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LedgerAgentDraft } from '@/lib/ledger-agent';
import {
  applyAmountKey,
  beginQuickEntryBudgetResolution,
  buildLedgerCreateFormValues,
  buildQuickEntryBudgetKey,
  completeQuickEntryBudgetResolution,
  evaluateAmountExpression,
  isQuickEntryBudgetResolved,
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
  | { success: true; feedback: string }
  | { success: false; error: string; sessionExpired?: boolean };

export type QuickEntryBudgetOption = { id: string; name: string };

type QuickEntryAsset = { id: string; name: string };

type MobileQuickEntryProps = {
  categories: QuickEntryCategory[];
  assets: QuickEntryAsset[];
  categoriesReady?: boolean;
  assetsReady?: boolean;
  loadBudgets: (date: string, categoryId: string) => Promise<QuickEntryBudgetOption[]>;
  onSubmit: (values: QuickEntrySubmitValues) => Promise<QuickEntrySubmitResult>;
  onSaveTemplate: (name: string, values: QuickEntrySubmitValues) => void;
};

const emptyPreferences: QuickEntryPreferences = { categoryByType: {}, accountByType: {} };
const currencySymbols: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };
const invalidAmountError = '请输入大于 0 的有效金额。';

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstCategory(categories: QuickEntryCategory[], type: Exclude<QuickEntryType, 'TRANSFER'>) {
  return partitionQuickEntryCategories(categories, type).primary[0]?.id ?? '';
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
  return {
    categoryReady: readiness.categoriesReady,
    accountReady: readiness.assetsReady,
    complete: readiness.categoriesReady && readiness.assetsReady,
    categoryByType: readiness.categoriesReady ? sanitized.categoryByType : {},
    accountByType: readiness.assetsReady ? sanitized.accountByType : {},
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
    categoryId: activePreferences.categoryByType[type] ?? firstCategory(categories, type),
    accountId: activePreferences.accountByType[type] ?? '',
  };
}

export function saveQuickEntryTemplate(
  enabled: boolean,
  name: string,
  values: QuickEntrySubmitValues,
  onSave: (templateName: string, templateValues: QuickEntrySubmitValues) => void,
) {
  if (!enabled || !name.trim()) return '';
  try {
    onSave(name.trim(), values);
    return '';
  } catch {
    return '记账已成功，但模板保存失败。';
  }
}

export default function MobileQuickEntry({
  categories,
  assets,
  categoriesReady = true,
  assetsReady = true,
  loadBudgets,
  onSubmit,
  onSaveTemplate,
}: MobileQuickEntryProps) {
  const today = useMemo(() => localDate(), []);
  const [type, setType] = useState<QuickEntryType>('EXPENSE');
  const [expression, setExpression] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [categoryId, setCategoryId] = useState(() => firstCategory(categories, 'EXPENSE'));
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
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
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
  const budgetResolved = isQuickEntryBudgetResolved(budgetKey, currentBudgetResolution.resolvedKey);
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
        setCategoryId(application.categoryByType[type] ?? firstCategory(categories, type));
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
      setFromAccountId(application.accountByType.EXPENSE ?? '');
      setToAccountId(application.accountByType.INCOME ?? '');
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
  }

  function selectType(nextType: QuickEntryType) {
    clearMessage();
    if (nextType === type) return;
    setType(nextType);

    if (nextType === 'TRANSFER') {
      setCategoryId('');
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
  }

  function selectCategory(nextCategoryId: string) {
    clearMessage();
    setCategoryId(nextCategoryId);
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
    if (!budgetResolved) {
      setError('正在匹配预算，请稍候。');
      return;
    }
    if (type === 'TRANSFER' && (!fromAccountId || !toAccountId)) {
      setError('转账需要同时选择来源账户和目标账户。');
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

    const templateError = saveQuickEntryTemplate(
      saveAsTemplate,
      templateName,
      values,
      onSaveTemplate,
    );
    if (templateError) setError(templateError);
    setSubmitting(false);
  }

  const selectedAccountName = type === 'EXPENSE'
    ? assets.find((asset) => asset.id === fromAccountId)?.name
    : type === 'INCOME'
      ? assets.find((asset) => asset.id === toAccountId)?.name
      : fromAccountId && toAccountId
        ? `${assets.find((asset) => asset.id === fromAccountId)?.name ?? '来源账户'} → ${assets.find((asset) => asset.id === toAccountId)?.name ?? '目标账户'}`
        : '';

  const fieldClass = 'min-h-11 w-full rounded-lg border border-[var(--border-tertiary)] bg-[var(--color-container)] px-3';

  return (
    <section data-mobile-quick-entry="true" className="mx-auto w-full max-w-md space-y-4 pb-4">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">记一笔</h1>
      <div role="group" aria-label="交易类型" className="grid grid-cols-2 rounded-xl bg-[var(--color-container)] p-1">
        <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => selectType('EXPENSE')} className="min-h-11 rounded-lg aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">支出</button>
        <button type="button" aria-pressed={type === 'INCOME'} onClick={() => selectType('INCOME')} className="min-h-11 rounded-lg aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">收入</button>
      </div>
      {type === 'TRANSFER' ? <div role="status">转账模式</div> : (
        <FrequentCategoryGrid categories={categories} type={type} selectedId={categoryId} onSelect={selectCategory} onMore={() => setCategorySheetOpen(true)} />
      )}
      <div className="rounded-2xl bg-[var(--color-container)] p-4 text-right">
        <div className="text-xs text-[var(--color-text-secondary)]">{expression || '0'}</div>
        <output aria-label="金额" className="text-4xl font-bold">{currencySymbols[currency] ?? currency}{evaluation.valid ? evaluation.amount : '0'}</output>
      </div>
      <AmountKeypad onKey={(key) => {
        clearMessage();
        setExpression((current) => applyAmountKey(current, key));
      }} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 rounded-xl border border-[var(--border-tertiary)]">{selectedAccountName || '不指定账户'}</button>
        <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 rounded-xl border border-[var(--border-tertiary)]">{occurredAt === today ? '今天' : occurredAt}</button>
      </div>
      <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 w-full">更多选项</button>
      <button
        type="button"
        disabled={submitting || !evaluation.valid || !budgetResolved}
        aria-busy={submitting || !budgetResolved}
        onClick={submit}
        className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] font-bold text-[var(--color-text-inverse)] disabled:opacity-50"
      >
        {submitting
          ? '记账中…'
          : !budgetResolved
            ? <span role="status" aria-live="polite">预算匹配中…</span>
            : '确认记账'}
      </button>
      <button type="button" onClick={() => setAgentOpen((open) => !open)} className="min-h-11 w-full">说一句记账</button>
      {amountError || error ? <div role="alert" className="text-sm text-ledger-danger">{amountError || error}</div> : null}
      {feedback ? <div role="status" className="text-sm text-ledger-success">{feedback}</div> : null}
      {agentOpen ? (
        <LedgerAgentQuickEntry embedded title="说一句记账" actionLabel="识别并填入" categories={categories} assets={assets} onApply={applyAgentDraft} />
      ) : null}
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
      <QuickEntryMoreSheet open={optionsOpen} title="更多记账选项" onClose={() => setOptionsOpen(false)}>
        <div className="space-y-3">
          <label className="block space-y-1">记账方式
            <select aria-label="记账方式" value={type} onChange={(event) => selectType(event.target.value as QuickEntryType)} className={fieldClass}>
              <option value="EXPENSE">支出</option><option value="INCOME">收入</option><option value="TRANSFER">转账</option>
            </select>
          </label>
          <label className="block space-y-1">币种
            <select aria-label="币种" value={currency} onChange={(event) => setCurrency(event.target.value)} className={fieldClass}>
              <option value="CNY">人民币</option><option value="USD">美元</option><option value="HKD">港币</option><option value="JPY">日元</option>
            </select>
          </label>
          <label className="block space-y-1">预算
            <select aria-label="预算" value={budgetId} onChange={(event) => {
              const nextBudgetId = event.target.value;
              setBudgetResolution((current) => (
                current.key === budgetKey ? { ...current, budgetId: nextBudgetId } : current
              ));
            }} className={fieldClass}>
              <option value="">不关联预算</option>{budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1">来源账户
            <select aria-label="来源账户" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)} className={fieldClass}>
              <option value="">不指定</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1">目标账户
            <select aria-label="目标账户" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)} className={fieldClass}>
              <option value="">不指定</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1">日期
            <input aria-label="日期" type="date" value={occurredAt} onChange={(event) => {
              setOccurredAt(event.target.value);
            }} className={fieldClass} />
          </label>
          <label className="block space-y-1">备注
            <input aria-label="备注" value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} className="min-h-11 min-w-11" />保存为模板
          </label>
          {saveAsTemplate ? <label className="block space-y-1">模板名称<input aria-label="模板名称" value={templateName} onChange={(event) => setTemplateName(event.target.value)} className={fieldClass} /></label> : null}
          <button type="button" onClick={() => setOptionsOpen(false)} className="mt-3 min-h-11 w-full rounded-xl">完成</button>
        </div>
      </QuickEntryMoreSheet>
    </section>
  );
}
