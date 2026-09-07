import assert from 'node:assert/strict';
import test from 'node:test';

import { isStale, runWithConcurrency } from './index';

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

test('price refresh tasks overlap without exceeding the concurrency limit', async () => {
  const started: number[] = [];
  const releases = new Map<number, () => void>();
  let active = 0;
  let maxActive = 0;
  let notifyFirstWave: (() => void) | undefined;
  let notifySecondWave: (() => void) | undefined;
  const firstWaveStarted = new Promise<void>((resolve) => {
    notifyFirstWave = resolve;
  });
  const secondWaveStarted = new Promise<void>((resolve) => {
    notifySecondWave = resolve;
  });

  const pending = runWithConcurrency([1, 2, 3], 2, async (item) => {
    started.push(item);
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (started.length === 2) notifyFirstWave?.();
    if (started.length === 3) notifySecondWave?.();

    await new Promise<void>((resolve) => {
      releases.set(item, resolve);
    });
    active -= 1;
  });

  await firstWaveStarted;
  assert.deepEqual(started, [1, 2]);
  assert.equal(maxActive, 2);

  releases.get(1)?.();
  await secondWaveStarted;
  assert.deepEqual(started, [1, 2, 3]);
  assert.equal(maxActive, 2);

  releases.get(2)?.();
  releases.get(3)?.();
  await pending;
});
