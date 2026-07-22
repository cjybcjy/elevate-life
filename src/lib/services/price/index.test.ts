import assert from 'node:assert/strict';
import test from 'node:test';

import { isStale } from './index';

test('A-share prices are stale after a short delay during trading hours', () => {
  const duringTrading = new Date('2026-07-03T02:08:00.000Z'); // 10:08 Beijing time, Friday
  const cachedAt = new Date('2026-07-03T01:41:00.000Z'); // 09:41 Beijing time

  assert.equal(isStale(cachedAt, 'cn', duringTrading), true);
});

test('non-trading-hour prices keep the slower stale window', () => {
  const afterClose = new Date('2026-07-03T08:30:00.000Z'); // 16:30 Beijing time, Friday
  const cachedAt = new Date('2026-07-03T08:05:00.000Z');

  assert.equal(isStale(cachedAt, 'cn', afterClose), false);
});
