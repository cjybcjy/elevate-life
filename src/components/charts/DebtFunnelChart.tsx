'use client';

import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number; rate: number }[];
}

export default function DebtFunnelChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-[240px] flex items-center justify-center text-ledger-muted">暂无负债</div>;
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const colors = sorted.map(item =>
    item.rate > 6 ? '#ef4444' : item.rate > 5 ? '#f59e0b' : '#3b82f6'
  );

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const item = sorted.find(d => d.name === params.name);
        const rate = item ? item.rate.toFixed(2) : '0';
        return `${params.name}<br/>余额: ¥${params.value.toLocaleString()}<br/>占比: ${params.percent}%<br/>利率: ${rate}%`;
      },
      backgroundColor: 'rgba(15,23,42,0.95)',
      borderColor: '#334155',
      textStyle: { color: '#fff', fontSize: 12 },
    },
    legend: {
      orient: 'vertical' as const,
      right: 0,
      top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
    },
    series: [{
      type: 'pie',
      radius: ['40%', '75%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'inside' as const,
        formatter: (params: any) => `${params.percent}%`,
        color: '#fff',
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

  return <ReactECharts option={option} style={{ height: '240px', width: '100%' }} />;
}
