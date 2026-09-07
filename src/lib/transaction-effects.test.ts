import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTransactionEffectDeltas } from './transaction-effects';

function fixedDeltas(
  deltas: Array<{ id: string; delta: { toFixed: (digits: number) => string } }>,
) {
  return deltas.map((delta) => ({
    id: delta.id,
    delta: delta.delta.toFixed(4),
  }));
}

test('buildTransactionEffectDeltas only applies the income amount difference for the same target account', () => {
  const deltas = buildTransactionEffectDeltas(
    {
      type: 'INCOME',
      amount: '52000',
      fromAccountId: null,
      toAccountId: 'salary-account',
      liabilityId: null,
    },
    {
      type: 'INCOME',
      amount: '62800',
      fromAccountId: null,
      toAccountId: 'salary-account',
      liabilityId: null,
    },
  );

  assert.deepEqual(fixedDeltas(deltas.assetDeltas), [
    { id: 'salary-account', delta: '10800.0000' },
  ]);
  assert.deepEqual(deltas.liabilityDeltas, []);
});

test('buildTransactionEffectDeltas only deducts the expense difference for the same source account', () => {
  const deltas = buildTransactionEffectDeltas(
    {
      type: 'EXPENSE',
      amount: '52000',
      fromAccountId: 'cash-account',
      toAccountId: null,
      liabilityId: null,
    },
    {
      type: 'EXPENSE',
      amount: '62800',
      fromAccountId: 'cash-account',
      toAccountId: null,
      liabilityId: null,
    },
  );

  assert.deepEqual(fixedDeltas(deltas.assetDeltas), [
    { id: 'cash-account', delta: '-10800.0000' },
  ]);
  assert.deepEqual(deltas.liabilityDeltas, []);
});

test('drawdown edits increase both the receiving account and revolving balance', () => {
  const deltas = buildTransactionEffectDeltas(
    {
      type: 'LIABILITY_DRAW',
      amount: '2000',
      fromAccountId: null,
      toAccountId: 'cash-account',
      liabilityId: 'revolving-credit',
    },
    {
      type: 'LIABILITY_DRAW',
      amount: '3500',
      fromAccountId: null,
      toAccountId: 'cash-account',
      liabilityId: 'revolving-credit',
    },
  );

  assert.deepEqual(fixedDeltas(deltas.assetDeltas), [
    { id: 'cash-account', delta: '1500.0000' },
  ]);
  assert.deepEqual(fixedDeltas(deltas.liabilityDeltas), [
    { id: 'revolving-credit', delta: '1500.0000' },
  ]);
});

test('changing a drawdown into a repayment reverses the liability direction', () => {
  const deltas = buildTransactionEffectDeltas(
    {
      type: 'LIABILITY_DRAW',
      amount: '2000',
      fromAccountId: null,
      toAccountId: 'cash-account',
      liabilityId: 'revolving-credit',
    },
    {
      type: 'EXPENSE',
      amount: '500',
      fromAccountId: 'cash-account',
      toAccountId: null,
      liabilityId: 'revolving-credit',
    },
  );

  assert.deepEqual(fixedDeltas(deltas.assetDeltas), [
    { id: 'cash-account', delta: '-2500.0000' },
  ]);
  assert.deepEqual(fixedDeltas(deltas.liabilityDeltas), [
    { id: 'revolving-credit', delta: '-2500.0000' },
  ]);
});
