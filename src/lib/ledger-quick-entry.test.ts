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

test('budget resolution uses type, category, and date as one stable request key', () => {
  const buildQuickEntryBudgetKey = (ledgerQuickEntry as {
    buildQuickEntryBudgetKey?: (type: string, categoryId: string, occurredAt: string) => string;
  }).buildQuickEntryBudgetKey;
  assert.equal(typeof buildQuickEntryBudgetKey, 'function');

  assert.equal(
    buildQuickEntryBudgetKey!('EXPENSE', 'food', '2026-07-13'),
    'EXPENSE:food:2026-07-13',
  );
  assert.equal(buildQuickEntryBudgetKey!('TRANSFER', 'food', '2026-07-13'), '');
  assert.equal(buildQuickEntryBudgetKey!('EXPENSE', '', '2026-07-13'), '');
});

test('a different budget key clears stale options and remains unresolved', () => {
  const beginQuickEntryBudgetResolution = (ledgerQuickEntry as {
    beginQuickEntryBudgetResolution?: (
      state: { key: string; resolvedKey: string; options: Array<{ id: string; name: string }>; budgetId: string },
      key: string,
    ) => { key: string; resolvedKey: string; options: Array<{ id: string; name: string }>; budgetId: string };
  }).beginQuickEntryBudgetResolution;
  const isQuickEntryBudgetResolved = (ledgerQuickEntry as {
    isQuickEntryBudgetResolved?: (key: string, resolvedKey: string) => boolean;
  }).isQuickEntryBudgetResolved;
  assert.equal(typeof beginQuickEntryBudgetResolution, 'function');
  assert.equal(typeof isQuickEntryBudgetResolved, 'function');

  const next = beginQuickEntryBudgetResolution!({
    key: 'EXPENSE:food:2026-07-13',
    resolvedKey: 'EXPENSE:food:2026-07-13',
    options: [{ id: 'food-budget', name: '餐饮预算' }],
    budgetId: 'food-budget',
  }, 'EXPENSE:food:2026-07-14');

  assert.deepEqual(next, {
    key: 'EXPENSE:food:2026-07-14',
    resolvedKey: '',
    options: [],
    budgetId: '',
  });
  assert.equal(isQuickEntryBudgetResolved!('EXPENSE:food:2026-07-14', next.resolvedKey), false);
});

test('the same resolved budget key preserves selection and skips a redundant reset', () => {
  const beginQuickEntryBudgetResolution = (ledgerQuickEntry as {
    beginQuickEntryBudgetResolution?: <T>(state: T, key: string) => T;
  }).beginQuickEntryBudgetResolution;
  assert.equal(typeof beginQuickEntryBudgetResolution, 'function');

  const resolved = {
    key: 'EXPENSE:food:2026-07-13',
    resolvedKey: 'EXPENSE:food:2026-07-13',
    options: [{ id: 'food-budget', name: '餐饮预算' }],
    budgetId: 'food-budget',
  };
  assert.equal(beginQuickEntryBudgetResolution!(resolved, resolved.key), resolved);
});

test('only the current budget request may resolve state and auto-select one result', () => {
  const completeQuickEntryBudgetResolution = (ledgerQuickEntry as {
    completeQuickEntryBudgetResolution?: (
      state: { key: string; resolvedKey: string; options: Array<{ id: string; name: string }>; budgetId: string },
      key: string,
      options: Array<{ id: string; name: string }>,
    ) => { key: string; resolvedKey: string; options: Array<{ id: string; name: string }>; budgetId: string };
  }).completeQuickEntryBudgetResolution;
  assert.equal(typeof completeQuickEntryBudgetResolution, 'function');

  const pending = {
    key: 'EXPENSE:food:2026-07-14',
    resolvedKey: '',
    options: [] as Array<{ id: string; name: string }>,
    budgetId: '',
  };
  const stale = completeQuickEntryBudgetResolution!(pending, 'EXPENSE:food:2026-07-13', [
    { id: 'stale-budget', name: '旧预算' },
  ]);
  assert.equal(stale, pending);

  assert.deepEqual(completeQuickEntryBudgetResolution!(pending, pending.key, [
    { id: 'food-budget', name: '餐饮预算' },
  ]), {
    key: pending.key,
    resolvedKey: pending.key,
    options: [{ id: 'food-budget', name: '餐饮预算' }],
    budgetId: 'food-budget',
  });
  assert.equal(completeQuickEntryBudgetResolution!(pending, pending.key, []).budgetId, '');
  assert.equal(completeQuickEntryBudgetResolution!(pending, pending.key, [
    { id: 'one', name: '预算一' },
    { id: 'two', name: '预算二' },
  ]).budgetId, '');
});

test('query-gated create flow overrides a stale recurring tab selection', () => {
  const resolveLedgerTabSelection = (ledgerQuickEntry as {
    resolveLedgerTabSelection?: (input: {
      selectedTab: 'transactions' | 'recurring' | null;
      storedTab: 'transactions' | 'recurring';
      forceTransactions: boolean;
    }) => 'transactions' | 'recurring';
  }).resolveLedgerTabSelection;
  assert.equal(typeof resolveLedgerTabSelection, 'function');

  assert.equal(resolveLedgerTabSelection!({
    selectedTab: 'recurring',
    storedTab: 'recurring',
    forceTransactions: true,
  }), 'transactions');
  assert.equal(resolveLedgerTabSelection!({
    selectedTab: 'recurring',
    storedTab: 'transactions',
    forceTransactions: false,
  }), 'recurring');
});

test('template persistence reports successful localStorage writes', () => {
  const persistLedgerTemplates = (ledgerQuickEntry as {
    persistLedgerTemplates?: (
      storage: { setItem: (key: string, value: string) => void },
      templates: unknown[],
    ) => boolean;
  }).persistLedgerTemplates;
  assert.equal(typeof persistLedgerTemplates, 'function');

  const writes: Array<[string, string]> = [];
  const success = persistLedgerTemplates!({
    setItem(key, value) {
      writes.push([key, value]);
    },
  }, [{ name: '午饭模板' }]);

  assert.equal(success, true);
  assert.deepEqual(writes, [['ledger-templates', '[{"name":"午饭模板"}]']]);
});

test('template persistence returns false when localStorage rejects the write', () => {
  const persistLedgerTemplates = (ledgerQuickEntry as {
    persistLedgerTemplates?: (
      storage: { setItem: (key: string, value: string) => void },
      templates: unknown[],
    ) => boolean;
  }).persistLedgerTemplates;
  assert.equal(typeof persistLedgerTemplates, 'function');

  assert.equal(persistLedgerTemplates!({
    setItem() {
      throw new Error('quota exceeded');
    },
  }, [{ name: '午饭模板' }]), false);
});

test('session-expired matching covers unauthorized and encrypted-session failures only', () => {
  const isSessionExpiredError = (ledgerQuickEntry as {
    isSessionExpiredError?: (error: unknown) => boolean;
  }).isSessionExpiredError;
  assert.equal(typeof isSessionExpiredError, 'function');

  assert.equal(isSessionExpiredError!('Unauthorized'), true);
  assert.equal(isSessionExpiredError!('会话密钥已过期，请退出重新登录'), true);
  assert.equal(isSessionExpiredError!('请选择分类。'), false);
});
