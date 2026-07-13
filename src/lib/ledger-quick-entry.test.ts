import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAmountKey,
  buildLedgerCreateFormValues,
  buildQuickEntryFeedback,
  evaluateAmountExpression,
  parseQuickEntryPreferences,
  partitionQuickEntryCategories,
  serializeQuickEntryPreferences,
} from './ledger-quick-entry';
import * as ledgerQuickEntry from './ledger-quick-entry';

test('buildLedgerCreateFormValues maps an agent draft into the existing create form', () => {
  assert.deepEqual(
    buildLedgerCreateFormValues({
      type: 'EXPENSE',
      amount: '32',
      currency: 'CNY',
      categoryId: 'cat-food',
      fromAccountId: 'asset-cash',
      toAccountId: '',
      description: '今天午饭 用现金',
      occurredAt: '2026-07-11',
      confidence: 0.86,
      notes: ['已识别金额、日期、分类和来源账户'],
    }),
    {
      type: 'EXPENSE',
      amount: '32',
      currency: 'CNY',
      categoryId: 'cat-food',
      budgetId: '',
      fromAccountId: 'asset-cash',
      toAccountId: '',
      description: '今天午饭 用现金',
      occurredAt: '2026-07-11',
    },
  );
});

test('refreshLedgerCaches treats a rejected post-success cache refresh as soft', async () => {
  const refreshLedgerCaches = (ledgerQuickEntry as {
    refreshLedgerCaches?: (mutate: (key: unknown) => Promise<unknown>) => Promise<unknown>;
  }).refreshLedgerCaches;
  assert.equal(typeof refreshLedgerCaches, 'function');

  const requested: unknown[] = [];
  await refreshLedgerCaches!(async (key) => {
    requested.push(key);
    if (key === 'assets') throw new Error('refresh failed');
    return undefined;
  });

  assert.equal(requested.length, 3);
  assert.equal(requested[0], 'transactions');
  assert.equal(requested[1], 'assets');
  assert.equal(typeof requested[2], 'function');
});

test('withLedgerLoading always clears loading when work rejects', async () => {
  const withLedgerLoading = (ledgerQuickEntry as {
    withLedgerLoading?: <T>(setLoading: (loading: boolean) => void, work: () => Promise<T>) => Promise<T>;
  }).withLedgerLoading;
  assert.equal(typeof withLedgerLoading, 'function');

  const states: boolean[] = [];
  await assert.rejects(
    withLedgerLoading!((loading) => states.push(loading), async () => {
      throw new Error('write failed');
    }),
    /write failed/,
  );
  assert.deepEqual(states, [true, false]);
});

test('expense categories use approved order and reserve the eighth cell for 更多', () => {
  const categories = [
    ['extra', '其他', 'EXPENSE'], ['social-in', '人情往来', 'INCOME'],
    ['travel', '旅行', 'EXPENSE'], ['quality', '提升品质', 'EXPENSE'],
    ['daily', '日用', 'EXPENSE'], ['fixed', '固定支出', 'EXPENSE'],
    ['medical', '医疗', 'EXPENSE'], ['transit', '交通', 'EXPENSE'],
    ['rent', '房租', 'EXPENSE'], ['food', '餐饮', 'EXPENSE'],
    ['social-out', '人情往来', 'EXPENSE'],
  ].map(([id, name, type]) => ({ id, name, type }));
  const result = partitionQuickEntryCategories(categories, 'EXPENSE');
  assert.deepEqual(result.primary.map((item) => item.name), [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质',
  ]);
  assert.deepEqual(result.all.map((item) => item.name), [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来', '其他',
  ]);
});

test('income 人情往来 never resolves to the expense record', () => {
  const result = partitionQuickEntryCategories([
    { id: 'expense-social', name: '人情往来', type: 'EXPENSE' },
    { id: 'income-social', name: '人情往来', type: 'INCOME' },
    { id: 'salary', name: '工资', type: 'INCOME' },
  ], 'INCOME');
  assert.deepEqual(result.primary.map((item) => item.id), ['salary', 'income-social']);
});

test('amount keypad evaluates simple addition and subtraction without eval', () => {
  let expression = '';
  for (const key of ['2', '8', '+', '6', '-', '4'] as const) expression = applyAmountKey(expression, key);
  assert.deepEqual(evaluateAmountExpression(expression), { valid: true, amount: '30', result: 30 });
});

test('amount keypad blocks a third decimal and rejects zero or trailing operators', () => {
  assert.equal(applyAmountKey('12.34', '5'), '12.34');
  assert.equal(evaluateAmountExpression('0').valid, false);
  assert.equal(evaluateAmountExpression('12+').valid, false);
});

test('amount keypad supports backspace and replaces a trailing operator', () => {
  assert.equal(applyAmountKey('12.3', 'backspace'), '12.');
  assert.equal(applyAmountKey('12+', '-'), '12-');
});

test('amount keypad rejects operators after a trailing decimal without blocking completion', () => {
  assert.equal(applyAmountKey('12.', '+'), '12.');
  assert.equal(applyAmountKey('12.', '-'), '12.');
  assert.equal(applyAmountKey(applyAmountKey('12.', '+'), '3'), '12.3');
});

