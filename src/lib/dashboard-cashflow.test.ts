import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardMonthlyCashflow } from './dashboard-cashflow';

const cnyRates = { CNY: 1, USD: 7.2, HKD: 0.92, JPY: 0.048 };

test('fills all 12 months in order across a year boundary, including empty months', () => {
  const result = buildDashboardMonthlyCashflow({
    transactions: [], cnyRates, year: 2026, month: 2,
  });

  assert.deepEqual(result.months, ['3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月']);
  assert.deepEqual(result.incomeData, Array(12).fill(0));
  assert.deepEqual(result.expenseData, Array(12).fill(0));
});

test('assigns UTC timestamps to Beijing months, excluding records outside the 12-month window', () => {
  const result = buildDashboardMonthlyCashflow({
    transactions: [
      { type: 'INCOME', occurredAt: '2024-12-31T15:59:59.999Z', amount: '1000' },
      { type: 'INCOME', occurredAt: '2024-12-31T16:00:00.000Z', amount: '10' },
      { type: 'EXPENSE', occurredAt: '2025-01-31T15:59:59.999Z', amount: '2' },
      { type: 'EXPENSE', occurredAt: '2025-01-31T16:00:00.000Z', amount: '3' },
      { type: 'INCOME', occurredAt: '2025-12-31T15:59:59.999Z', amount: '20' },
      { type: 'INCOME', occurredAt: '2025-12-31T16:00:00.000Z', amount: '2000' },
    ],
    cnyRates, year: 2025, month: 12,
  });

  assert.deepEqual(result.incomeData, [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20]);
  assert.deepEqual(result.expenseData, [2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('normalizes zone-free UTC strings and Date values at a leap-day month boundary', () => {
  const result = buildDashboardMonthlyCashflow({
    transactions: [
      { type: 'income', occurredAt: '2024-02-29T15:59:59.999', amount: 10 },
      { type: 'income', occurredAt: new Date('2024-02-29T16:00:00.000Z'), amount: 20 },
      { type: 'expense', occurredAt: 'invalid-date', amount: 1000 },
    ],
    cnyRates, year: 2024, month: 3,
  });

  assert.equal(result.incomeData[10], 10);
  assert.equal(result.incomeData[11], 20);
  assert.equal(result.expenseData.reduce((sum, value) => sum + value, 0), 0);
});

test('keeps income and expenses separate, converts each currency, and excludes transfers', () => {
  const occurredAt = '2026-09-10T00:00:00.000Z';
  const result = buildDashboardMonthlyCashflow({
    transactions: [
      { type: 'INCOME', occurredAt, amount: '100', currency: 'USD' },
      { type: 'income', occurredAt, amount: '100', currency: 'HKD' },
      { type: 'INCOME', occurredAt, amount: '100', currency: 'JPY' },
      { type: 'income', occurredAt, amount: '10', currency: null },
      { type: 'INCOME', occurredAt, amount: '20', currency: 'unknown' },
      { type: 'EXPENSE', occurredAt, amount: '50.25', currency: 'CNY' },
      { type: 'expense', occurredAt, amount: '-2.25' },
      { type: 'EXPENSE', occurredAt, amount: null },
      { type: 'TRANSFER', occurredAt, amount: '999999' },
      { type: 'transfer', occurredAt, amount: '999999' },
    ],
    cnyRates, year: 2026, month: 9,
  });

  assert.equal(result.incomeData[11], 846.8);
  assert.equal(result.expenseData[11], 48);
  assert.equal(result.incomeData.slice(0, 11).reduce((sum, value) => sum + value, 0), 0);
});
