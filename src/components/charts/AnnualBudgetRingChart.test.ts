import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildAnnualBudgetOverview, USED_BUDGET_COLOR } from '@/lib/annual-budget';
import AnnualBudgetRingChart, {
  buildAnnualBudgetExecutionRows,
  buildAnnualBudgetRingSeries,
} from './AnnualBudgetRingChart';

test('annual budget ring keeps colored allocations and overlays used portions in grey', () => {
  const overview = buildAnnualBudgetOverview([
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
      categoryId: 'education',
      categoryName: '教育',
      budgetAmount: 30_000,
      spent: 10_000,
      remaining: 20_000,
      pct: 33.33,
      isOverBudget: false,
    },
  ]);
  assert.ok(overview);
  const { compositionData, usedOverlayData } = buildAnnualBudgetRingSeries(overview, '#ffffff');
  const allocations = compositionData.filter((item) => item.phase === 'budget');
  const gaps = compositionData.filter((item) => item.phase === 'gap');
  const used = usedOverlayData.filter((item) => item.phase === 'used');

  assert.equal(allocations.reduce((sum, item) => sum + item.value, 0), 120_000);
  assert.deepEqual(allocations.map((item) => item.name), ['教育预算', '生活预算']);
  assert.equal(gaps.length, 2);
  assert.equal(used.length, 2);
  assert.equal(used[0].value, 10_000);
  assert.equal(used[0].itemStyle.color, USED_BUDGET_COLOR);
  assert.equal(used[1].value, 25_000);
});

test('annual budget execution rows merge allocation and progress details', () => {
  const overview = buildAnnualBudgetOverview([
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
      categoryId: 'education',
      categoryName: '教育',
      budgetAmount: 30_000,
      spent: 10_000,
      remaining: 20_000,
      pct: 33.33,
      isOverBudget: false,
    },
  ]);
  assert.ok(overview);

  const rows = buildAnnualBudgetExecutionRows(overview);
  assert.deepEqual(rows.map((row) => row.name), ['教育预算', '生活预算']);
  assert.equal(rows[0].sharePercent, 25);
  assert.equal(rows[0].usedPercent.toFixed(1), '33.3');
  assert.equal(rows[0].remaining, 20_000);
  assert.equal(rows[1].spent, 25_000);
  assert.equal(rows[1].remaining, 65_000);
});

test('annual budget execution gives every item an inline detail button without a bottom action', () => {
  const overview = buildAnnualBudgetOverview([
    {
      id: 'annual',
      name: '年度预算',
      categoryId: null,
      categoryName: '总计',
      budgetAmount: 120_000,
      spent: 10_000,
      remaining: 110_000,
      pct: 8.33,
      isOverBudget: false,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
    {
      id: 'education',
      name: '教育预算',
      categoryId: 'education',
      categoryName: '教育',
      budgetAmount: 30_000,
      spent: 10_000,
      remaining: 20_000,
      pct: 33.33,
      isOverBudget: false,
    },
  ]);
  assert.ok(overview);

  const markup = renderToStaticMarkup(createElement(AnnualBudgetRingChart, {
    overview,
    expandedBudgetId: 'annual',
    onToggleBudget: () => undefined,
    renderBudgetDetails: (budgetId, segment) => createElement('span', {
      'data-detail-target': `${budgetId}:${segment.name}`,
    }),
  }));

  assert.match(markup, /aria-label="查看教育预算明细"/);
  assert.match(markup, /aria-label="收起生活预算明细"/);
  assert.match(markup, /data-detail-target="annual:生活预算"/);
  assert.equal((markup.match(/data-budget-detail-action="true"/g) ?? []).length, 2);
  assert.doesNotMatch(markup, /查看年度总预算明细或记录支出/);
});
