import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLedgerCreateFormValues } from './ledger-quick-entry';
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
