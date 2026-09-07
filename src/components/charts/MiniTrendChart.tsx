'use client';

import ReactECharts from '@/components/charts/EChart';

interface Props {
  data: number[];
  labels: string[];
}

export default function MiniTrendChart({ data, labels }: Props) {
  const option = {
    grid: { top: 10, right: 10, bottom: 20, left: 40 },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#94a3b8' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: '#94a3b8' } }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      data, type: 'line', smooth: true, symbol: 'none',
      lineStyle: { color: '#3b82f6', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } },
    }],
  };
  return <ReactECharts option={option} style={{ height: '200px', width: '100%' }} />;
}
