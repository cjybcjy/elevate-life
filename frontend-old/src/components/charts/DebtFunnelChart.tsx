import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number; rate: number }[];
}

export default function DebtFunnelChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.rate - a.rate);
  const option = {
    series: [{
      type: 'funnel', sort: 'none', gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: (params: any) => {
          const item = sorted.find(d => d.name === params.name);
          const rate = item ? item.rate.toFixed(2) : '0';
          return `${params.name}\n¥${params.value.toLocaleString()}\n${rate}%`;
        },
        color: '#fff',
        fontSize: 12,
      },
      data: sorted.map((item) => ({
        name: item.name,
        value: item.value,
        itemStyle: { color: item.rate > 0.06 ? '#ef4444' : item.rate > 0.05 ? '#f59e0b' : '#3b82f6' },
      })),
    }],
  };
  return <ReactECharts option={option} style={{ height: '400px', width: '500px' }} />;
}
