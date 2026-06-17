import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AssetRingChart, {
  formatCompactCny,
} from '../src/components/charts/AssetRingChart';

type GraphicChild = {
  style?: {
    text?: string;
  };
};

const chartElement = AssetRingChart({
  data: [{ name: '现金', value: 100_000, itemStyle: { color: '#10b981' } }],
  centerMetrics: {
    totalAssets: 1_286_420,
    tier1Total: 286_000,
    tier2Total: 746_000,
  },
});

const option = chartElement.props.option;
const graphicChildren = option.graphic.children as GraphicChild[];

assert.equal(formatCompactCny(1_286_420), '¥128.64万');
assert.equal(formatCompactCny(86_000), '¥8.60万');
assert.equal(formatCompactCny(900), '¥900.00');

assert.equal(option.series[0].radius[0], '58%');
assert.equal(option.series[0].radius[1], '78%');
assert.equal(option.graphic.type, 'group');
assert.equal(option.graphic.left, 'center');
assert.equal(option.graphic.top, 'middle');
assert(
  graphicChildren.some(child => child.style?.text === '总资产'),
  'Asset ring center should label total assets.',
);
assert(
  graphicChildren.some(child => child.style?.text === '¥128.64万'),
  'Asset ring center should show compact total assets.',
);
assert(
  graphicChildren.some(child => child.style?.text === '一级流动性'),
  'Asset ring center should show tier 1 liquidity.',
);
assert(
  graphicChildren.some(child => child.style?.text === '¥28.60万 · 22%'),
  'Asset ring center should show tier 1 value and share.',
);
assert(
  graphicChildren.some(child => child.style?.text === '二级流动性'),
  'Asset ring center should show tier 2 liquidity.',
);
assert(
  graphicChildren.some(child => child.style?.text === '¥74.60万 · 58%'),
  'Asset ring center should show tier 2 value and share.',
);

const dashboardSource = readFileSync(
  resolve(process.cwd(), 'src/app/(dashboard)/DashboardClient.tsx'),
  'utf8',
);

assert(dashboardSource.includes('centerMetrics={{'));
assert(dashboardSource.includes('totalAssets: totalAssets.toNumber()'));
assert(dashboardSource.includes('tier1Total'));
assert(dashboardSource.includes('tier2Total'));
