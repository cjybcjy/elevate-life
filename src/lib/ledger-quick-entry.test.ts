import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLedgerCreateFormValues } from './ledger-quick-entry';

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
