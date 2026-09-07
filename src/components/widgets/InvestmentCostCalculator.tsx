'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeAlert,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Landmark,
  ShieldAlert,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  calculateInvestmentCost,
  estimateMonthlyPayment,
  getContractMaturityDate,
  getRemainingContractMonths,
  type ComparisonIssue,
} from '@/lib/investment-cost';

export type InvestmentCostLiability = {
  id: string;
  name: string;
  balance: number;
  annualRate: number;
  monthlyPayment: number | null;
  termMonths: number;
  startDate: string;
  contractEndDate: string;
  remainingMonths: number;
  paymentMethod: string;
};

export type InvestmentCostSnapshot = {
  asOfDate: string;
  monthlyIncome: number;
  monthlyExpense: number;
  cashflowActiveMonths: number;
  liquidCash: number;
  stockPoolValue: number;
  dataWarnings: string[];
};

type Props = {
  liabilities: InvestmentCostLiability[];
  snapshot: InvestmentCostSnapshot;
};

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-[var(--border-tertiary)] bg-[var(--color-container)] text-[var(--color-text-primary)]',
  success: 'border-green-200 bg-[var(--color-success-bg)] text-green-800',
  warning: 'border-amber-200 bg-[var(--color-warning-bg)] text-amber-900',
  danger: 'border-red-200 bg-[var(--color-danger-bg)] text-red-800',
};

const allocationShares = [0.1, 0.2, 0.3, 0.5];
const scenarioRates = [-20, 0, 5, 10, 20];

const repaymentMethodLabels: Record<string, string> = {
  equal_interest: '等额本息 / 固定月供',
  equal_principal: '等额本金（暂不支持精确比较）',
  bullet: '一次性还本付息（暂不支持精确比较）',
  revolving_credit: '循环额度（余额会变化，暂不支持精确比较）',
};

const comparisonIssueLabels: Record<ComparisonIssue, string> = {
  no_debt: '请先选择或填写一笔仍有余额的负债。',
  no_allocation: '请填写每月用于“提前还债或定投”的决定金额。',
  invalid_maturity: '原合同到期日必须晚于今天。',
  unsupported_repayment_method: '当前只支持固定利率、固定月供的等额本息贷款。',
  payment_not_amortizing: '当前月供不能覆盖首月利息，负债可能越还越多。',
  debt_not_cleared_by_maturity: '按当前余额、月供和利率，贷款无法在原合同到期日前还清，请核对合同数据。',
  break_even_not_found: '在可计算的收益率范围内没有找到两种方案的打平点。',
};

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value.replace(/[，,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseSignedPercent(value: string) {
  const parsed = Number.parseFloat(value.replace(/[，,%\s]/g, ''));
  return Number.isFinite(parsed) ? Math.max(-99.9999, parsed) / 100 : 0;
}

function parsePercent(value: string) {
  return Math.max(0, parseSignedPercent(value));
}

function inputNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(digits)).toString();
}

function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatMonths(value: number | null) {
  if (value === null) return '无法估算';
  if (value === 0) return '不延后';
  return `${value} 个月`;
}

function formatPayoffMonth(value: number | null) {
  if (value === null) return '到期前未还清';
  if (value === 0) return '当前已还清';
  return `第 ${value} 个月`;
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '待确认';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function Field({
  label,
  value,
  onChange,
  suffix,
  help,
  signed = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  help?: string;
  signed?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <span className="flex min-h-11 items-center rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] px-3 focus-within:border-[var(--color-text-primary)]">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-[15px] tabular-nums text-[var(--color-text-primary)] outline-none"
          placeholder={signed ? '-20' : '0'}
        />
        {suffix ? <span className="ml-2 text-xs text-[var(--color-text-secondary)]">{suffix}</span> : null}
      </span>
      {help ? <span className="mt-1 block text-[11px] leading-4 text-[var(--color-text-subdued)]">{help}</span> : null}
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] px-3 text-[15px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
      />
      {help ? <span className="mt-1 block text-[11px] leading-4 text-[var(--color-text-subdued)]">{help}</span> : null}
    </label>
  );
}

function SnapshotMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--color-container-inset)] p-3">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-1 truncate text-base font-bold tabular-nums text-[var(--color-text-primary)]">{value}</div>
      <div className="mt-1 text-[10px] leading-4 text-[var(--color-text-subdued)]">{detail}</div>
    </div>
  );
}

