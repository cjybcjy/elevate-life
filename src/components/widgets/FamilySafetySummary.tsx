'use client';

import Link from 'next/link';
import { AmountDisplay } from '@/components/common/AmountDisplay';

interface BudgetProgress {
  id: string;
  name: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  pct: number;
  isOverBudget: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  fromAccountId?: string | null;
  occurredAt: string | Date;
}

interface Props {
  currentDate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  surplusRate: number;
  tier1Total: number;
  currentIncome: number;
  currentExpense: number;
  budgetProgress: BudgetProgress[];
  transactions: Transaction[];
  pricesStale: boolean;
}

type StatusTone = 'safe' | 'warning' | 'danger';

const statusConfig: Record<StatusTone, {
  label: string;
  title: string;
  detail: string;
  accent: string;
  accentText: string;
  background: string;
}> = {
  safe: {
    label: '安全',
    title: '我家现在比较稳',
    detail: '现金流、预算和流动性没有明显红灯。',
    accent: 'var(--color-success)',
    accentText: 'var(--color-black)',
    background: 'var(--color-success-bg)',
  },
  warning: {
    label: '关注',
    title: '我家有几项需要看住',
    detail: '优先处理流动性、预算或账户记录里的短板。',
    accent: 'var(--color-warning)',
    accentText: 'var(--color-black)',
    background: 'var(--color-warning-bg)',
  },
  danger: {
    label: '紧张',
    title: '我家需要先稳住现金流',
    detail: '先处理现金流缺口，再看投资和长期目标。',
    accent: 'var(--color-danger)',
    accentText: 'var(--color-white)',
    background: 'var(--color-danger-bg)',
  },
};

function toMonthKey(value: string | Date) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  return value.slice(0, 7);
}

function formatMonths(value: number | null) {
  if (value === null) return '暂无支出';
  if (!Number.isFinite(value)) return '充足';
  return `${value.toFixed(1)}个月`;
}