test('amount expression rejects zero and negative results after calculation', () => {
  assert.equal(evaluateAmountExpression('2-2').valid, false);
  assert.equal(evaluateAmountExpression('2-3').valid, false);
});

test('quick-entry preferences tolerate invalid storage and round trip valid values', () => {
  assert.deepEqual(parseQuickEntryPreferences('{bad'), { categoryByType: {}, accountByType: {} });
  const preferences = {
    categoryByType: { EXPENSE: 'food', INCOME: 'salary' },
    accountByType: { EXPENSE: 'cash', INCOME: 'bank' },
  };
  assert.deepEqual(parseQuickEntryPreferences(serializeQuickEntryPreferences(preferences)), preferences);
});

test('quick-entry preferences discard damaged structures and return independent fallbacks', () => {
  assert.deepEqual(parseQuickEntryPreferences(JSON.stringify({
    categoryByType: { EXPENSE: 42, INCOME: 'salary', TRANSFER: 'ignored' },
    accountByType: ['cash'],
  })), {
    categoryByType: { INCOME: 'salary' },
    accountByType: {},
  });
  assert.deepEqual(parseQuickEntryPreferences(JSON.stringify({
    categoryByType: null,
    accountByType: { EXPENSE: 'cash', INCOME: false, TRANSFER: 'ignored' },
  })), {
    categoryByType: {},
    accountByType: { EXPENSE: 'cash' },
  });

  const firstFallback = parseQuickEntryPreferences('{bad');
  firstFallback.categoryByType.EXPENSE = 'mutated';
  const secondFallback = parseQuickEntryPreferences('{still bad');
  assert.notEqual(secondFallback, firstFallback);
  assert.notEqual(secondFallback.categoryByType, firstFallback.categoryByType);
  assert.deepEqual(secondFallback, { categoryByType: {}, accountByType: {} });
  assert.deepEqual(parseQuickEntryPreferences('null'), { categoryByType: {}, accountByType: {} });
  assert.deepEqual(parseQuickEntryPreferences('42'), { categoryByType: {}, accountByType: {} });
  assert.deepEqual(parseQuickEntryPreferences('[]'), { categoryByType: {}, accountByType: {} });
});

test('feedback includes budget remaining only when available', () => {
  assert.equal(buildQuickEntryFeedback({ amount: '32', currency: 'CNY', categoryName: '餐饮' }), '已记 ¥32 · 餐饮');
  assert.equal(
    buildQuickEntryFeedback({ amount: '32', currency: 'CNY', categoryName: '餐饮', budgetRemaining: 568 }),
    '已记 ¥32 · 餐饮预算还剩 ¥568',
  );
});

test('budget remaining lookup treats a rejected loader as unavailable feedback', async () => {
  const getQuickEntryBudgetRemainingSafely = (ledgerQuickEntry as {
    getQuickEntryBudgetRemainingSafely?: (
      budgetId: string,
      loader: () => Promise<{
        success: boolean;
        data?: Array<{ id: string; remaining: number }>;
      }>,
    ) => Promise<number | undefined>;
  }).getQuickEntryBudgetRemainingSafely;
  assert.equal(typeof getQuickEntryBudgetRemainingSafely, 'function');

  const remaining = await getQuickEntryBudgetRemainingSafely!('food-budget', async () => {
    throw new Error('budget lookup unavailable');
  });

  assert.equal(remaining, undefined);
});

test('budget remaining lookup skips the loader without a budget id', async () => {
  const getQuickEntryBudgetRemainingSafely = (ledgerQuickEntry as {
    getQuickEntryBudgetRemainingSafely?: (
      budgetId: string,
      loader: () => Promise<{ success: boolean }>,
    ) => Promise<number | undefined>;
  }).getQuickEntryBudgetRemainingSafely;
  assert.equal(typeof getQuickEntryBudgetRemainingSafely, 'function');

  let calls = 0;
  const remaining = await getQuickEntryBudgetRemainingSafely!('', async () => {
    calls += 1;
    return { success: true };
  });

  assert.equal(calls, 0);
  assert.equal(remaining, undefined);
});

test('budget remaining lookup returns only the matching successful item', async () => {
  const getQuickEntryBudgetRemainingSafely = (ledgerQuickEntry as {
    getQuickEntryBudgetRemainingSafely?: (
      budgetId: string,
      loader: () => Promise<{
        success: boolean;
        data?: Array<{ id: string; remaining: number }>;
      }>,
    ) => Promise<number | undefined>;
  }).getQuickEntryBudgetRemainingSafely;
  assert.equal(typeof getQuickEntryBudgetRemainingSafely, 'function');

  assert.equal(await getQuickEntryBudgetRemainingSafely!('food-budget', async () => ({
    success: true,
    data: [
      { id: 'travel-budget', remaining: 200 },
      { id: 'food-budget', remaining: 568 },
    ],
  })), 568);
  assert.equal(await getQuickEntryBudgetRemainingSafely!('missing-budget', async () => ({
    success: true,
    data: [{ id: 'food-budget', remaining: 568 }],
  })), undefined);
  assert.equal(await getQuickEntryBudgetRemainingSafely!('food-budget', async () => ({
    success: false,
  })), undefined);
});
