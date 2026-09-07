'use client';

import ReactECharts from '@/components/charts/EChart';

interface Props {
  data: { name: string; value: number; itemStyle?: { color: string } }[];
  centerMetrics?: {
    totalAssets: number;
    tier1Total: number;
    tier2Total: number;
  };
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function formatCompactCny(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 100_000_000) {
    return `${sign}¥${(abs / 100_000_000).toFixed(2)}亿`;
  }

  if (abs >= 10_000) {
    return `${sign}¥${(abs / 10_000).toFixed(2)}万`;
  }

  return `${sign}¥${abs.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShare(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function buildCenterGraphic(
  centerMetrics: NonNullable<Props['centerMetrics']>,
  labelColor: string,
  mutedColor: string,
  borderColor: string,
) {
  const tier1Share = formatShare(centerMetrics.tier1Total, centerMetrics.totalAssets);
  const tier2Share = formatShare(centerMetrics.tier2Total, centerMetrics.totalAssets);

  return {
    type: 'group',
    left: 'center',
    top: 'middle',
    silent: true,
    children: [
      {
        type: 'text',
        y: -53,
        style: {
          text: '总资产',
          fill: mutedColor,
          fontSize: 11,
          fontWeight: 500,
          align: 'center',
        },
      },
      {
        type: 'text',
        y: -35,
        style: {
          text: formatCompactCny(centerMetrics.totalAssets),
          fill: labelColor,
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          align: 'center',
        },
      },
      {
        type: 'line',
        shape: { x1: -52, y1: -11, x2: 52, y2: -11 },
        style: { stroke: borderColor, lineWidth: 1 },
      },
      {
        type: 'text',
        y: 4,
        style: {
          text: '一级流动性',
          fill: mutedColor,
          fontSize: 10,
          fontWeight: 500,
          align: 'center',
        },
      },
      {
        type: 'text',
        y: 19,
        style: {
          text: `${formatCompactCny(centerMetrics.tier1Total)} · ${tier1Share}`,
          fill: labelColor,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          align: 'center',
        },
      },
      {
        type: 'text',
        y: 38,
        style: {
          text: '二级流动性',
          fill: mutedColor,
          fontSize: 10,
          fontWeight: 500,
          align: 'center',
        },
      },
      {
        type: 'text',
        y: 53,
        style: {
          text: `${formatCompactCny(centerMetrics.tier2Total)} · ${tier2Share}`,
          fill: labelColor,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          align: 'center',
        },
      },
    ],
  };
}

export default function AssetRingChart({ data, centerMetrics }: Props) {
  const bgColor = getCSSVar('--color-chart-bg', '#ffffff');
  const labelColor = getCSSVar('--color-chart-label', '#212529');
  const mutedColor = getCSSVar('--color-text-secondary', '#737373');
  const borderColor = getCSSVar('--color-table-border', 'rgba(0,0,0,0.08)');

  const option = {
    animation: false,
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ¥${params.value.toLocaleString()}<br/>占比: ${params.percent}%`,
    },
    ...(centerMetrics
      ? { graphic: buildCenterGraphic(centerMetrics, labelColor, mutedColor, borderColor) }
      : {}),
    series: [{
      type: 'pie',
      radius: ['58%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: bgColor,
        borderWidth: 3,
      },
      label: {
        show: false,
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold' as const,
          color: labelColor,
        },
        scaleSize: 8,
      },
      data: data,
    }],
  };
  return <ReactECharts option={option} style={{ height: '280px', width: '280px' }} />;
}
