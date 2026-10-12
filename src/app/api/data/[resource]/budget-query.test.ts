import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBudgetQuery } from './budget-query';

test('budget queries accept real dates and a bounded category identifier', () => {
  assert.deepEqual(parseBudgetQuery(new URLSearchParams({ date: '2024-02-29' }), false), {
    date: '2024-02-29', categoryId: '',
  });
  assert.deepEqual(parseBudgetQuery(new URLSearchParams({
    date: '2026-09-19', categoryId: 'ec71a81c-81f9-47ac-81e9-000000000001',
  }), true), { date: '2026-09-19', categoryId: 'ec71a81c-81f9-47ac-81e9-000000000001' });
});

test('budget queries reject missing, ambiguous and impossible dates', () => {
  for (const date of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-9-19', '2026-09-19T00:00:00Z']) {
    assert.deepEqual(parseBudgetQuery(new URLSearchParams({ date }), false), { error: 'Invalid date' });
  }
  assert.deepEqual(parseBudgetQuery(new URLSearchParams('date=2026-09-19&date=2026-09-20'), true), { error: 'Invalid date' });
});

test('category budget queries reject absent, oversized and malformed identifiers', () => {
  for (const categoryId of ['', ' ', ' category ', 'a/b', 'a&b', 'a'.repeat(129)]) {
    assert.deepEqual(parseBudgetQuery(new URLSearchParams({ date: '2026-09-19', categoryId }), true), { error: 'Invalid categoryId' });
  }
  assert.deepEqual(parseBudgetQuery(new URLSearchParams('date=2026-09-19&categoryId=a&categoryId=b'), true), { error: 'Invalid categoryId' });
});
