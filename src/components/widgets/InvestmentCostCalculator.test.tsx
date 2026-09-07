import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import InvestmentCostCalculator from './InvestmentCostCalculator';

test('investment cost calculator renders live financial context and safety boundaries', () => {
  const markup = renderToString(
    <InvestmentCostCalculator
      liabilities={[{
        id: 'debt-1',
        name: '消费贷',
        balance: 100_000,
        annualRate: 0.1,
        monthlyPayment: 3_300,
        termMonths: 36,
        startDate: '2026-08-10',
        contractEndDate: '2029-08-10',
        remainingMonths: 36,
        paymentMethod: 'equal_interest',
      }]}
      snapshot={{
        asOfDate: '2026-08-10',
        monthlyIncome: 20_000,
        monthlyExpense: 15_000,
        cashflowActiveMonths: 3,
        liquidCash: 30_000,
        stockPoolValue: 80_000,
        dataWarnings: [],
      }}
    />,
  );

  assert.match(markup, /先还债还是先定投/);
  assert.match(markup, /投资打平门槛/);
  assert.match(markup, /比较到原合同到期日/);
  assert.match(markup, /系统不会替你默认分配资金/);
  assert.match(markup, /现有股票池/);
  assert.match(markup, /合同月供、最低还款和到期款必须按时支付/);
  assert.match(markup, /高借贷成本会显著抬高投资打平门槛/);
  assert.match(markup, /股票市值不计作应急金/);
});
