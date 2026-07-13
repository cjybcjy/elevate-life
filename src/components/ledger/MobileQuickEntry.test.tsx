import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import MobileQuickEntry, {
  buildSuccessfulQuickEntryPreferenceSnapshots,
  buildQuickEntrySubmitValues,
  getQuickEntryAmountError,
  mergeSuccessfulQuickEntryPreferences,
  resolveQuickEntryPreferenceApplication,
  resolveQuickEntryBudgetId,
  resolveQuickEntryTypeSelection,
  saveQuickEntryTemplate,
  sanitizeQuickEntryPreferences,
} from './MobileQuickEntry';

const categories = [
  { id: 'food', name: '餐饮', type: 'EXPENSE' },
  { id: 'daily', name: '日用', type: 'EXPENSE' },
  { id: 'salary', name: '工资', type: 'INCOME' },
  { id: 'social-in', name: '人情往来', type: 'INCOME' },
];

test('mobile quick entry renders the approved single-screen hierarchy', () => {
  const markup = renderToString(
    <MobileQuickEntry
      categories={categories}
      assets={[{ id: 'cash', name: '现金' }]}
      loadBudgets={async () => []}
      onSubmit={async () => ({ success: true, feedback: '已记 ¥32 · 餐饮' })}
      onSaveTemplate={() => {}}
    />,
  );

  assert.match(markup, /data-mobile-quick-entry="true"/);
  assert.match(markup, /<h1[^>]*>记一笔<\/h1>/);
  assert.match(markup, /aria-label="交易类型"/);
  assert.match(markup, /aria-label="常用分类"/);
  assert.match(markup, /aria-label="金额键盘"/);
  assert.match(markup, /预算匹配中…/);
  assert.match(markup, />说一句记账<\/button>/);
  assert.match(markup, />更多选项<\/button>/);
});

test('unresolved budget matching exposes readable busy and status semantics', () => {
  const markup = renderToString(
    <MobileQuickEntry
      categories={categories}
      assets={[{ id: 'cash', name: '现金' }]}
      loadBudgets={async () => []}
      onSubmit={async () => ({ success: true, feedback: '已记 ¥32 · 餐饮' })}
      onSaveTemplate={() => {}}
    />,
  );

  assert.match(markup, /<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*>/);
  assert.match(markup, /<span[^>]*role="status"[^>]*aria-live="polite"[^>]*>预算匹配中…<\/span>/);
});

test('quick-entry preferences keep only matching categories and existing accounts', () => {
  assert.deepEqual(
    sanitizeQuickEntryPreferences({
      categoryByType: { EXPENSE: 'food', INCOME: 'food' },
      accountByType: { EXPENSE: 'cash', INCOME: 'missing' },
    }, categories, [{ id: 'cash', name: '现金' }]),
    {
      categoryByType: { EXPENSE: 'food' },
      accountByType: { EXPENSE: 'cash' },
    },
  );
});

test('submit values map accounts and category fields by transaction type', () => {
  const base = {
    amount: '32',
    currency: 'CNY',
    categoryId: 'food',
    budgetId: 'monthly-food',
    fromAccountId: 'cash',
    toAccountId: 'bank',
    description: '午饭',
    occurredAt: '2026-07-13',
  };

  assert.deepEqual(buildQuickEntrySubmitValues({ ...base, type: 'EXPENSE' }), {
    ...base,
    type: 'EXPENSE',
    toAccountId: '',
  });
  assert.deepEqual(buildQuickEntrySubmitValues({ ...base, type: 'INCOME' }), {
    ...base,
    type: 'INCOME',
    fromAccountId: '',
  });
  assert.deepEqual(buildQuickEntrySubmitValues({ ...base, type: 'TRANSFER' }), {
    ...base,
    type: 'TRANSFER',
    categoryId: '',
    budgetId: '',
  });
});

test('budget selection clears for zero or multiple options and selects exactly one', () => {
  assert.equal(resolveQuickEntryBudgetId([]), '');
  assert.equal(resolveQuickEntryBudgetId([{ id: 'only', name: '唯一预算' }]), 'only');
  assert.equal(resolveQuickEntryBudgetId([
    { id: 'first', name: '预算一' },
    { id: 'second', name: '预算二' },
  ]), '');
});

