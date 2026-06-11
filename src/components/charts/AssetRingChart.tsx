'use client';

import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number; itemStyle?: { color: string } }[];
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function AssetRingChart({ data }: Props) {
  const bgColor = getCSSVar('--color-chart-bg', '#ffffff');
  const labelColor = getCSSVar('--color-chart-label', '#212529');

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => `${params.name}: ¥${params.value.toLocaleString()}<br/>占比: ${params.percent}%`,
    },
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
