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
      amount: '52000',
      fromAccountId: null,
      toAccountId: 'salary-account',
      liabilityId: null,
    },
    {
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
      amount: '52000',
      fromAccountId: 'cash-account',
      toAccountId: null,
      liabilityId: null,
    },
    {
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