export default function FamilySafetySummary({
  currentDate,
  netWorth,
  totalAssets,
  totalLiabilities,
  surplusRate,
  tier1Total,
  currentIncome,
  currentExpense,
  budgetProgress,
  transactions,
  pricesStale,
}: Props) {
  const coverageMonths = currentExpense > 0 ? tier1Total / currentExpense : null;
  const budgetRemaining = budgetProgress.reduce((sum, budget) => sum + budget.remaining, 0);
  const overBudgetCount = budgetProgress.filter((budget) => budget.isOverBudget).length;
  const monthKey = currentDate.slice(0, 7);
  const missingSourceCount = transactions.filter((transaction) => (
    transaction.type.toUpperCase() === 'EXPENSE' &&
    !transaction.fromAccountId &&
    toMonthKey(transaction.occurredAt) === monthKey
  )).length;
  const monthSurplus = currentIncome - currentExpense;
  const hasCashflowData = currentIncome > 0 || currentExpense > 0;

  const statusTone: StatusTone = (() => {
    if (netWorth < 0 || (coverageMonths !== null && coverageMonths < 3) || monthSurplus < 0) {
      return 'danger';
    }

    if (
      (coverageMonths !== null && coverageMonths < 6) ||
      surplusRate < 25 ||
      overBudgetCount > 0 ||
      missingSourceCount > 0 ||
      budgetProgress.length === 0 ||
      !hasCashflowData
    ) {
      return 'warning';
    }

    return 'safe';
  })();

  const actionItems = [
    ...(!hasCashflowData ? [{
      href: '/management/ledger?focus=create',
      title: '补齐本月流水',
      detail: '先记录收入和支出，首页才有判断依据',
    }] : []),
    ...(overBudgetCount > 0 ? [{
      href: '/management/budget?focus=over',
      title: '处理超支预算',
      detail: `${overBudgetCount} 个预算已超支`,
    }] : []),
    ...(coverageMonths !== null && coverageMonths < 6 ? [{
      href: '/management/assets?focus=liquidity',
      title: '补足一级流动性',
      detail: '目标至少覆盖 6 个月支出',
    }] : []),
    ...(missingSourceCount > 0 ? [{
      href: '/management/ledger?needsSource=1',
      title: '补齐来源资金账户',
      detail: `${missingSourceCount} 笔支出缺少付款资金账户`,
    }] : []),
    ...(pricesStale ? [{
      href: '/management/assets?focus=prices',
      title: '刷新资产价格',
      detail: '股票或黄金估值可能已过期',
    }] : []),
    ...(budgetProgress.length === 0 ? [{
      href: '/management/budget?focus=create',
      title: '建立本月预算',
      detail: '先分配本月可支出金额',
    }] : []),
  ].slice(0, 3);

  if (actionItems.length === 0) {
    actionItems.push({
      href: '/management/budget?focus=review',
      title: '检查本月预算执行',
      detail: '保持现在的支出节奏',
    });
  }

  const status = statusConfig[statusTone];
  const primaryAction = actionItems[0];
  const secondaryActions = actionItems.slice(1);
  const dataConfidenceItems = [
    ...(!hasCashflowData ? ['待补流水'] : []),
    ...(budgetProgress.length === 0 ? ['待建预算'] : []),
    ...(missingSourceCount > 0 ? ['待补来源'] : []),
    ...(pricesStale ? ['价格待刷新'] : []),
  ];
  const dataConfidenceTone: StatusTone = dataConfidenceItems.length > 2
    ? 'danger'
    : dataConfidenceItems.length > 0
      ? 'warning'
      : 'safe';
  const dataConfidence = statusConfig[dataConfidenceTone];
  const dataConfidenceLabel = dataConfidenceItems.length === 0 ? '判断依据完整' : '待补数据';
  const dataConfidenceDetail = dataConfidenceItems.length === 0
    ? '现金流、预算、账户来源和价格状态都可用于首页判断。'
    : dataConfidenceItems.join(' · ');
  const safetyRatio = Math.max(0, Math.min(100, (
    (coverageMonths === null ? 30 : Math.min(coverageMonths / 6, 1) * 34) +
    (monthSurplus >= 0 ? 28 : 0) +
    (surplusRate >= 25 ? 24 : Math.max(0, surplusRate / 25) * 24) +
    (overBudgetCount === 0 ? 14 : 0)
  )));

  const metrics = [
    {
      label: '一级流动性',
      value: formatMonths(coverageMonths),
      detail: <AmountDisplay amount={tier1Total} className="font-medium" />,
    },
    {
      label: '预算剩余',
      value: <AmountDisplay amount={budgetRemaining} className="font-medium" />,
      detail: budgetProgress.length > 0 ? `${budgetProgress.length} 个预算正在执行` : '尚未建立预算',
    },
    {
      label: '本月结余',
      value: <AmountDisplay amount={monthSurplus} showSign className="font-medium" />,
      detail: `收入 ${currentIncome > 0 ? '已记录' : '未记录'} · 支出 ${currentExpense > 0 ? '已记录' : '未记录'}`,
    },
    {
      label: '净资产率',
      value: `${surplusRate.toFixed(1)}%`,
      detail: (
        <>
          总资产 <AmountDisplay amount={totalAssets} className="font-medium" /> · 负债 <AmountDisplay amount={totalLiabilities} className="font-medium" />
        </>
      ),
    },
  ];

  const evidenceItems = [
    {
      label: '现金流',
      tone: !hasCashflowData ? 'warning' as StatusTone : monthSurplus < 0 ? 'danger' as StatusTone : 'safe' as StatusTone,
      value: !hasCashflowData ? '待补流水' : monthSurplus < 0 ? '本月倒挂' : '结余为正',
      detail: <AmountDisplay amount={monthSurplus} showSign className="font-medium" />,
    },
    {
      label: '流动性',
      tone: coverageMonths === null ? 'warning' as StatusTone : coverageMonths < 3 ? 'danger' as StatusTone : coverageMonths < 6 ? 'warning' as StatusTone : 'safe' as StatusTone,
      value: coverageMonths === null ? '待观察' : coverageMonths < 3 ? '低于3个月' : coverageMonths < 6 ? '未满6个月' : '已覆盖',
      detail: `覆盖 ${formatMonths(coverageMonths)}`,
    },
    {
      label: '预算',
      tone: budgetProgress.length === 0 ? 'warning' as StatusTone : overBudgetCount > 0 ? 'danger' as StatusTone : 'safe' as StatusTone,
      value: budgetProgress.length === 0 ? '待建立' : overBudgetCount > 0 ? `${overBudgetCount}项超支` : '未超支',
      detail: budgetProgress.length > 0
        ? `剩余 ${budgetRemaining.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 元`
        : '还没有预算基准',
    },
    {
      label: '账户记录',
      tone: missingSourceCount > 0 ? 'warning' as StatusTone : 'safe' as StatusTone,
      value: missingSourceCount > 0 ? '待补来源' : '已关联',
      detail: missingSourceCount > 0 ? `${missingSourceCount} 笔支出` : '支出有付款账户',
    },
  ];

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-body" style={{ padding: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 18,
              minHeight: 210,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>家庭财务状态</span>
                <span
                  style={{
                    padding: '4px 9px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: status.accent,
                    background: status.background,
                  }}
                >
                  {status.label}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.25 }}>
                {status.title}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {status.detail}
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: `1px solid ${dataConfidence.background}`,
                  background: dataConfidence.background,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>判断可信度</span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {dataConfidenceDetail}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: dataConfidence.accent }}>
                  {dataConfidenceLabel}
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>判断依据</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  {evidenceItems.map((item) => {
                    const tone = statusConfig[item.tone];

                    return (
                      <div
                        key={item.label}
                        style={{
                          minWidth: 0,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${tone.background}`,
                          background: tone.background,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: tone.accent }}>{item.value}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-primary)' }}>
                          {item.detail}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>安全度</span>
                <span style={{ fontSize: 12, color: status.accent, fontWeight: 700 }}>{Math.round(safetyRatio)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--color-container-inset)', overflow: 'hidden', marginTop: 8 }}>
                <div
                  style={{
                    width: `${safetyRatio}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: status.accent,
                  }}
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>净资产</div>
                <AmountDisplay amount={netWorth} className="font-bold" />
              </div>
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
              alignContent: 'stretch',
            }}
          >
            {metrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  padding: 14,
                  border: '1px solid var(--border-tertiary)',
                  borderRadius: 8,
                  background: 'var(--color-container-inset)',
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{metric.label}</div>
                <div style={{ fontSize: 18, color: 'var(--color-text-primary)', fontWeight: 700, minHeight: 24 }}>
                  {metric.value}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  {metric.detail}
                </div>
              </div>
            ))}
          </section>

          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>下一步</span>
              <Link href="/management/ledger?focus=create" className="btn btn-outline btn-sm">记一笔</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {primaryAction && (
                <Link
                  href={primaryAction.href}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr',
                    gap: 10,
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: 8,
                    border: `1px solid ${status.background}`,
                    color: 'inherit',
                    textDecoration: 'none',
                    background: status.background,
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: status.accent,
                      color: status.accentText,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    1
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: status.accent }}>优先做这件事</span>
                    <span style={{ display: 'block', marginTop: 3, fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 800 }}>{primaryAction.title}</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--color-text-secondary)' }}>{primaryAction.detail}</span>
                  </span>
                </Link>
              )}

              {secondaryActions.map((item, index) => (
                <Link
                  key={`${item.href}-${item.title}`}
                  href={item.href}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr',
                    gap: 10,
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-tertiary)',
                    color: 'inherit',
                    textDecoration: 'none',
                    background: 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-container-inset)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {index + 2}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 700 }}>{item.title}</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
