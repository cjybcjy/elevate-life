'use client';

import type { ReactNode } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  USED_BUDGET_COLOR,
  type AnnualBudgetOverview,
  type AnnualBudgetRingSegment,
} from '@/lib/annual-budget';

const TRANSPARENT_SEGMENT_COLOR = 'rgba(0,0,0,0)';
const BUDGET_RING_RADIUS = ['52%', '78%'] as const;
const BUDGET_RING_CENTER = ['50%', '50%'] as const;
const BUDGET_GAP_DEGREES = 3;
const MAX_TOTAL_GAP_DEGREES = 48;

interface BudgetRingDatum extends AnnualBudgetRingSegment {
  value: number;
  phase: 'budget' | 'remaining' | 'used' | 'gap';
  itemStyle: { color: string };
  label?: { show?: boolean };
  tooltip?: { show: boolean };
}

export interface AnnualBudgetExecutionRow extends AnnualBudgetRingSegment {
  usedPercent: number;
  isOverBudget: boolean;
}

interface AnnualBudgetRingChartProps {
  overview: AnnualBudgetOverview;
  expandedBudgetId?: string | null;
  onToggleBudget?: (budgetId: string) => void;
  renderBudgetDetails?: (budgetId: string, segment: AnnualBudgetExecutionRow) => ReactNode;
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function formatCny(value: number) {
  return `¥${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactCny(value: number) {
  if (Math.abs(value) >= 10_000) return `¥${(value / 10_000).toFixed(1)}万`;
  return formatCny(value);
}

export function buildAnnualBudgetExecutionRows(
  overview: AnnualBudgetOverview,
): AnnualBudgetExecutionRow[] {
  return overview.segments.map((segment) => ({
    ...segment,
    usedPercent: segment.budgetAmount > 0
      ? Math.min(Math.max((segment.spent / segment.budgetAmount) * 100, 0), 100)
      : 0,
    isOverBudget: segment.remaining < 0,
  }));
}

function getGapValue(total: number, segmentCount: number) {
  if (segmentCount < 2 || total <= 0) return 0;
  const gapDegrees = Math.min(BUDGET_GAP_DEGREES, MAX_TOTAL_GAP_DEGREES / segmentCount);
  return (gapDegrees * total) / (360 - gapDegrees * segmentCount);
}

function createGap(index: number, value: number, bgColor: string): BudgetRingDatum {
  return {
    id: `__budget-gap-${index}`,
    name: '',
    budgetAmount: 0,
    visualAmount: value,
    spent: 0,
    usedVisualAmount: 0,
    remaining: 0,
    sharePercent: 0,
    color: bgColor,
    isLiving: false,
    value,
    phase: 'gap',
    itemStyle: { color: bgColor },
    label: { show: false },
    tooltip: { show: false },
  };
}

export function buildAnnualBudgetRingSeries(
  overview: AnnualBudgetOverview,
  bgColor: string,
) {
  const gapValue = getGapValue(overview.annualAmount, overview.segments.length);
  const compositionData = overview.segments.flatMap((segment, index): BudgetRingDatum[] => {
    const budgetSegment: BudgetRingDatum = {
      ...segment,
      value: segment.visualAmount,
      phase: 'budget',
      itemStyle: { color: segment.color },
    };
    return gapValue > 0
      ? [budgetSegment, createGap(index, gapValue, bgColor)]
      : [budgetSegment];
  });

  const usedOverlayData = overview.segments.flatMap((segment, index): BudgetRingDatum[] => {
    const remainingVisualAmount = Math.max(segment.visualAmount - segment.usedVisualAmount, 0);
    const items: BudgetRingDatum[] = [];

    if (remainingVisualAmount > 0) {
      items.push({
        ...segment,
        value: remainingVisualAmount,
        phase: 'remaining',
        itemStyle: { color: TRANSPARENT_SEGMENT_COLOR },
      });
    }
    if (segment.usedVisualAmount > 0) {
      items.push({
        ...segment,
        value: segment.usedVisualAmount,
        phase: 'used',
        itemStyle: { color: USED_BUDGET_COLOR },
      });
    }
    if (gapValue > 0) items.push(createGap(index, gapValue, bgColor));
    return items;
  });

  return { compositionData, usedOverlayData };
}

function buildCenterGraphic(overview: AnnualBudgetOverview, labelColor: string, mutedColor: string) {
  return {
    type: 'group',
    left: 'center',
    top: 'middle',
    silent: true,
    children: [
      {
        type: 'text',
        y: -28,
        style: {
          text: '年度预算',
          fill: mutedColor,
          fontSize: 11,
          fontWeight: 500,
          align: 'center',
        },
      },
      {
        type: 'text',
        y: -7,
        style: {
          text: formatCompactCny(overview.annualAmount),
          fill: labelColor,
          fontSize: 20,
          fontWeight: 750,
          align: 'center',
        },
      },
      {
        type: 'text',
        y: 20,
        style: {
          text: `已用 ${overview.usedPercent.toFixed(0)}%`,
          fill: mutedColor,
          fontSize: 11,
          fontWeight: 500,
          align: 'center',
        },
      },
    ],
  };
}

export default function AnnualBudgetRingChart({
  overview,
  expandedBudgetId = null,
  onToggleBudget,
  renderBudgetDetails,
}: AnnualBudgetRingChartProps) {
  const bgColor = getCSSVar('--color-chart-bg', '#ffffff');
  const labelColor = getCSSVar('--color-chart-label', '#212529');
  const mutedColor = getCSSVar('--color-text-secondary', '#737373');
  const { compositionData, usedOverlayData } = buildAnnualBudgetRingSeries(overview, bgColor);
  const executionRows = buildAnnualBudgetExecutionRows(overview);

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { data?: BudgetRingDatum }) => {
        const item = params.data;
        if (!item || item.phase === 'gap') return '';
        return [
          item.name,
          `预算: ${formatCny(item.budgetAmount)}`,
          `已用: ${formatCny(item.spent)}`,
          `剩余: ${formatCny(item.remaining)}`,
          `年度占比: ${item.sharePercent.toFixed(1)}%`,
        ].join('<br/>');
      },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#dee2e6',
      textStyle: { color: '#212529', fontSize: 12 },
    },
    legend: { show: false },
    graphic: buildCenterGraphic(overview, labelColor, mutedColor),
    series: [
      {
        type: 'pie',
        radius: BUDGET_RING_RADIUS,
        center: BUDGET_RING_CENTER,
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 0, borderRadius: 0 },
        label: {
          show: true,
          position: 'inside' as const,
          formatter: (params: { data?: BudgetRingDatum }) => {
            const item = params.data;
            return item?.phase === 'budget' && item.sharePercent >= 8
              ? `${item.sharePercent.toFixed(0)}%`
              : '';
          },
          color: labelColor,
          fontSize: 11,
          fontWeight: 'bold' as const,
        },
        emphasis: { scaleSize: 6 },
        data: compositionData,
      },
      {
        type: 'pie',
        radius: BUDGET_RING_RADIUS,
        center: BUDGET_RING_CENTER,
        silent: true,
        itemStyle: { borderWidth: 0, borderRadius: 0 },
        label: { show: false },
        emphasis: { disabled: true },
        data: usedOverlayData,
      },
    ],
  };

  return (
    <section
      className="rounded-xl bg-ledger-surface p-4"
      aria-label="年度预算分配与执行"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">年度预算分配与执行</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            每项同时显示年度份额和使用进度，未分配部分自动归入生活预算
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <span className="size-2.5 rounded-full" style={{ background: USED_BUDGET_COLOR }} />
          灰色为已使用
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-center gap-3 sm:gap-5">
        <div
          role="img"
          aria-label={`年度预算 ${formatCny(overview.annualAmount)}，已使用 ${overview.usedPercent.toFixed(0)}%`}
          className="shrink-0"
        >
          <ReactECharts option={option} style={{ height: '250px', width: '250px' }} />
        </div>
        <div className="grid min-w-0 flex-1 basis-64 gap-2">
          {executionRows.map((segment) => {
            const detailBudgetId = segment.isLiving ? overview.annualBudget.id : segment.id;
            const isExpanded = expandedBudgetId === detailBudgetId;
            const canExpand = Boolean(onToggleBudget && renderBudgetDetails);
            const rowContent = (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-text-primary)]">
                    {segment.name}
                  </span>
                  {segment.isLiving ? (
                    <span className="text-[10px] text-[var(--color-text-secondary)]">自动归集</span>
                  ) : null}
                  <span className="tabular-nums text-[var(--color-text-secondary)]">
                    占 {segment.sharePercent.toFixed(0)}%
                  </span>
                  {canExpand ? (
                    <span
                      data-budget-detail-action="true"
                      className="btn btn-outline btn-sm min-w-12 shrink-0"
                    >
                      {isExpanded ? '收起' : '明细'}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-[var(--color-text-secondary)]">
                  <span>
                    已用 <strong className="font-semibold text-[var(--color-text-primary)]">{formatCompactCny(segment.spent)}</strong>
                    {' / '}{formatCompactCny(segment.budgetAmount)}
                  </span>
                  <span className={segment.isOverBudget ? 'font-semibold text-ledger-danger' : ''}>
                    {segment.isOverBudget
                      ? `超支 ${formatCompactCny(Math.abs(segment.remaining))}`
                      : `剩余 ${formatCompactCny(segment.remaining)}`}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                  style={{ background: segment.color }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${segment.usedPercent}%`, background: USED_BUDGET_COLOR }}
                  />
                </div>
              </>
            );

            return (
              <div key={segment.id} className="overflow-hidden rounded-lg bg-[var(--color-container)]">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => onToggleBudget?.(detailBudgetId)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? '收起' : '查看'}${segment.name}明细`}
                    className="min-h-11 w-full px-3 py-2 text-left transition-colors hover:bg-[var(--color-container-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent"
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className="px-3 py-2">{rowContent}</div>
                )}
                {isExpanded && renderBudgetDetails
                  ? renderBudgetDetails(detailBudgetId, segment)
                  : null}
              </div>
            );
          })}
          {overview.overAllocatedAmount > 0 ? (
            <div className="rounded-lg bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              其他预算合计超出年度预算 {formatCny(overview.overAllocatedAmount)}，环图已按比例折算。
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
}
