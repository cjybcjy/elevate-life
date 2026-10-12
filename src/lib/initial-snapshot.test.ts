import assert from 'node:assert/strict';
import { test } from 'node:test';
import Decimal from 'decimal.js';
import { initialSnapshot } from './initial-snapshot';

test('server snapshots match GET serialization for nested dates and database decimals', async () => {
  const data = [{
    id: 'goal', createdAt: new Date('2026-09-19T08:00:00.000Z'),
    asset: { balance: new Decimal('12345.6789') },
  }];
  const snapshot = await initialSnapshot(Promise.resolve({ success: true, data }), result => result.data);
  assert.deepEqual(snapshot, await Response.json(data).json());
  assert.deepEqual(snapshot, [{
    id: 'goal', createdAt: '2026-09-19T08:00:00.000Z', asset: { balance: '12345.6789' },
  }]);
});

test('failed server reads leave a missing fallback for client retry rather than an empty balance', async () => {
  assert.equal(await initialSnapshot(
    Promise.resolve({ success: false, error: 'expired session' }), () => ({ data: [] }),
  ), undefined);
  assert.equal(await initialSnapshot(Promise.reject(new Error('database unavailable')), () => []), undefined);
  assert.deepEqual(await initialSnapshot(Promise.resolve({ success: true, data: [] }), result => result.data), []);
});

test('a slow snapshot does not hold up independent reads or reuse another request snapshot', async () => {
  let resolveSlow!: (value: { success: boolean; data: string[] }) => void;
  const slow = initialSnapshot(new Promise<{ success: boolean; data: string[] }>(resolve => {
    resolveSlow = resolve;
  }), result => result.data);
  const fast = initialSnapshot(Promise.resolve({ success: true, data: ['second account'] }), result => result.data);
  assert.deepEqual(await fast, ['second account']);
  resolveSlow({ success: true, data: ['first account'] });
  assert.deepEqual(await slow, ['first account']);
});