function Notice({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5 ${toneClasses[tone]}`}
    >
      {tone === 'success'
        ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        : <BadgeAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

function initialPayment(liability?: InvestmentCostLiability) {
  if (!liability) return 0;
  if (liability.monthlyPayment && liability.monthlyPayment > 0) return liability.monthlyPayment;
  return estimateMonthlyPayment(
    liability.balance,
    liability.annualRate,
    Math.max(1, liability.remainingMonths),
  );
}

export default function InvestmentCostCalculator({ liabilities, snapshot }: Props) {
  const defaultLiability = liabilities[0];
  const visibleSurplus = Math.max(0, snapshot.monthlyIncome - snapshot.monthlyExpense);
  const defaultRemainingMonths = defaultLiability?.remainingMonths ?? 12;
  const defaultContractEndDate = defaultLiability?.contractEndDate
    || getContractMaturityDate(snapshot.asOfDate, defaultRemainingMonths);
  const [selectedLiabilityId, setSelectedLiabilityId] = useState(defaultLiability?.id || '');
  const [debtBalance, setDebtBalance] = useState(inputNumber(defaultLiability?.balance || 0, 0));
  const [debtRate, setDebtRate] = useState(inputNumber((defaultLiability?.annualRate || 0) * 100));
  const [minimumPayment, setMinimumPayment] = useState(inputNumber(initialPayment(defaultLiability), 0));
  const [paymentEstimated, setPaymentEstimated] = useState(Boolean(defaultLiability && !defaultLiability.monthlyPayment));
  const [repaymentMethod, setRepaymentMethod] = useState(defaultLiability?.paymentMethod || 'equal_interest');
  const [contractEndDate, setContractEndDate] = useState(defaultContractEndDate);
  const [remainingMonths, setRemainingMonths] = useState(inputNumber(defaultRemainingMonths, 0));
  const [availableCash, setAvailableCash] = useState(inputNumber(visibleSurplus, 0));
  const [monthlyAllocation, setMonthlyAllocation] = useState('0');
  const [buyFee, setBuyFee] = useState('0.10');
  const [sellFee, setSellFee] = useState('0.10');
  const [holdingFee, setHoldingFee] = useState('0');
  const [gainTax, setGainTax] = useState('0');
  const [scenarioReturn, setScenarioReturn] = useState('0');

  const numericAvailableCash = parseAmount(availableCash);
  const numericAllocation = parseAmount(monthlyAllocation);
  const numericDebtBalance = parseAmount(debtBalance);
  const numericDebtRate = parsePercent(debtRate);
  const numericMinimumPayment = parseAmount(minimumPayment);
  const numericRemainingMonths = Math.round(parseAmount(remainingMonths));
  const numericBuyFee = parsePercent(buyFee);
  const numericSellFee = parsePercent(sellFee);
  const numericHoldingFee = parsePercent(holdingFee);
  const numericGainTax = parsePercent(gainTax);
  const numericScenarioReturn = parseSignedPercent(scenarioReturn);
  const emergencyMonths = snapshot.monthlyExpense > 0
    ? snapshot.liquidCash / snapshot.monthlyExpense
    : null;

  const result = useMemo(() => calculateInvestmentCost({
    debtBalance: numericDebtBalance,
    annualDebtRate: numericDebtRate,
    minimumPayment: numericMinimumPayment,
    monthlyAllocation: numericAllocation,
    horizonMonths: numericRemainingMonths,
    repaymentMethod,
    buyFeeRate: numericBuyFee,
    sellFeeRate: numericSellFee,
    annualHoldingFeeRate: numericHoldingFee,
    gainTaxRate: numericGainTax,
    scenarioAnnualReturn: numericScenarioReturn,
  }), [
    numericAllocation,
    numericBuyFee,
    numericDebtBalance,
    numericDebtRate,
    numericGainTax,
    numericHoldingFee,
    numericMinimumPayment,
    numericRemainingMonths,
    numericScenarioReturn,
    numericSellFee,
    repaymentMethod,
  ]);

  function selectLiability(id: string) {
    setSelectedLiabilityId(id);
    const liability = liabilities.find((item) => item.id === id);
    if (!liability) return;
    setDebtBalance(inputNumber(liability.balance, 0));
    setDebtRate(inputNumber(liability.annualRate * 100));
    setMinimumPayment(inputNumber(initialPayment(liability), 0));
    setPaymentEstimated(!liability.monthlyPayment);
    setRepaymentMethod(liability.paymentMethod);
    setContractEndDate(liability.contractEndDate);
    setRemainingMonths(inputNumber(liability.remainingMonths, 0));
  }

  function updateContractEndDate(value: string) {
    setContractEndDate(value);
    setRemainingMonths(inputNumber(
      getRemainingContractMonths(snapshot.asOfDate, value),
      0,
    ));
  }

  function updateRemainingMonths(value: string) {
    setRemainingMonths(value);
    const months = Math.round(parseAmount(value));
    setContractEndDate(getContractMaturityDate(snapshot.asOfDate, months));
  }

  function allocateShare(share: number) {
    setMonthlyAllocation(inputNumber(numericAvailableCash * share, 0));
  }

  const allocationExceedsCash = numericAllocation > numericAvailableCash;
  const hardIssues = result.issues.filter((issue) => issue !== 'no_allocation');
  const canShowAnswer = (
    numericAllocation > 0
    && !allocationExceedsCash
    && hardIssues.length === 0
    && result.requiredAnnualGrossReturn !== null
  );
  const scenarioFavorsInvesting = result.scenarioNetWorthAdvantage >= 0;

  return (
    <main className="mx-auto w-full max-w-5xl pb-4 md:pb-8">
      <header className="mb-4 flex items-start gap-3 md:mb-6">
        <Link
          href="/me"
          aria-label="返回我的"
          className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] text-[var(--color-text-primary)] no-underline"
        >
          <ArrowLeft size={19} strokeWidth={1.9} aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">先还债还是先定投</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            比较到原合同到期日，算出负债期间投资需要跨过的数学门槛。
          </p>
        </div>
      </header>

      <section className={`rounded-3xl border p-5 shadow-[var(--shadow-sm)] md:p-6 ${toneClasses[canShowAnswer ? 'neutral' : hardIssues.length > 0 || allocationExceedsCash ? 'danger' : 'neutral']}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Calculator size={18} strokeWidth={1.9} aria-hidden />
          投资打平门槛
        </div>
        {canShowAnswer ? (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
              <div className="text-4xl font-black tracking-tight tabular-nums md:text-5xl">
                {formatPercent(result.requiredAnnualGrossReturn)}
              </div>
              <div className="pb-1 text-sm font-semibold">/ 年（税费前）</div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6">
              这是<strong>等效恒定年化毛收益率</strong>：假设股票池每月以相同速度变化，使“先还债再投资”和“边还边投”在
              {formatDate(contractEndDate)}的税费后净资产刚好相等。它是数学基准，不是收益预测。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <SnapshotMetric label="贷款合同 APR" value={`${formatPercent(result.contractApr)} / 年`} detail={`内部月利率 ${formatPercent(result.loanMonthlyRate, 3)}`} />
              <SnapshotMetric label="贷款有效年化成本" value={`${formatPercent(result.effectiveAnnualDebtCost)} / 年`} detail="按月复利换算" />
              <SnapshotMetric label="边还边投多付利息" value={formatCny(result.extraInterestCost)} detail={`比较 ${result.comparisonMonths} 个月`} />
              <SnapshotMetric label="还清时间推迟" value={formatMonths(result.payoffDelayMonths)} detail={`比较日 ${formatDate(contractEndDate)}`} />
            </div>
          </>
        ) : numericAllocation <= 0 ? (
          <div className="mt-4 rounded-2xl bg-black/5 px-4 py-5 text-sm leading-6">
            先填写每月用于“提前还债或定投”的决定金额。系统不会替你默认分配资金。
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <div className="text-xl font-black">暂不具备比较条件</div>
            {allocationExceedsCash ? (
              <Notice tone="danger">定投金额超过每月可分配现金，会制造新的现金缺口。</Notice>
            ) : null}
            {hardIssues.map((issue) => (
              <Notice key={issue} tone="danger">{comparisonIssueLabels[issue]}</Notice>
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="grid gap-4">
          <section className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)] md:p-5">
            <div className="flex items-center gap-2">
              <WalletCards size={18} strokeWidth={1.9} aria-hidden />
              <h2 className="font-bold text-[var(--color-text-primary)]">当前财务底盘</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              现金流取最近3个自然月中有流水月份的均值；现有股票池只用于风险背景，不参与这笔新增资金的计算。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SnapshotMetric label="月均收入" value={formatCny(snapshot.monthlyIncome)} detail={`${snapshot.cashflowActiveMonths} 个月有效流水`} />
              <SnapshotMetric label="月均支出" value={formatCny(snapshot.monthlyExpense)} detail="包含已记账支出" />
              <SnapshotMetric label="可见结余" value={formatCny(visibleSurplus)} detail="收入减支出" />
              <SnapshotMetric label="现有股票池" value={formatCny(snapshot.stockPoolValue)} detail="风险背景，不参与计算" />
            </div>
            {snapshot.dataWarnings.map((warning) => (
              <div key={warning} className="mt-3">
                <Notice tone="warning">{warning}</Notice>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)] md:p-5">
            <div className="flex items-center gap-2">
              <Landmark size={18} strokeWidth={1.9} aria-hidden />
              <h2 className="font-bold text-[var(--color-text-primary)]">1. 核对贷款合同</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">现有负债</span>
                <select
                  value={selectedLiabilityId}
                  onChange={(event) => selectLiability(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] px-3 text-[15px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
                >
                  <option value="">手动输入</option>
                  {liabilities.map((liability) => (
                    <option key={liability.id} value={liability.id}>
                      {liability.name} · {formatCny(liability.balance)} · {(liability.annualRate * 100).toFixed(2)}%
                    </option>
                  ))}
                </select>
              </label>
              <Field label="当前余额" value={debtBalance} onChange={setDebtBalance} suffix="元" />
              <Field label="合同 APR / 综合年化成本" value={debtRate} onChange={setDebtRate} suffix="%/年" help="页面按年展示，计算内部按 APR÷12 逐月计息。" />
              <Field
                label="合同月供"
                value={minimumPayment}
                onChange={(value) => { setMinimumPayment(value); setPaymentEstimated(false); }}
                suffix="元/月"
                help={paymentEstimated ? '原负债未录月供，已按当前余额、利率和剩余期数估算，请按合同修正。' : '本表始终假设合同月供按时支付。'}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">还款方式</span>
                <select
                  value={repaymentMethod}
                  onChange={(event) => setRepaymentMethod(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] px-3 text-[15px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
                >
                  {Object.entries(repaymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <DateField
                label="原合同到期日"
                value={contractEndDate}
                onChange={updateContractEndDate}
                help="默认由开始日期和原合同期限得出，可按合同修正。"
              />
              <Field
                label="剩余合同期数"
                value={remainingMonths}
                onChange={updateRemainingMonths}
                suffix="个月"
                help="修改后会同步更新比较日。"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)] md:p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} strokeWidth={1.9} aria-hidden />
              <h2 className="font-bold text-[var(--color-text-primary)]">2. 填写同一笔决定资金</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              两个方案每月使用完全相同的总预算：合同月供正常支付，下面这笔钱在“额外还本金”和“立即定投”之间二选一。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="每月可用于还债或定投"
                value={availableCash}
                onChange={setAvailableCash}
                suffix="元/月"
                help="默认等于可见结余，可按真实可支配金额修改。"
              />
              <Field
                label="每月决定金额 X"
                value={monthlyAllocation}
                onChange={setMonthlyAllocation}
                suffix="元/月"
                help="方案A用于额外还债，方案B用于从现在开始定投。"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="决定金额比例快捷选择">
              {allocationShares.map((share) => (
                <button
                  key={share}
                  type="button"
                  onClick={() => allocateShare(share)}
                  className="min-h-11 rounded-xl border border-[var(--border-secondary)] px-3 text-xs font-semibold text-[var(--color-text-primary)]"
                >
                  可分配额的 {share * 100}%
                </button>
              ))}
            </div>
          </section>

          <details className="group rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] shadow-[var(--shadow-xs)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-bold text-[var(--color-text-primary)] md:px-5">
              <CircleDollarSign size={18} strokeWidth={1.9} aria-hidden />
              3. 交易费与税费
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-3 border-t border-[var(--border-tertiary)] p-4 sm:grid-cols-2 md:p-5">
              <Field label="买入费用" value={buyFee} onChange={setBuyFee} suffix="%/次" help="默认仅为试算值，请按券商实际费率修改。" />
              <Field label="卖出费用" value={sellFee} onChange={setSellFee} suffix="%/次" />
              <Field label="年持有费用" value={holdingFee} onChange={setHoldingFee} suffix="%/年" help="如基金管理费、平台费；净值已扣费时不要重复填写。" />
              <Field label="盈利税费" value={gainTax} onChange={setGainTax} suffix="%" help="不同市场和账户规则不同，不自动假定。" />
            </div>
          </details>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)] md:p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} strokeWidth={1.9} aria-hidden />
              <h2 className="font-bold text-[var(--color-text-primary)]">安全护栏</h2>
            </div>
            <div className="mt-3 grid gap-2">
              <Notice tone="neutral">
                本表只比较<strong>额外还款</strong>与定投。合同月供、最低还款和到期款必须按时支付；真实逾期不在本模型内。
              </Notice>
              {repaymentMethod !== 'equal_interest' ? (
                <Notice tone="danger">{comparisonIssueLabels.unsupported_repayment_method}</Notice>
              ) : null}
              {numericDebtRate >= 0.08 ? (
                <Notice tone="danger">
                  当前合同 APR 为 {formatPercent(numericDebtRate)}。高借贷成本会显著抬高投资打平门槛，不能把股票收益当作还款来源。
                </Notice>
              ) : (
                <Notice tone="neutral">
                  当前合同 APR 为 {formatPercent(numericDebtRate)}；投资回报仍不确定，打平门槛不是收益预测。
                </Notice>
              )}
              {emergencyMonths !== null && emergencyMonths < 3 ? (
                <Notice tone="danger">
                  现金类储备仅覆盖约 {emergencyMonths.toFixed(1)} 个月支出；股票市值不计作应急金。
                </Notice>
              ) : emergencyMonths !== null ? (
                <Notice tone={emergencyMonths < 6 ? 'warning' : 'success'}>
                  现金类储备约覆盖 {emergencyMonths.toFixed(1)} 个月支出；本项只计现金和活期存款。
                </Notice>
              ) : (
                <Notice tone="warning">没有可用的月支出数据，暂时无法判断应急金覆盖月数。</Notice>
              )}
              {allocationExceedsCash ? (
                <Notice tone="danger">
                  决定金额高于可分配现金流 {formatCny(numericAvailableCash)}，方案会制造新的现金缺口。
                </Notice>
              ) : null}
              {!result.minimumPaymentCoversInterest && numericDebtBalance > 0 ? (
                <Notice tone="danger">{comparisonIssueLabels.payment_not_amortizing}</Notice>
              ) : null}
              {!result.debtClearedByMaturity && numericDebtBalance > 0 ? (
                <Notice tone="danger">{comparisonIssueLabels.debt_not_cleared_by_maturity}</Notice>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)] md:p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} strokeWidth={1.9} aria-hidden />
              <h2 className="font-bold text-[var(--color-text-primary)]">收益路径试算</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              假设每个月以同一速度变化，仅用于观察两种方案的期末差额，不是市场预测。
            </p>
            <div className="mt-3">
              <Field label="假设年化毛收益率" value={scenarioReturn} onChange={setScenarioReturn} suffix="%/年" signed />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {scenarioRates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setScenarioReturn(String(rate))}
                  aria-pressed={numericScenarioReturn === rate / 100}
                  className="min-h-11 rounded-lg border border-[var(--border-secondary)] text-xs font-semibold tabular-nums text-[var(--color-text-primary)] aria-pressed:bg-[var(--color-container-inset)]"
                >
                  {rate}%
                </button>
              ))}
            </div>
            {hardIssues.length === 0 && numericAllocation > 0 && !allocationExceedsCash ? (
              <div className={`mt-4 rounded-xl border p-3 ${toneClasses[scenarioFavorsInvesting ? 'success' : 'warning']}`}>
                <div className="text-xs font-semibold">
                  {scenarioFavorsInvesting ? '边还边投期末净资产更高' : '先还债再投资期末净资产更高'}
                </div>
                <div className="mt-1 text-xl font-black tabular-nums">
                  {result.scenarioNetWorthAdvantage >= 0 ? '+' : ''}{formatCny(result.scenarioNetWorthAdvantage)}
                </div>
                <div className="mt-1 text-[11px] leading-4">
                  差额＝边还边投期末净资产－先还债再投资期末净资产。
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <Notice tone="warning">先补齐有效合同和决定金额，才能进行收益路径试算。</Notice>
              </div>
            )}
          </section>

          <details className="group rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] shadow-[var(--shadow-xs)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-bold text-[var(--color-text-primary)] md:px-5">
              <Calculator size={18} strokeWidth={1.9} aria-hidden />
              计算明细
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <dl className="grid gap-2 border-t border-[var(--border-tertiary)] p-4 text-xs md:p-5">
              {[
                ['默认比较日', formatDate(contractEndDate)],
                ['贷款月利率', formatPercent(result.loanMonthlyRate, 3)],
                ['投资打平等效月收益率', formatPercent(result.requiredMonthlyEquivalentReturn, 3)],
                ['先还债方案还清时间', formatPayoffMonth(result.scenarioRepayFirst.payoffMonth)],
                ['边还边投方案还清时间', formatPayoffMonth(result.scenarioInvestWhileRepaying.payoffMonth)],
                ['先还债方案累计利息', formatCny(result.scenarioRepayFirst.totalInterest)],
                ['边还边投方案累计利息', formatCny(result.scenarioInvestWhileRepaying.totalInterest)],
                ['先还债方案累计定投', formatCny(result.scenarioRepayFirst.investment.totalContributions)],
                ['边还边投方案累计定投', formatCny(result.scenarioInvestWhileRepaying.investment.totalContributions)],
                ['先还债方案期末净资产', formatCny(result.scenarioRepayFirst.terminalNetWorth)],
                ['边还边投方案期末净资产', formatCny(result.scenarioInvestWhileRepaying.terminalNetWorth)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-[var(--border-subdued)] pb-2 last:border-0 last:pb-0">
                  <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                  <dd className="text-right font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </aside>
      </div>

      <footer className="mt-4 rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container-inset)] px-4 py-3 text-[11px] leading-5 text-[var(--color-text-secondary)]">
        <strong>模型边界：</strong>当前只精确支持固定利率、固定月供的等额本息贷款；默认比较到原合同到期日。两个方案每月使用相同总预算，先还债方案在提前还清后把释放资金投入同一股票池，边还边投方案从第一个月开始投入决定金额。贷款按 APR÷12 计息，投资年化通过12次方根换算为月增长，期末按填写的费税一次结算。实际波动、分红、滑点、提前还款违约金、浮动利率和具体税法尚未建模。本工具不构成投资、借贷或税务建议。
      </footer>
    </main>
  );
}
