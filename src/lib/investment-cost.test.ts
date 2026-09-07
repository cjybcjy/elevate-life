import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateInvestmentCost,
  estimateMonthlyPayment,
  getContractMaturityDate,
  getRemainingContractMonths,
  simulateInvestmentPath,
} from './investment-cost';

const baseInput = {
  debtBalance: 100_000,
  annualDebtRate: 0.06,
  minimumPayment: estimateMonthlyPayment(100_000, 0.06, 60),
  monthlyAllocation: 1_000,
  horizonMonths: 60,
  repaymentMethod: 'equal_interest',
  buyFeeRate: 0,
  sellFeeRate: 0,
  annualHoldingFeeRate: 0,
  gainTaxRate: 0,
  scenarioAnnualReturn: 0,
};

test('contract maturity and remaining periods preserve the contract calendar day', () => {
  assert.equal(getContractMaturityDate('2024-01-31', 12), '2025-01-31');
  assert.equal(getContractMaturityDate('2024-01-31', 1), '2024-02-29');
  assert.equal(getRemainingContractMonths('2024-12-10', '2025-01-31'), 2);
  assert.equal(getRemainingContractMonths('2025-01-31', '2025-01-31'), 0);
});

test('zero-cost debt and fee-free investing break even at a zero return', () => {
  const result = calculateInvestmentCost({
    ...baseInput,
    debtBalance: 12_000,
    annualDebtRate: 0,
    minimumPayment: 1_000,
    monthlyAllocation: 500,
    horizonMonths: 12,
  });

  assert.equal(result.issues.length, 0);
  assert.ok(result.requiredAnnualGrossReturn !== null);
  assert.ok(Math.abs(result.requiredAnnualGrossReturn) < 1e-7);
  assert.ok(Math.abs(
    result.scenarioRepayFirst.investment.totalContributions
      - result.scenarioInvestWhileRepaying.investment.totalContributions,
  ) < 1e-7);
});

test('fee-free break-even matches the debt effective annual cost', () => {
  const result = calculateInvestmentCost(baseInput);

  assert.equal(result.issues.length, 0);
  assert.ok(result.extraInterestCost > 0);
  assert.ok(result.requiredAnnualGrossReturn !== null);
  assert.ok(Math.abs(
    result.requiredAnnualGrossReturn - result.effectiveAnnualDebtCost,
  ) < 1e-7);
  assert.ok(result.scenarioNetWorthAdvantage < 0);
});

test('repay-first invests released debt budget after the earlier payoff', () => {
  const result = calculateInvestmentCost(baseInput);
  const sharedBudget = (
    baseInput.minimumPayment + baseInput.monthlyAllocation
  ) * baseInput.horizonMonths;

  assert.ok(result.scenarioRepayFirst.payoffMonth !== null);
  assert.ok(result.scenarioInvestWhileRepaying.payoffMonth !== null);
  assert.ok(
    result.scenarioRepayFirst.payoffMonth!
      < result.scenarioInvestWhileRepaying.payoffMonth!,
  );
  assert.ok(
    result.scenarioRepayFirst.investment.totalContributions
      > result.scenarioInvestWhileRepaying.investment.totalContributions,
  );
  assert.ok(Math.abs(
    result.scenarioRepayFirst.totalDebtPayments
      + result.scenarioRepayFirst.investment.totalContributions
      - sharedBudget,
  ) < 1e-6);
  assert.ok(Math.abs(
    result.scenarioInvestWhileRepaying.totalDebtPayments
      + result.scenarioInvestWhileRepaying.investment.totalContributions
      - sharedBudget,
  ) < 1e-6);
});

test('transaction and holding fees raise the gross return needed', () => {
  const result = calculateInvestmentCost({
    ...baseInput,
    buyFeeRate: 0.001,
    sellFeeRate: 0.001,
    annualHoldingFeeRate: 0.005,
  });

  assert.ok(result.requiredAnnualGrossReturn !== null);
  assert.ok(result.requiredAnnualGrossReturn > result.effectiveAnnualDebtCost);
});

test('the required return equalizes both terminal net-worth paths', () => {
  const target = calculateInvestmentCost({
    ...baseInput,
    buyFeeRate: 0.001,
    sellFeeRate: 0.001,
  });
  assert.ok(target.requiredAnnualGrossReturn !== null);

  const atTarget = calculateInvestmentCost({
    ...baseInput,
    buyFeeRate: 0.001,
    sellFeeRate: 0.001,
    scenarioAnnualReturn: target.requiredAnnualGrossReturn!,
  });

  assert.ok(Math.abs(atTarget.scenarioNetWorthAdvantage) < 1e-5);
});

test('non-amortizing payments block a misleading break-even answer', () => {
  const result = calculateInvestmentCost({
    ...baseInput,
    annualDebtRate: 0.12,
    minimumPayment: 500,
  });

  assert.ok(result.issues.includes('payment_not_amortizing'));
  assert.ok(result.issues.includes('debt_not_cleared_by_maturity'));
  assert.equal(result.requiredAnnualGrossReturn, null);
});

test('unsupported repayment methods fail explicitly', () => {
  const result = calculateInvestmentCost({
    ...baseInput,
    repaymentMethod: 'bullet',
  });

  assert.ok(result.issues.includes('unsupported_repayment_method'));
  assert.equal(result.requiredAnnualGrossReturn, null);
});

test('DCA contributions are invested monthly and all fees reduce net proceeds', () => {
  const investment = simulateInvestmentPath({
    monthlyAllocation: 1_000,
    horizonMonths: 12,
    annualGrossReturn: 0,
    buyFeeRate: 0.001,
    sellFeeRate: 0.001,
    annualHoldingFeeRate: 0,
    gainTaxRate: 0,
  });

  assert.equal(investment.totalContributions, 12_000);
  assert.equal(investment.buyFees, 12);
  assert.ok(investment.netGain < -23);
});

test('monthly payment estimation matches a standard amortizing loan', () => {
  assert.ok(Math.abs(estimateMonthlyPayment(120_000, 0, 12) - 10_000) < 1e-6);
  assert.ok(Math.abs(estimateMonthlyPayment(100_000, 0.06, 12) - 8_606.64) < 0.02);
});
