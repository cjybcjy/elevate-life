import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePossessionStatus,
  possessionDailyCost,
  possessionHeldDays,
} from './possession-metrics';

test('possessionHeldDays counts the purchase day and never returns zero', () => {
  assert.equal(
    possessionHeldDays('2026-07-01T00:00:00.000Z', null, new Date('2026-07-03T00:00:00.000Z')),
    3,
  );
  assert.equal(
    possessionHeldDays('2026-07-03T00:00:00.000Z', null, new Date('2026-07-03T00:00:00.000Z')),
    1,
  );
});

test('possessionDailyCost subtracts realized resale value', () => {
  assert.equal(
    possessionDailyCost({
      purchasePrice: 1000,
      purchaseDate: '2026-07-01T00:00:00.000Z',
      soldPrice: 400,
      soldDate: '2026-07-10T00:00:00.000Z',
    }),
    60,
  );
});

test('normalizePossessionStatus falls back to active', () => {
  assert.equal(normalizePossessionStatus('idle'), 'idle');
  assert.equal(normalizePossessionStatus('unknown'), 'active');
});
