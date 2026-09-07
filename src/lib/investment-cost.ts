const MAX_COMPARISON_MONTHS = 600;
const MONEY_EPSILON = 1e-7;
const MATURITY_BALANCE_TOLERANCE = 1;

export type ComparisonIssue =
  | 'no_debt'
  | 'no_allocation'
  | 'invalid_maturity'
  | 'unsupported_repayment_method'
  | 'payment_not_amortizing'
  | 'debt_not_cleared_by_maturity'
  | 'break_even_not_found';

export type InvestmentCostInput = {
  debtBalance: number;
  annualDebtRate: number;
  minimumPayment: number;
  monthlyAllocation: number;
  horizonMonths: number;
  repaymentMethod: string;
  buyFeeRate: number;
  sellFeeRate: number;
  annualHoldingFeeRate: number;
  gainTaxRate: number;
  scenarioAnnualReturn: number;
};

export type InvestmentPathResult = {
  grossPortfolioValue: number;
  netProceeds: number;
  netGain: number;
  totalContributions: number;
  buyFees: number;
  sellFee: number;
  gainTax: number;
};

export type StrategyPathResult = {
  strategy: 'repay_first' | 'invest_while_repaying';
  terminalDebtBalance: number;
  terminalNetWorth: number;
  totalDebtPayments: number;
  totalInterest: number;
  payoffMonth: number | null;
  investment: InvestmentPathResult;
};

export type InvestmentCostResult = {
  comparisonMonths: number;
  contractApr: number;
  loanMonthlyRate: number;
  effectiveAnnualDebtCost: number;
  requiredAnnualGrossReturn: number | null;
  requiredMonthlyEquivalentReturn: number | null;
  extraInterestCost: number;
  payoffDelayMonths: number | null;
  scenarioNetWorthAdvantage: number;
  scenarioRepayFirst: StrategyPathResult;
  scenarioInvestWhileRepaying: StrategyPathResult;
  minimumPaymentCoversInterest: boolean;
  debtClearedByMaturity: boolean;
  issues: ComparisonIssue[];
  isComparable: boolean;
};

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function nonNegative(value: number) {
  return Math.max(0, finiteOrZero(value));
}

function boundedRate(value: number) {
  return Math.min(0.999999, nonNegative(value));
}

function normalizeInput(input: InvestmentCostInput): InvestmentCostInput {
  return {
    debtBalance: nonNegative(input.debtBalance),
    annualDebtRate: boundedRate(input.annualDebtRate),
    minimumPayment: nonNegative(input.minimumPayment),
    monthlyAllocation: nonNegative(input.monthlyAllocation),
    horizonMonths: Math.max(
      0,
      Math.min(MAX_COMPARISON_MONTHS, Math.round(nonNegative(input.horizonMonths))),
    ),
    repaymentMethod: input.repaymentMethod || 'equal_interest',
    buyFeeRate: boundedRate(input.buyFeeRate),
    sellFeeRate: boundedRate(input.sellFeeRate),
    annualHoldingFeeRate: boundedRate(input.annualHoldingFeeRate),
    gainTaxRate: boundedRate(input.gainTaxRate),
    scenarioAnnualReturn: Math.max(-0.999999, finiteOrZero(input.scenarioAnnualReturn)),
  };
}

