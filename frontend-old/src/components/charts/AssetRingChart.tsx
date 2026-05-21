import ReactECharts from 'echarts-for-react';

interface Props {
  data: { name: string; value: number }[];
}

export default function AssetRingChart({ data }: Props) {
  const option = {
    series: [{
      type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#0f172a', borderWidth: 2 },
      label: { show: true, color: '#fff', formatter: '{b}\n{d}%' },
      data: data.map((item, i) => ({
        ...item,
        itemStyle: { color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] },
      })),
    }],
  };
  return <ReactECharts option={option} style={{ height: '300px', width: '300px' }} />;
}
