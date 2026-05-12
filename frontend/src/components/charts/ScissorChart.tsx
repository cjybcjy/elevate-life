import ReactECharts from 'echarts-for-react';

interface Props {
  months: string[];
  income: number[];
  expense: number[];
  survivalLine: number;
}

export default function ScissorChart({ months, income, expense, survivalLine }: Props) {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出', '生存线'], textStyle: { color: '#94a3b8' } },
    xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#94a3b8' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: '#94a3b8' } }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: '收入', type: 'line', data: income, smooth: true, lineStyle: { color: '#3b82f6', width: 3 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } } },
      { name: '支出', type: 'line', data: expense, smooth: true, lineStyle: { color: '#ef4444', width: 3, type: 'dashed' } },
      { name: '生存线', type: 'line', data: Array(months.length).fill(survivalLine), lineStyle: { color: '#94a3b8', width: 1, type: 'dotted' }, symbol: 'none' },
    ],
  };
  return <ReactECharts option={option} style={{ height: '400px', width: '800px' }} />;
}
