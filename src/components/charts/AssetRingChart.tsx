'use client';

import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number; itemStyle?: { color: string } }[];
}

export default function AssetRingChart({ data }: Props) {
  const option = {
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: typeof document !== 'undefined'
          ? getComputedStyle(document.documentElement).getPropertyValue('--color-chart-bg').trim() || '#ffffff'
          : '#ffffff',
        borderWidth: 2,
      },
      label: {
        show: true,
        position: 'inside',
        color: typeof document !== 'undefined'
          ? getComputedStyle(document.documentElement).getPropertyValue('--color-chart-label').trim() || '#212529'
          : '#212529',
        fontSize: 13,
        fontWeight: 'bold',
        formatter: '{b}\n{d}%',
      },
      emphasis: {
        label: { fontSize: 16 },
        scaleSize: 6,
      },
      data: data.map((item, i) => ({
        ...item,
        itemStyle: item.itemStyle || { color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] },
      })),
    }],
  };
  return <ReactECharts option={option} style={{ height: '260px', width: '260px' }} />;
}
