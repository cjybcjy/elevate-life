import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import LiabilityCards from './LiabilityCards';

const liabilities = [
  {
    id: 'credit-card',
    name: '信用卡',
    interestRate: 0.12,
    currentBalance: '30000',
    principal: '100000',
    termMonths: 12,
    startDate: '2025-01-01',
  },
  {
    id: 'mortgage',
    name: '房贷',
    interestRate: 0.039,
    currentBalance: '1800000',
    principal: '2000000',
    termMonths: 360,
    startDate: '2024-01-01',
  },
];

test('LiabilityCards uses debt chart colors for remaining progress and gray for paid progress', () => {
  const markup = renderToString(<LiabilityCards liabilities={liabilities} />);

  assert(markup.indexOf('房贷') < markup.indexOf('信用卡'));
  assert.match(markup, /aria-label="房贷还款进度：已还 10%，剩余 90%"/);
  assert.match(markup, /data-progress-part="paid"[^>]+background:#94a3b8/);
  assert.match(markup, /data-progress-part="remaining"[^>]+background:#3b82f6/);
  assert.match(markup, /data-liability-list="true"[^>]+width:100%;display:grid;justify-items:stretch/);
  assert.match(markup, /data-liability-card="true"[^>]+width:100%/);
  assert.match(markup, /\+ 还一笔/);
  assert.doesNotMatch(markup, /from-green-500|from-red-500/);
});
