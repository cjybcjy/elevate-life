'use client';

import ReactEChartsCore from 'echarts-for-react/lib/core';
import type { EChartsReactProps } from 'echarts-for-react/lib/types';
import * as echarts from 'echarts/core';
import { LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  PieChart,
  ScatterChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export default function EChart(props: Omit<EChartsReactProps, 'echarts'>) {
  return <ReactEChartsCore echarts={echarts} {...props} />;
}
