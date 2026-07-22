import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetIncludesExpense } from './budget-progress';

const startDate = new Date('2026-01-01T00:00:00.000Z');
const endDate = new Date('2026-12-31T23:59:59.999Z');

test('annual total budget includes every expense in its date range', () => {
  assert.equal(budgetIncludesExpense(
    { id: 'annual', categoryId: null, startDate, endDate },
    {
      budgetId: 'food-budget',
      categoryId: 'food',
      occurredAt: new Date('2026-07-13T00:00:00.000Z'),
    },
  ), true);
});

test('category budget includes explicit links and unlinked matching categories only', () => {
  const budget = { id: 'food-budget', categoryId: 'food', startDate, endDate };
  assert.equal(budgetIncludesExpense(budget, {
    budgetId: 'food-budget',
    categoryId: 'other',
    occurredAt: new Date('2026-07-13T00:00:00.000Z'),
  }), true);
  assert.equal(budgetIncludesExpense(budget, {
    budgetId: null,
    categoryId: 'food',
    occurredAt: new Date('2026-07-13T00:00:00.000Z'),
  }), true);
  assert.equal(budgetIncludesExpense(budget, {
    budgetId: 'other-budget',
    categoryId: 'food',
    occurredAt: new Date('2026-07-13T00:00:00.000Z'),
  }), false);
});
