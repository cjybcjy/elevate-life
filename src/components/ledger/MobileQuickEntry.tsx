'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LedgerAgentDraft } from '@/lib/ledger-agent';
import {
  applyAmountKey,
  buildLedgerCreateFormValues,
  evaluateAmountExpression,
  parseQuickEntryPreferences,
  partitionQuickEntryCategories,
  QUICK_ENTRY_PREFERENCES_KEY,
  serializeQuickEntryPreferences,
  type QuickEntryCategory,
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
  loadBudgets: (date: string, categoryId: string) => Promise<QuickEntryBudgetOption[]>;
  onSubmit: (values: QuickEntrySubmitValues) => Promise<QuickEntrySubmitResult>;
  onSaveTemplate: (name: string, values: QuickEntrySubmitValues) => void;
};

const emptyPreferences: QuickEntryPreferences = { categoryByType: {}, accountByType: {} };
const currencySymbols: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };

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

function sanitizePreferences(
  preferences: QuickEntryPreferences,
  categories: QuickEntryCategory[],
  assets: QuickEntryAsset[],
): QuickEntryPreferences {
  return {
    categoryByType: {
      EXPENSE: validCategoryPreference(categories, 'EXPENSE', preferences.categoryByType.EXPENSE) || undefined,
      INCOME: validCategoryPreference(categories, 'INCOME', preferences.categoryByType.INCOME) || undefined,
    },
    accountByType: {
      EXPENSE: validAccountPreference(assets, preferences.accountByType.EXPENSE) || undefined,
      INCOME: validAccountPreference(assets, preferences.accountByType.INCOME) || undefined,
    },
  };
}

export default function MobileQuickEntry({
  categories,
  assets,
  loadBudgets,
  onSubmit,
  onSaveTemplate,
}: MobileQuickEntryProps) {
  const today = useMemo(() => localDate(), []);
  const [type, setType] = useState<QuickEntryType>('EXPENSE');
  const [expression, setExpression] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [categoryId, setCategoryId] = useState(() => firstCategory(categories, 'EXPENSE'));
  const [budgetId, setBudgetId] = useState('');
  const [budgets, setBudgets] = useState<QuickEntryBudgetOption[]>([]);
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
  const preferencesLoadedRef = useRef(false);
  const budgetRequestRef = useRef(0);

  const evaluation = evaluateAmountExpression(expression);
  const categorySections = useMemo(
    () => partitionQuickEntryCategories(categories, type === 'INCOME' ? 'INCOME' : 'EXPENSE'),
    [categories, type],
  );

  useEffect(() => {
    if (preferencesLoadedRef.current) return;
    preferencesLoadedRef.current = true;

    let stored = emptyPreferences;
    try {
      stored = parseQuickEntryPreferences(window.localStorage.getItem(QUICK_ENTRY_PREFERENCES_KEY));
    } catch {
      // Access can throw when storage is blocked; defaults remain usable.
    }
    const preferences = sanitizePreferences(stored, categories, assets);
    preferencesRef.current = preferences;
    setCategoryId(preferences.categoryByType.EXPENSE ?? firstCategory(categories, 'EXPENSE'));
    setFromAccountId(preferences.accountByType.EXPENSE ?? '');
  }, [assets, categories]);

  useEffect(() => {
    const requestId = ++budgetRequestRef.current;
    if (type === 'TRANSFER' || !categoryId || !occurredAt) return;

    let active = true;
    void loadBudgets(occurredAt, categoryId)
      .then((options) => {
        if (!active || requestId !== budgetRequestRef.current) return;
        setBudgets(options);
        setBudgetId(options.length === 1 ? options[0].id : '');
      })
      .catch(() => {
        if (!active || requestId !== budgetRequestRef.current) return;
        setBudgets([]);
        setBudgetId('');
      });

    return () => {
      active = false;
    };
  }, [categoryId, loadBudgets, occurredAt, type]);

  function clearMessage() {
    setError('');
    setFeedback('');
  }

  function invalidateBudgets() {
    budgetRequestRef.current += 1;
    setBudgets([]);
    setBudgetId('');
  }

  function selectType(nextType: QuickEntryType) {
    clearMessage();
    setType(nextType);
    invalidateBudgets();

    if (nextType === 'TRANSFER') {
      setCategoryId('');
      return;
    }

    setCategoryId(
      preferencesRef.current.categoryByType[nextType] ?? firstCategory(categories, nextType),
    );
    const rememberedAccount = preferencesRef.current.accountByType[nextType] ?? '';
    if (nextType === 'EXPENSE') {
      setFromAccountId(rememberedAccount);
    } else {
      setToAccountId(rememberedAccount);
    }
  }

  function selectCategory(nextCategoryId: string) {
    clearMessage();
    invalidateBudgets();
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
    invalidateBudgets();
    setFromAccountId(values.fromAccountId);
    setToAccountId(values.toAccountId);
    setDescription(values.description);
    setOccurredAt(values.occurredAt);
    setAgentOpen(false);
  }

  function buildSubmitValues(): QuickEntrySubmitValues {
    return {
      type,
      amount: evaluation.amount,
      currency,
      categoryId: type === 'TRANSFER' ? '' : categoryId,
      budgetId: type === 'TRANSFER' ? '' : budgetId,
      fromAccountId: type === 'INCOME' ? '' : fromAccountId,
      toAccountId: type === 'EXPENSE' ? '' : toAccountId,
      description,
      occurredAt,
    };
  }

  async function submit() {
    if (submitting) return;
    clearMessage();

    if (!evaluation.valid) {
      setError('请输入大于 0 的有效金额。');
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

    const values = buildSubmitValues();
    setSubmitting(true);
    try {
      const result = await onSubmit(values);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setExpression('');
      setAgentOpen(false);
      setFeedback(result.feedback);

      if (type !== 'TRANSFER') {
        const accountId = type === 'EXPENSE' ? fromAccountId : toAccountId;
        const accountByType = { ...preferencesRef.current.accountByType };
        if (accountId) accountByType[type] = accountId;
        else delete accountByType[type];
        const nextPreferences: QuickEntryPreferences = {
          categoryByType: {
            ...preferencesRef.current.categoryByType,
            [type]: categoryId,
          },
          accountByType,
        };
        preferencesRef.current = nextPreferences;
        try {
          window.localStorage.setItem(
            QUICK_ENTRY_PREFERENCES_KEY,
            serializeQuickEntryPreferences(nextPreferences),
          );
        } catch {
          // Storage can be unavailable in private browsing; the successful ledger write still stands.
        }
      }

      if (saveAsTemplate && templateName.trim()) {
        onSaveTemplate(templateName.trim(), values);
      }
    } catch {
      setError('记账失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
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
        disabled={submitting || !evaluation.valid}
        onClick={submit}
        className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] font-bold text-[var(--color-text-inverse)] disabled:opacity-50"
      >
        {submitting ? '记账中…' : '确认记账'}
      </button>
      <button type="button" onClick={() => setAgentOpen((open) => !open)} className="min-h-11 w-full">说一句记账</button>
      {error ? <div role="alert" className="text-sm text-ledger-danger">{error}</div> : null}
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
            <select aria-label="预算" value={budgetId} onChange={(event) => setBudgetId(event.target.value)} className={fieldClass}>
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
              invalidateBudgets();
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
