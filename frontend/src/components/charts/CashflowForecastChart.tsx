import ReactECharts from 'echarts-for-react';

interface Props {
  months: string[];
  surplus: number[];
  cumulative: number[];
}

export default function CashflowForecastChart({ months, surplus, cumulative }: Props) {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['月度盈余', '累积盈余'], textStyle: { color: '#94a3b8' } },
    xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#94a3b8' } } },
    yAxis: [
      { type: 'value', name: '月度', axisLine: { lineStyle: { color: '#94a3b8' } }, splitLine: { lineStyle: { color: '#1e293b' } } },
      { type: 'value', name: '累积', axisLine: { lineStyle: { color: '#94a3b8' } }, splitLine: { show: false } },
    ],
    series: [
      { name: '月度盈余', type: 'bar', data: surplus.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? '#10b981' : '#ef4444' } })) },
      { name: '累积盈余', type: 'line', yAxisIndex: 1, data: cumulative, smooth: true, lineStyle: { color: '#3b82f6', width: 3 } },
    ],
  };
  return <ReactECharts option={option} style={{ height: '400px', width: '800px' }} />;
}