test('non-empty invalid amount expressions expose a responsive error', () => {
  const error = '请输入大于 0 的有效金额。';
  assert.equal(getQuickEntryAmountError(''), '');
  assert.equal(getQuickEntryAmountError('32'), '');
  assert.equal(getQuickEntryAmountError('0'), error);
  assert.equal(getQuickEntryAmountError('2-3'), error);
  assert.equal(getQuickEntryAmountError('12+'), error);
});

test('ready empty assets apply the category and discard a deleted account preference', () => {
  const stored = {
    categoryByType: { EXPENSE: 'daily' },
    accountByType: { EXPENSE: 'deleted' },
  };

  assert.deepEqual(resolveQuickEntryPreferenceApplication(
    stored,
    categories,
    [],
    { categoriesReady: true, assetsReady: true },
  ), {
    categoryReady: true,
    accountReady: true,
    complete: true,
    categoryByType: { EXPENSE: 'daily' },
    accountByType: {},
  });
});

test('category preferences can apply while account preferences still wait for assets', () => {
  assert.deepEqual(resolveQuickEntryPreferenceApplication(
    {
      categoryByType: { EXPENSE: 'daily' },
      accountByType: { EXPENSE: 'cash' },
    },
    categories,
    [],
    { categoriesReady: true, assetsReady: false },
  ), {
    categoryReady: true,
    accountReady: false,
    complete: false,
    categoryByType: { EXPENSE: 'daily' },
    accountByType: {},
  });
});

test('template save failures report partial failure after the ledger succeeds', () => {
  const values = buildQuickEntrySubmitValues({
    type: 'EXPENSE',
    amount: '32',
    currency: 'CNY',
    categoryId: 'food',
    budgetId: '',
    fromAccountId: 'cash',
    toAccountId: '',
    description: '午饭',
    occurredAt: '2026-07-13',
  });
  const error = saveQuickEntryTemplate(true, '午饭模板', values, () => {
    throw new Error('template unavailable');
  });

  assert.equal(error, '记账已成功，但模板保存失败。');
});

test('successful account clearing updates the canonical snapshot before late assets arrive', () => {
  const afterSuccess = mergeSuccessfulQuickEntryPreferences({
    categoryByType: { EXPENSE: 'daily', INCOME: 'salary' },
    accountByType: { EXPENSE: 'cash', INCOME: 'bank' },
  }, 'EXPENSE', 'daily', '');

  assert.deepEqual(afterSuccess, {
    categoryByType: { EXPENSE: 'daily', INCOME: 'salary' },
    accountByType: { INCOME: 'bank' },
  });
  assert.deepEqual(resolveQuickEntryPreferenceApplication(
    afterSuccess,
    categories,
    [{ id: 'cash', name: '现金' }, { id: 'bank', name: '银行卡' }],
    { categoriesReady: true, assetsReady: true },
  ), {
    categoryReady: true,
    accountReady: true,
    complete: true,
    categoryByType: { EXPENSE: 'daily', INCOME: 'salary' },
    accountByType: { INCOME: 'bank' },
  });
});

test('successful expense keeps pending raw income account out of active type selection', () => {
  const snapshots = buildSuccessfulQuickEntryPreferenceSnapshots(
    {
      categoryByType: { EXPENSE: 'daily', INCOME: 'salary' },
      accountByType: { EXPENSE: 'cash', INCOME: 'bank-old' },
    },
    {
      categoryByType: { EXPENSE: 'daily', INCOME: 'salary' },
      accountByType: { EXPENSE: 'cash' },
    },
    'EXPENSE',
    'daily',
    '',
  );

  assert.deepEqual(snapshots.storedPreferences.accountByType, { INCOME: 'bank-old' });
  assert.deepEqual(snapshots.activePreferences.accountByType, {});
  assert.deepEqual(
    resolveQuickEntryTypeSelection(snapshots.activePreferences, categories, 'INCOME'),
    { categoryId: 'salary', accountId: '' },
  );
  assert.deepEqual(resolveQuickEntryPreferenceApplication(
    snapshots.storedPreferences,
    categories,
    [{ id: 'bank-new', name: '新银行卡' }],
    { categoriesReady: true, assetsReady: true },
  ).accountByType, {});
});
