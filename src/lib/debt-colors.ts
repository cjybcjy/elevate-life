export const DEBT_CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'] as const;
export const PAID_PROGRESS_COLOR = '#94a3b8';

export function getDebtChartColor(index: number) {
  return DEBT_CHART_COLORS[index % DEBT_CHART_COLORS.length];
}
