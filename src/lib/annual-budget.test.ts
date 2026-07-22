import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnnualBudgetOverview,
  findAnnualBudget,
  getEffectiveBudgetRemaining,
  getLivingBudgetTransactions,
  LIVING_BUDGET_COLOR,
} from './annual-budget';

const progress = [
  {
    id: 'annual',
    name: '年度预算',
    categoryId: null,
    categoryName: '总计',
    budgetAmount: 120_000,
    spent: 35_000,
    remaining: 85_000,
    pct: 29.17,
    isOverBudget: false,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
  {
    id: 'education',
    name: '教育预算',
    categoryId: 'education-category',
    categoryName: '教育',
    categoryColor: '#8b5cf6',
    budgetAmount: 30_000,
    spent: 10_000,
    remaining: 20_000,
    pct: 33.33,
    isOverBudget: false,
  },
  {
    id: 'travel',
    name: '旅行预算',
    categoryId: 'travel-category',
    categoryName: '旅行',
    budgetAmount: 20_000,
    spent: 5_000,
    remaining: 15_000,
    pct: 25,
    isOverBudget: false,
  },
];

test('findAnnualBudget selects the total budget with an annual range', () => {
  assert.equal(findAnnualBudget(progress)?.id, 'annual');
});

test('buildAnnualBudgetOverview assigns the unallocated annual amount to living budget', () => {
  const overview = buildAnnualBudgetOverview(progress);
  assert.ok(overview);
  assert.equal(overview.annualAmount, 120_000);
  assert.equal(overview.segments.length, 3);
  assert.deepEqual(overview.segments.map((segment) => segment.name), [
    '教育预算',
    '旅行预算',
    '生活预算',
  ]);
  const living = overview.segments[2];
  assert.equal(living.budgetAmount, 70_000);
  assert.equal(living.spent, 20_000);
  assert.equal(living.remaining, 50_000);
  assert.equal(living.sharePercent, 70_000 / 1_200);
  assert.equal(living.color, LIVING_BUDGET_COLOR);
  assert.equal(overview.segments.reduce((sum, segment) => sum + segment.visualAmount, 0), 120_000);
});

test('buildAnnualBudgetOverview normalizes over-allocation back to the annual total', () => {
  const overview = buildAnnualBudgetOverview([
    progress[0],
    { ...progress[1], budgetAmount: 90_000 },
    { ...progress[2], budgetAmount: 60_000 },
  ]);
  assert.ok(overview);
  assert.equal(overview.overAllocatedAmount, 30_000);
  assert.equal(overview.segments.some((segment) => segment.isLiving), false);
  assert.equal(overview.segments.reduce((sum, segment) => sum + segment.visualAmount, 0), 120_000);
});

test('getEffectiveBudgetRemaining avoids double-counting child budgets', () => {
  assert.equal(getEffectiveBudgetRemaining(progress), 85_000);
});

test('living budget details include annual residual expenses but exclude category budget expenses', () => {
  const scopedProgress = [
    progress[0],
    {
      ...progress[1],
      id: 'food-budget',
      categoryId: 'food',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
  ];
  const transactions = [
    { id: 'manual-living', type: 'EXPENSE', budgetId: 'annual', categoryId: null, occurredAt: '2026-07-17' },
    { id: 'manual-living-categorized', type: 'EXPENSE', budgetId: 'annual', categoryId: 'food', occurredAt: '2026-07-17' },
    { id: 'uncategorized', type: 'EXPENSE', budgetId: null, categoryId: null, occurredAt: '2026-07-16' },
    { id: 'food-linked', type: 'EXPENSE', budgetId: 'food-budget', categoryId: 'food', occurredAt: '2026-07-15' },
    { id: 'food-auto', type: 'EXPENSE', budgetId: null, categoryId: 'food', occurredAt: '2026-07-14' },
    { id: 'income', type: 'INCOME', budgetId: null, categoryId: null, occurredAt: '2026-07-13' },
    { id: 'outside-year', type: 'EXPENSE', budgetId: null, categoryId: null, occurredAt: '2027-01-01' },
  ];

  assert.deepEqual(
    getLivingBudgetTransactions(scopedProgress, transactions).map(transaction => transaction.id),
    ['manual-living', 'manual-living-categorized', 'uncategorized'],
  );
});
