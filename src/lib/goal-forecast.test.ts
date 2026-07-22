import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoalContributionPlan,
  buildProjectedAvailableCash,
} from './goal-forecast';

test('goal contribution plan includes only concrete transfers into a uniquely linked goal asset', () => {
  const plan = buildGoalContributionPlan({
    months: ['2026-08', '2026-09', '2026-10'],
    goals: [
      { id: 'emergency', name: '家庭应急金', assetId: 'asset-emergency', color: '#16a34a' },
      { id: 'education', name: '教育金', assetId: 'asset-education', color: '#2563eb' },
    ],
    rules: [
      {
        id: 'emergency-rule',
        type: 'TRANSFER',
        amount: 3_000,
        toAccountId: 'asset-emergency',
        frequency: 'monthly',
        interval: 1,
        nextDueDate: '2026-08-15',
        isActive: true,
      },
      {
        id: 'ordinary-expense',
        type: 'EXPENSE',
        amount: 2_000,
        toAccountId: 'asset-education',
        frequency: 'monthly',
        interval: 1,
        nextDueDate: '2026-08-10',
        isActive: true,
      },
    ],
  });

  assert.deepEqual(plan.events.map((event) => event.date), ['2026-08-15', '2026-09-15', '2026-10-15']);
  assert.equal(plan.total, 9_000);
  assert.equal(plan.averageMonthly, 3_000);
  assert.equal(plan.monthlyByGoal.emergency, 3_000);
  assert.equal(plan.monthlyByGoal.education, 0);
});

test('goal contribution plan preserves the intended monthly date at month end', () => {
  const plan = buildGoalContributionPlan({
    months: ['2026-01', '2026-02', '2026-03'],
    goals: [{ id: 'travel', name: '旅行金', assetId: 'asset-travel' }],
    rules: [{
      id: 'travel-rule',
      type: 'TRANSFER',
      amount: 1_000,
      toAccountId: 'asset-travel',
      frequency: 'monthly',
      interval: 1,
      nextDueDate: '2026-01-31',
      isActive: true,
    }],
  });

  assert.deepEqual(plan.events.map((event) => event.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('shared goal assets are not treated as attributable contribution events', () => {
  const plan = buildGoalContributionPlan({
    months: ['2026-08'],
    goals: [
      { id: 'a', name: '目标 A', assetId: 'shared' },
      { id: 'b', name: '目标 B', assetId: 'shared' },
    ],
    rules: [{
      id: 'shared-rule',
      type: 'TRANSFER',
      amount: 1_000,
      toAccountId: 'shared',
      frequency: 'monthly',
      interval: 1,
      nextDueDate: '2026-08-01',
      isActive: true,
    }],
  });

  assert.equal(plan.events.length, 0);
  assert.equal(plan.total, 0);
});

test('projected available cash deducts contribution events cumulatively', () => {
  const projected = buildProjectedAvailableCash({
    months: ['2026-08', '2026-09', '2026-10'],
    cumulative: [5_000, 10_000, 15_000],
    currentCash: 50_000,
    events: [
      { id: 'a', date: '2026-08-10', month: '2026-08', goalId: 'g', goalName: '教育金', amount: 2_000 },
      { id: 'b', date: '2026-09-10', month: '2026-09', goalId: 'g', goalName: '教育金', amount: 2_000 },
    ],
  });

  assert.deepEqual(projected, [53_000, 56_000, 61_000]);
});
