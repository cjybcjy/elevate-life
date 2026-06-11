'use client';

import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number; rate: number }[];
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function DebtFunnelChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-[240px] flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>暂无负债</div>;
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const colors = sorted.map(item =>
    item.rate > 6 ? '#ef4444' : item.rate > 5 ? '#f59e0b' : '#3b82f6'
  );

  const labelColor = getCSSVar('--color-chart-label', '#212529');
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const item = sorted.find(d => d.name === params.name);
        const rate = item ? item.rate.toFixed(2) : '0';
        return `${params.name}<br/>余额: ¥${params.value.toLocaleString()}<br/>占比: ${params.percent}%<br/>利率: ${rate}%`;
      },
      backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
      borderColor: isDark ? '#334155' : '#dee2e6',
      textStyle: { color: isDark ? '#fff' : '#212529', fontSize: 12 },
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['40%', '75%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'inside' as const,
        formatter: (params: any) => `${params.percent}%`,
        color: labelColor,
        fontSize: 12,
        fontWeight: 'bold' as const,
      },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' as const },
        scaleSize: 8,
      },
      data: sorted.map((item, i) => ({
        name: item.name,
        value: item.value,
        itemStyle: { color: colors[i] },
      })),
    }],
  };

  return <ReactECharts option={option} style={{ height: '260px', width: '100%' }} />;
}