function parseDate(value: string | Date) {
  if (value instanceof Date) return new Date(value.getTime());
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
  return new Date(normalized);
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getContractMaturityDate(startDate: string | Date, termMonths: number) {
  const start = parseDate(startDate);
  if (!Number.isFinite(start.getTime())) return '';

  const safeTerm = Math.max(0, Math.round(nonNegative(termMonths)));
  const targetMonthIndex = start.getUTCMonth() + safeTerm;
  const targetYear = start.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(start.getUTCDate(), lastDay);

  return formatUtcDate(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
}

export function getRemainingContractMonths(
  asOfDate: string | Date,
  maturityDate: string | Date,
) {
  const asOf = parseDate(asOfDate);
  const maturity = parseDate(maturityDate);
  if (!Number.isFinite(asOf.getTime()) || !Number.isFinite(maturity.getTime())) return 0;

  const asOfDay = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  const maturityDay = Date.UTC(
    maturity.getUTCFullYear(),
    maturity.getUTCMonth(),
    maturity.getUTCDate(),
  );
  if (maturityDay <= asOfDay) return 0;

  let months = (
    (maturity.getUTCFullYear() - asOf.getUTCFullYear()) * 12
    + maturity.getUTCMonth()
    - asOf.getUTCMonth()
  );
  if (maturity.getUTCDate() > asOf.getUTCDate()) months += 1;
  return Math.max(1, months);
}

export function estimateMonthlyPayment(
  balance: number,
  annualRate: number,
  months: number,
) {
  const safeBalance = nonNegative(balance);
  const safeMonths = Math.max(1, Math.round(nonNegative(months) || 1));
  const monthlyRate = boundedRate(annualRate) / 12;

  if (safeBalance === 0) return 0;
  if (monthlyRate === 0) return safeBalance / safeMonths;

  const factor = (1 + monthlyRate) ** safeMonths;
  return safeBalance * monthlyRate * factor / (factor - 1);
}

function settlePortfolio({
  grossPortfolioValue,
  totalContributions,
  buyFees,
  sellFeeRate,
  gainTaxRate,
}: {
  grossPortfolioValue: number;
  totalContributions: number;
  buyFees: number;
  sellFeeRate: number;
  gainTaxRate: number;
}): InvestmentPathResult {
  const sellFee = grossPortfolioValue * sellFeeRate;
  const proceedsBeforeTax = grossPortfolioValue - sellFee;
  const taxableGain = Math.max(0, proceedsBeforeTax - totalContributions);
  const gainTax = taxableGain * gainTaxRate;
  const netProceeds = proceedsBeforeTax - gainTax;

  return {
    grossPortfolioValue,
    netProceeds,
    netGain: netProceeds - totalContributions,
    totalContributions,
    buyFees,
    sellFee,
    gainTax,
  };
}

export function simulateInvestmentPath({
  monthlyAllocation,
  horizonMonths,
  annualGrossReturn,
  buyFeeRate,
  sellFeeRate,
  annualHoldingFeeRate,
  gainTaxRate,
}: {
  monthlyAllocation: number;
  horizonMonths: number;
  annualGrossReturn: number;
  buyFeeRate: number;
  sellFeeRate: number;
  annualHoldingFeeRate: number;
  gainTaxRate: number;
}): InvestmentPathResult {
  const contribution = nonNegative(monthlyAllocation);
  const months = Math.max(
    0,
    Math.min(MAX_COMPARISON_MONTHS, Math.round(nonNegative(horizonMonths))),
  );
  const safeAnnualReturn = Math.max(-0.999999, finiteOrZero(annualGrossReturn));
  const monthlyGrowthFactor = (1 + safeAnnualReturn) ** (1 / 12);
  const monthlyHoldingFeeFactor = (1 - boundedRate(annualHoldingFeeRate)) ** (1 / 12);
  const safeBuyFeeRate = boundedRate(buyFeeRate);
  const safeSellFeeRate = boundedRate(sellFeeRate);
  const safeGainTaxRate = boundedRate(gainTaxRate);
  let portfolio = 0;
  let buyFees = 0;

  for (let month = 0; month < months; month += 1) {
    portfolio *= monthlyGrowthFactor * monthlyHoldingFeeFactor;
    const buyFee = contribution * safeBuyFeeRate;
    portfolio += contribution - buyFee;
    buyFees += buyFee;
  }

  return settlePortfolio({
    grossPortfolioValue: portfolio,
    totalContributions: contribution * months,
    buyFees,
    sellFeeRate: safeSellFeeRate,
    gainTaxRate: safeGainTaxRate,
  });
}

function simulateNormalizedStrategyPath(
  input: InvestmentCostInput,
  strategy: StrategyPathResult['strategy'],
  annualGrossReturn: number,
): StrategyPathResult {
  const loanMonthlyRate = input.annualDebtRate / 12;
  const monthlyGrowthFactor = (
    1 + Math.max(-0.999999, finiteOrZero(annualGrossReturn))
  ) ** (1 / 12);
  const monthlyHoldingFeeFactor = (1 - input.annualHoldingFeeRate) ** (1 / 12);
  const monthlyBudget = input.minimumPayment + input.monthlyAllocation;
  let debtBalance = input.debtBalance;
  let totalDebtPayments = 0;
  let totalInterest = 0;
  let payoffMonth: number | null = debtBalance <= MONEY_EPSILON ? 0 : null;
  let portfolio = 0;
  let totalContributions = 0;
  let buyFees = 0;

  for (let month = 1; month <= input.horizonMonths; month += 1) {
    portfolio *= monthlyGrowthFactor * monthlyHoldingFeeFactor;

    const interest = debtBalance * loanMonthlyRate;
    totalInterest += interest;
    const amountDue = debtBalance + interest;
    const plannedDebtPayment = strategy === 'repay_first'
      ? monthlyBudget
      : input.minimumPayment;
    const debtPayment = Math.min(amountDue, plannedDebtPayment);
    debtBalance = Math.max(0, amountDue - debtPayment);
    totalDebtPayments += debtPayment;

    if (debtBalance <= MONEY_EPSILON && payoffMonth === null) {
      debtBalance = 0;
      payoffMonth = month;
    }

    const contribution = Math.max(0, monthlyBudget - debtPayment);
    const buyFee = contribution * input.buyFeeRate;
    portfolio += contribution - buyFee;
    totalContributions += contribution;
    buyFees += buyFee;
  }

  const investment = settlePortfolio({
    grossPortfolioValue: portfolio,
    totalContributions,
    buyFees,
    sellFeeRate: input.sellFeeRate,
    gainTaxRate: input.gainTaxRate,
  });

  return {
    strategy,
    terminalDebtBalance: debtBalance,
    terminalNetWorth: investment.netProceeds - debtBalance,
    totalDebtPayments,
    totalInterest,
    payoffMonth,
    investment,
  };
}

export function simulateStrategyPath(
  rawInput: InvestmentCostInput,
  strategy: StrategyPathResult['strategy'],
  annualGrossReturn: number,
) {
  return simulateNormalizedStrategyPath(
    normalizeInput(rawInput),
    strategy,
    annualGrossReturn,
  );
}

function strategyAdvantageAt(input: InvestmentCostInput, annualGrossReturn: number) {
  const repayFirst = simulateNormalizedStrategyPath(
    input,
    'repay_first',
    annualGrossReturn,
  );
  const investWhileRepaying = simulateNormalizedStrategyPath(
    input,
    'invest_while_repaying',
    annualGrossReturn,
  );
  return investWhileRepaying.terminalNetWorth - repayFirst.terminalNetWorth;
}

function findRequiredAnnualReturn(input: InvestmentCostInput) {
  const zeroDifference = strategyAdvantageAt(input, 0);
  if (Math.abs(zeroDifference) <= MONEY_EPSILON) return 0;

  let lower = -0.999999;
  let lowerDifference = strategyAdvantageAt(input, lower);
  let upper = zeroDifference > 0 ? 0 : 1;
  let upperDifference = strategyAdvantageAt(input, upper);

  while (upperDifference < 0 && upper < 127) {
    upper = upper * 2 + 1;
    upperDifference = strategyAdvantageAt(input, upper);
  }

  if (lowerDifference > 0 || upperDifference < 0) return null;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointDifference = strategyAdvantageAt(input, midpoint);
    if (midpointDifference >= 0) {
      upper = midpoint;
      upperDifference = midpointDifference;
    } else {
      lower = midpoint;
      lowerDifference = midpointDifference;
    }
  }

  return (lower + upper) / 2;
}

export function calculateInvestmentCost(rawInput: InvestmentCostInput): InvestmentCostResult {
  const input = normalizeInput(rawInput);
  const loanMonthlyRate = input.annualDebtRate / 12;
  const effectiveAnnualDebtCost = (1 + loanMonthlyRate) ** 12 - 1;
  const minimumPaymentCoversInterest = input.debtBalance <= MONEY_EPSILON
    || input.minimumPayment > input.debtBalance * loanMonthlyRate + MONEY_EPSILON;
  const scenarioRepayFirst = simulateNormalizedStrategyPath(
    input,
    'repay_first',
    input.scenarioAnnualReturn,
  );
  const scenarioInvestWhileRepaying = simulateNormalizedStrategyPath(
    input,
    'invest_while_repaying',
    input.scenarioAnnualReturn,
  );
  const debtClearedByMaturity = (
    scenarioInvestWhileRepaying.terminalDebtBalance <= MATURITY_BALANCE_TOLERANCE
  );
  const issues: ComparisonIssue[] = [];

  if (input.debtBalance <= MONEY_EPSILON) issues.push('no_debt');
  if (input.monthlyAllocation <= MONEY_EPSILON) issues.push('no_allocation');
  if (input.horizonMonths <= 0) issues.push('invalid_maturity');
  if (input.repaymentMethod !== 'equal_interest') {
    issues.push('unsupported_repayment_method');
  }
  if (!minimumPaymentCoversInterest) issues.push('payment_not_amortizing');
  if (!debtClearedByMaturity) issues.push('debt_not_cleared_by_maturity');

  let requiredAnnualGrossReturn: number | null = null;
  if (issues.length === 0) {
    requiredAnnualGrossReturn = findRequiredAnnualReturn(input);
    if (requiredAnnualGrossReturn === null) issues.push('break_even_not_found');
  }

  const payoffDelayMonths = (
    scenarioRepayFirst.payoffMonth !== null
    && scenarioInvestWhileRepaying.payoffMonth !== null
  )
    ? Math.max(
      0,
      scenarioInvestWhileRepaying.payoffMonth - scenarioRepayFirst.payoffMonth,
    )
    : null;

  return {
    comparisonMonths: input.horizonMonths,
    contractApr: input.annualDebtRate,
    loanMonthlyRate,
    effectiveAnnualDebtCost,
    requiredAnnualGrossReturn,
    requiredMonthlyEquivalentReturn: requiredAnnualGrossReturn === null
      ? null
      : (1 + requiredAnnualGrossReturn) ** (1 / 12) - 1,
    extraInterestCost: Math.max(
      0,
      scenarioInvestWhileRepaying.totalInterest - scenarioRepayFirst.totalInterest,
    ),
    payoffDelayMonths,
    scenarioNetWorthAdvantage: (
      scenarioInvestWhileRepaying.terminalNetWorth
      - scenarioRepayFirst.terminalNetWorth
    ),
    scenarioRepayFirst,
    scenarioInvestWhileRepaying,
    minimumPaymentCoversInterest,
    debtClearedByMaturity,
    issues,
    isComparable: issues.length === 0,
  };
}
