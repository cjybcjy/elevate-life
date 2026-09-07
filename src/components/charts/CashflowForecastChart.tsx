'use client';

import Link from 'next/link';
import ReactECharts from '@/components/charts/EChart';
import {
  buildProjectedAvailableCash,
  type GoalContributionEvent,
} from '@/lib/goal-forecast';

interface Props {
  months: string[];
  cumulative: number[];
  currentCash?: number;
  contributionEvents?: GoalContributionEvent[];
  safetyThreshold?: number | null;
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCompactCny(value: number) {
  const absValue = Math.abs(value);

  if (absValue >= 10_000) {
    const wan = value / 10_000;
    return `¥${wan.toLocaleString('zh-CN', {
      maximumFractionDigits: Math.abs(wan) >= 100 ? 0 : 1,
    })}万`;
  }

  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatFullCny(value: number) {
  return `¥${safeNumber(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatMonth(value: string) {
  const [year, month] = value.split('-');
  return year && month ? `${Number(month)}月` : value;
}

function formatEventDate(value: string) {
  const [, month, day] = value.split('-');
  return month && day ? `${Number(month)}月${Number(day)}日` : value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function getNiceStep(span: number) {
  if (!Number.isFinite(span) || span <= 0) return 1;

  const roughStep = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceBase * magnitude;
}

function getSmartCashAxisBounds(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return {};

  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  const rawSpan = maxValue - minValue;
  const span = rawSpan > 0
    ? rawSpan
    : Math.max(Math.abs(maxValue) * 0.2, Math.abs(minValue) * 0.2, 10_000);
  const padding = span * 0.12;
  const lowerBase = minValue > 0 ? minValue - padding : Math.min(0, minValue - padding);
  const upperBase = maxValue < 0 ? Math.max(0, maxValue + padding) : maxValue + padding;
  const step = getNiceStep(upperBase - lowerBase);
  const axisMin = Math.floor(lowerBase / step) * step;
  const axisMax = Math.ceil(upperBase / step) * step;

  return {
    min: minValue > 0 ? Math.max(0, axisMin) : axisMin,
    max: axisMax === axisMin ? axisMin + step : axisMax,
  };
}

export default function CashflowForecastChart({
  months,
  cumulative,
  currentCash = 0,
  contributionEvents = [],
  safetyThreshold = null,
}: Props) {
  const axisColor = getCSSVar('--color-chart-label', '#4b5563');
  const splitLineColor = getCSSVar('--border-tertiary', 'rgba(15,23,42,0.12)');
  const surfaceColor = getCSSVar('--color-container', '#ffffff');
  const projectedCash = buildProjectedAvailableCash({
    months,
    cumulative,
    currentCash,
    events: contributionEvents,
  });
  const finiteSafetyThreshold = safetyThreshold === null ? null : safeNumber(safetyThreshold);
  const axisValues = finiteSafetyThreshold === null
    ? projectedCash
    : [...projectedCash, finiteSafetyThreshold];
  const cashAxisBounds = getSmartCashAxisBounds(axisValues);
  const eventsByMonth = new Map<string, GoalContributionEvent[]>();

  for (const event of contributionEvents) {
    eventsByMonth.set(event.month, [...(eventsByMonth.get(event.month) ?? []), event]);
  }

  const eventPoints = months.flatMap((month, index) => {
    const events = eventsByMonth.get(month) ?? [];
    if (events.length === 0) return [];

    return [{
      name: '已安排供款',
      value: [month, projectedCash[index]],
      events,
      itemStyle: {
        color: '#7c3aed',
        borderColor: surfaceColor,
        borderWidth: 2,
      },
    }];
  });

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (rawParams: any) => {
        const params = Array.isArray(rawParams) ? rawParams : [rawParams];
        const month = String(params[0]?.axisValue ?? '');
        const monthIndex = months.indexOf(month);
        const events = eventsByMonth.get(month) ?? [];
        const rows = [
          `<strong>${escapeHtml(month)}</strong>`,
          `预计可用现金 ${formatFullCny(projectedCash[monthIndex] ?? 0)}`,
        ];

        for (const event of events) {
          rows.push(`${escapeHtml(formatEventDate(event.date))} ${escapeHtml(event.goalName)} -${formatFullCny(event.amount)}`);
        }

        return rows.join('<br/>');
      },
    },
    grid: {
      left: 12,
      right: 14,
      top: 28,
      bottom: 28,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: months,
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: {
        color: axisColor,
        formatter: formatMonth,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      name: '可用现金',
      nameTextStyle: { color: axisColor, align: 'left' },
      axisLabel: { color: axisColor, formatter: (value: number) => formatCompactCny(value) },
      splitLine: { lineStyle: { color: splitLineColor } },
      min: cashAxisBounds.min,
      max: cashAxisBounds.max,
    },
    series: [
      {
        name: '未来可用现金',
        type: 'line',
        data: projectedCash,
        smooth: 0.25,
        showSymbol: false,
        symbol: 'circle',
        lineStyle: { color: '#2563eb', width: 3 },
        itemStyle: { color: '#2563eb' },
        areaStyle: { color: 'rgba(37, 99, 235, 0.08)' },
        markLine: finiteSafetyThreshold !== null ? {
          silent: true,
          symbol: ['none', 'none'],
          data: [{
            name: '安全线',
            yAxis: finiteSafetyThreshold,
            lineStyle: { color: '#dc2626', type: 'dashed', width: 1.5 },
            label: {
              show: true,
              formatter: `安全线 ${formatCompactCny(finiteSafetyThreshold)}`,
              color: '#dc2626',
              position: 'insideEndTop',
            },
          }],
        } : undefined,
      },
      {
        name: '已安排供款',
        type: 'scatter',
        data: eventPoints,
        symbolSize: 11,
        z: 5,
      },
    ],
  };

  if (months.length === 0) {
    return (
      <div style={{ minHeight: 240, display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        暂无现金流预测
      </div>
    );
  }

  const visibleEvents = contributionEvents.slice(0, 4);
  const totalContribution = contributionEvents.reduce((sum, event) => sum + event.amount, 0);
  const averageMonthly = totalContribution / months.length;

  return (
    <div aria-label="未来可用现金预测">
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 2 }}>
        近期 · 未来会不会缺钱
      </div>
      <ReactECharts option={option} style={{ height: 310, width: '100%' }} />

      {visibleEvents.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          <div style={{ color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 700 }}>
            已安排的目标供款
          </div>
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>{formatEventDate(event.date)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
                存入{event.goalName}
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>-{formatFullCny(event.amount)}</span>
            </div>
          ))}
          {contributionEvents.length > visibleEvents.length && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
              另有 {contributionEvents.length - visibleEvents.length} 次供款已计入预测
            </div>
          )}
          <div
            style={{
              marginTop: 4,
              paddingTop: 10,
              borderTop: '1px solid var(--border-tertiary)',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            已包含未来 {months.length} 个月储蓄目标供款 <strong style={{ color: 'var(--color-text-primary)' }}>{formatFullCny(totalContribution)}</strong>
            {' · '}平均每月 <strong style={{ color: 'var(--color-text-primary)' }}>{formatFullCny(averageMonthly)}</strong>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 4,
            paddingTop: 10,
            borderTop: '1px solid var(--border-tertiary)',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <span>尚无已关联的目标供款；目标需绑定资产，并用周期转账存入该资产。</span>
          <Link href="/management/recurring" className="btn btn-outline btn-sm">管理周期转账</Link>
        </div>
      )}
    </div>
  );
}
