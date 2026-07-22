import assert from 'node:assert/strict';
import test from 'node:test';
import { PAID_PROGRESS_COLOR } from '@/lib/debt-colors';
import { buildDebtFunnelSeriesData, buildDebtFunnelSeriesOptions } from './DebtFunnelChart';

test('DebtFunnelChart keeps debt composition by current balance while greying paid progress', () => {
  const segments = buildDebtFunnelSeriesData([
    {
      name: '房贷',
      value: 1_800_000,
      paid: 200_000,
      principal: 2_000_000,
      rate: 3.9,
    },
    {
      name: '信用卡',
      value: 200_000,
      paid: 800_000,
      principal: 1_000_000,
      rate: 12,
    },
  ]);
  const mortgageSegments = segments.filter((segment) => segment.debtName === '房贷');
  const creditSegments = segments.filter((segment) => segment.debtName === '信用卡');

  assert.equal(segments.length, 4);
  assert.equal(segments[0].segment, 'remaining');
  assert.equal(segments[0].name, '房贷');
  assert.equal(segments[0].value, 1_620_000);
  assert.equal(segments[0].amount, 1_800_000);
  assert.equal(segments[0].debtSharePercent, 90);
  assert.equal(segments[0].remainingPercent, 90);
  assert.equal(segments[0].itemStyle.color, '#3b82f6');
  assert.equal(segments[1].segment, 'paid');
  assert.equal(segments[1].name, '房贷已还');
  assert.equal(segments[1].value, 180_000);
  assert.equal(segments[1].amount, 200_000);
  assert.equal(segments[1].debtSharePercent, 90);
  assert.equal(segments[1].paidPercent, 10);
  assert.equal(segments[1].itemStyle.color, PAID_PROGRESS_COLOR);
  assert.equal(mortgageSegments.reduce((sum, segment) => sum + segment.value, 0), 1_800_000);
  assert.equal(creditSegments.reduce((sum, segment) => sum + segment.value, 0), 200_000);
  assert.equal(segments.reduce((sum, segment) => sum + segment.value, 0), 2_000_000);
});

test('DebtFunnelChart connects paid progress to its matching debt segment without changing composition', () => {
  const series = buildDebtFunnelSeriesOptions([
    {
      name: '房贷',
      value: 1_800_000,
      paid: 200_000,
      principal: 2_000_000,
      rate: 3.9,
    },
    {
      name: '信用卡',
      value: 200_000,
      paid: 800_000,
      principal: 1_000_000,
      rate: 12,
    },
  ], '#ffffff', '#212529');
  const composition = series[0];
  const paidOverlay = series[1];
  const compositionDebts = composition.data.filter((segment: any) => segment.segment === 'debt');
  const compositionGaps = composition.data.filter((segment: any) => segment.segment === 'gap');
  const overlayGaps = paidOverlay.data.filter((segment: any) => segment.segment === 'gap');

  assert.equal(series.length, 2);
  assert.deepEqual(compositionDebts.map((segment: any) => segment.value), [1_800_000, 200_000]);
  assert.equal(compositionDebts.reduce((sum: number, segment: any) => sum + segment.value, 0), 2_000_000);
  assert.equal(compositionGaps.length, 2);
  assert.equal(overlayGaps.length, 2);
  assert.ok(compositionGaps[0]);
  assert.ok(overlayGaps[0]);
  assert.equal(compositionGaps[0].itemStyle.color, '#ffffff');
  assert.equal(compositionGaps[0].tooltip?.show, false);
  assert.ok(compositionGaps[0].value > 0);
  assert.equal(compositionGaps[0].value, overlayGaps[0].value);
  assert.equal(composition.padAngle, 0);
  assert.equal(composition.itemStyle.borderWidth, 0);
  assert.equal(paidOverlay.padAngle, 0);
  assert.equal(paidOverlay.itemStyle.borderWidth, 0);
  assert.equal(paidOverlay.data[0].debtName, '房贷');
  assert.equal(paidOverlay.data[0].segment, 'remaining');
  assert.equal(paidOverlay.data[0].itemStyle.color, 'rgba(0,0,0,0)');
  assert.equal(paidOverlay.data[1].debtName, '房贷');
  assert.equal(paidOverlay.data[1].segment, 'paid');
  assert.equal(paidOverlay.data[1].value, 180_000);
  assert.equal(paidOverlay.data[1].itemStyle.color, PAID_PROGRESS_COLOR);
  assert.equal(paidOverlay.data[2].segment, 'gap');
  assert.equal(paidOverlay.data[3].debtName, '信用卡');
  assert.equal(paidOverlay.data[3].segment, 'remaining');
});

test('DebtFunnelChart creates a fixed visual break only between different debts', () => {
  const series = buildDebtFunnelSeriesOptions([
    { name: '房贷', value: 900_000, paid: 100_000, principal: 1_000_000, rate: 3.9 },
    { name: '车贷', value: 100_000, paid: 50_000, principal: 150_000, rate: 4.5 },
  ], '#ffffff', '#212529');
  const composition = series[0].data;
  const overlay = series[1].data;
  const gap = composition.find((segment: any) => segment.segment === 'gap');
  const totalWithGaps = composition.reduce((sum: number, segment: any) => sum + segment.value, 0);
  assert.ok(gap);
  const gapAngle = (gap.value / totalWithGaps) * 360;

  assert.ok(Math.abs(gapAngle - 4) < 0.0001);
  assert.deepEqual(
    overlay.slice(0, 3).map((segment: any) => segment.segment),
    ['remaining', 'paid', 'gap'],
  );
  assert.deepEqual(
    overlay.slice(3, 6).map((segment: any) => segment.segment),
    ['remaining', 'paid', 'gap'],
  );
});
