'use client';

import ReactECharts from 'echarts-for-react';
import { getDebtChartColor, PAID_PROGRESS_COLOR } from '@/lib/debt-colors';

const TRANSPARENT_SEGMENT_COLOR = 'rgba(0,0,0,0)';
const DEBT_RING_RADIUS = ['50%', '78%'] as const;
const DEBT_RING_CENTER = ['50%', '50%'] as const;
const DEBT_PROJECT_GAP_DEGREES = 4;
const MAX_TOTAL_GAP_DEGREES = 48;

export interface DebtChartDatum {
  name: string;
  value: number;
  rate: number;
  paid?: number;
  principal?: number;
}

export interface DebtFunnelSegment {
  name: string;
  value: number;
  amount: number;
  debtName: string;
  segment: 'debt' | 'remaining' | 'paid' | 'gap';
  rate: number;
  paidPercent: number;
  remainingPercent: number;
  debtSharePercent: number;
  itemStyle: { color: string };
  label?: { color?: string; show?: boolean };
  tooltip?: { show: boolean };
}

interface Props {
  data: DebtChartDatum[];
  size?: number;
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function buildDebtFunnelSeriesData(data: DebtChartDatum[]): DebtFunnelSegment[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const totalCurrentBalance = sorted.reduce((sum, item) => sum + Math.max(0, item.value || 0), 0);

  if (totalCurrentBalance <= 0) return [];

  return sorted.flatMap((item, i) => {
    const remaining = Math.max(0, item.value || 0);
    if (remaining <= 0) return [];

    const inferredPaid = item.paid ?? Math.max(0, (item.principal ?? 0) - remaining);
    const paid = Math.max(0, inferredPaid || 0);
    const basis = Math.max(remaining + paid, 1);
    const paidRatio = Math.max(0, Math.min(paid / basis, 1));
    const remainingRatio = 1 - paidRatio;
    const paidPercent = paidRatio * 100;
    const remainingPercent = remainingRatio * 100;
    const debtSharePercent = (remaining / totalCurrentBalance) * 100;
    const remainingVisualValue = paid > 0 ? Math.round(remaining * remainingRatio * 100) / 100 : remaining;
    const paidVisualValue = paid > 0 ? Math.max(0, Math.round((remaining - remainingVisualValue) * 100) / 100) : 0;
    const debtColor = getDebtChartColor(i);
    const segments: DebtFunnelSegment[] = [];

    if (remaining > 0) {
      segments.push({
        name: item.name,
        value: remainingVisualValue,
        amount: remaining,
        debtName: item.name,
        segment: 'remaining',
        rate: item.rate,
        paidPercent,
        remainingPercent,
        debtSharePercent,
        itemStyle: { color: debtColor },
      });
    }

    if (paid > 0 && paidVisualValue > 0) {
      segments.push({
        name: `${item.name}已还`,
        value: paidVisualValue,
        amount: paid,
        debtName: item.name,
        segment: 'paid',
        rate: item.rate,
        paidPercent,
        remainingPercent,
        debtSharePercent,
        itemStyle: { color: PAID_PROGRESS_COLOR },
        label: { color: '#334155' },
      });
    }

    return segments;
  });
}

function formatDebtLabel(params: any) {
  const item = params.data as DebtFunnelSegment | undefined;
  if (!item) return '';
  if (item.segment !== 'debt') return '';

  const percent = item.debtSharePercent;
  return percent >= 6 ? `${percent.toFixed(0)}%` : '';
}

function getDebtProjectGapValue(total: number, projectCount: number) {
  if (projectCount < 2 || total <= 0) return 0;

  const gapDegrees = Math.min(
    DEBT_PROJECT_GAP_DEGREES,
    MAX_TOTAL_GAP_DEGREES / projectCount,
  );
  return (gapDegrees * total) / (360 - gapDegrees * projectCount);
}

function createDebtProjectGap(index: number, value: number, bgColor: string): DebtFunnelSegment {
  return {
    name: `负债项目间隔-${index}`,
    value,
    amount: 0,
    debtName: '',
    segment: 'gap',
    rate: 0,
    paidPercent: 0,
    remainingPercent: 0,
    debtSharePercent: 0,
    itemStyle: { color: bgColor },
    label: { show: false },
    tooltip: { show: false },
  };
}

export function buildDebtFunnelSeriesOptions(data: DebtChartDatum[], bgColor: string, labelColor: string) {
  const progressData = buildDebtFunnelSeriesData(data);
  const compositionData = progressData
    .filter((segment) => segment.segment === 'remaining')
    .map((segment): DebtFunnelSegment => ({
      ...segment,
      name: segment.debtName,
      value: segment.amount,
      segment: 'debt',
    }));
  const totalCurrentBalance = compositionData.reduce((sum, segment) => sum + segment.value, 0);
  const gapValue = getDebtProjectGapValue(totalCurrentBalance, compositionData.length);
  const compositionWithGaps = compositionData.flatMap((segment, index) => (
    gapValue > 0
      ? [segment, createDebtProjectGap(index, gapValue, bgColor)]
      : [segment]
  ));
  const progressByDebt = new Map<string, DebtFunnelSegment[]>();
  for (const segment of progressData) {
    const debtProgress = progressByDebt.get(segment.debtName) ?? [];
    debtProgress.push(segment);
    progressByDebt.set(segment.debtName, debtProgress);
  }
  const paidOverlayData = compositionData.flatMap((debt, index) => {
    const debtProgress = (progressByDebt.get(debt.debtName) ?? [])
      .map((segment): DebtFunnelSegment => ({
        ...segment,
        itemStyle: {
          color: segment.segment === 'paid' ? PAID_PROGRESS_COLOR : TRANSPARENT_SEGMENT_COLOR,
        },
        label: { color: labelColor },
      }));

    return gapValue > 0
      ? [...debtProgress, createDebtProjectGap(index, gapValue, bgColor)]
      : debtProgress;
  });

  return [
    {
      type: 'pie',
      radius: DEBT_RING_RADIUS,
      center: DEBT_RING_CENTER,
      avoidLabelOverlap: false,
      padAngle: 0,
      itemStyle: {
        borderRadius: 0,
        borderColor: bgColor,
        borderWidth: 0,
      },
      label: {
        show: true,
        position: 'inside' as const,
        formatter: formatDebtLabel,
        color: labelColor,
        fontSize: 11,
        fontWeight: 'bold' as const,
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' as const },
        scaleSize: 6,
      },
      data: compositionWithGaps,
    },
    {
      type: 'pie',
      radius: DEBT_RING_RADIUS,
      center: DEBT_RING_CENTER,
      avoidLabelOverlap: false,
      padAngle: 0,
      silent: true,
      itemStyle: {
        borderRadius: 0,
        borderColor: 'transparent',
        borderWidth: 0,
      },
      label: { show: false },
      emphasis: { disabled: true },
      data: paidOverlayData,
    },
  ];
}

export default function DebtFunnelChart({ data, size = 260 }: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ color: 'var(--color-text-secondary)', height: size, width: '100%' }}
      >
        暂无负债
      </div>
    );
  }

  const seriesData = buildDebtFunnelSeriesData(data);
  if (seriesData.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ color: 'var(--color-text-secondary)', height: size, width: '100%' }}
      >
        暂无负债
      </div>
    );
  }

  const bgColor = getCSSVar('--color-chart-bg', '#ffffff');
  const labelColor = getCSSVar('--color-chart-label', '#212529');

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const item = params.data as DebtFunnelSegment | undefined;
        if (!item || item.segment === 'gap') return '';

        const label = item.segment === 'paid' ? '已还' : item.segment === 'debt' ? '余额' : '剩余';
        return [
          item.debtName,
          `${label}: ¥${item.amount.toLocaleString()}`,
          `负债占比: ${item.debtSharePercent.toFixed(1)}%`,
          `进度: 已还 ${item.paidPercent.toFixed(0)}% · 剩余 ${item.remainingPercent.toFixed(0)}%`,
          `利率: ${item.rate.toFixed(2)}%`,
        ].join('<br/>');
      },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#dee2e6',
      textStyle: { color: '#212529', fontSize: 12 },
    },
    legend: { show: false },
    series: buildDebtFunnelSeriesOptions(data, bgColor, labelColor),
  };

  return <ReactECharts option={option} style={{ height: `${size}px`, width: '100%' }} />;
}
