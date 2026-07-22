import assert from 'node:assert/strict';
import test from 'node:test';
import { selectTransactionBudgetId } from './transaction-budget';

test('an explicit budget always wins over automatic matching', () => {
  assert.equal(selectTransactionBudgetId({
    requestedBudgetId: 'manual-budget',
    type: 'EXPENSE',
    categoryId: 'food',
    candidates: [{ id: 'automatic-budget' }],
  }), 'manual-budget');
});

test('an expense is automatically linked only when one active category budget matches', () => {
  assert.equal(selectTransactionBudgetId({
    type: 'EXPENSE',
    categoryId: 'food',
    candidates: [{ id: 'food-budget' }],
  }), 'food-budget');
  assert.equal(selectTransactionBudgetId({
    type: 'EXPENSE',
    categoryId: 'food',
    candidates: [],
  }), undefined);
  assert.equal(selectTransactionBudgetId({
    type: 'EXPENSE',
    categoryId: 'food',
    candidates: [{ id: 'first' }, { id: 'second' }],
  }), undefined);
});

test('income, transfer, and uncategorized entries are never auto-linked to a budget', () => {
  for (const input of [
    { type: 'INCOME', categoryId: 'salary' },
    { type: 'TRANSFER', categoryId: undefined },
    { type: 'EXPENSE', categoryId: undefined },
  ]) {
    assert.equal(selectTransactionBudgetId({
      ...input,
      candidates: [{ id: 'budget' }],
    }), undefined);
  }
});
