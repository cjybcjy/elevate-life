import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import FinancialAiChat from './FinancialAiChat';
import type { FinanceAiSnapshot } from '@/lib/finance-ai';

const snapshot: FinanceAiSnapshot = {
  currentDate: '2026-06-18',
  netWorth: 880000,
  totalAssets: 1280000,
  totalLiabilities: 400000,
  surplusRate: 68.75,
  tier1Total: 180000,
  currentIncome: 62800,
  currentExpense: 21000,
  budgetRemaining: 5600,
  coverageMonths: 8.57,
  overBudgetCount: 1,
  missingSourceCount: 2,
  pricesStale: false,
  goldUnitPrice: 628,
  goldPriceCurrency: 'CNY',
  goldAlertThreshold: null,
};

test('FinancialAiChat collapsed launcher is labeled AI 助手', () => {
  const markup = renderToString(<FinancialAiChat snapshot={snapshot} />);

  assert.match(markup, />AI 助手<\/button>/);
  assert.doesNotMatch(markup, />AI<\/button>/);
});
