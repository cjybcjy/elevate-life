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
  assert.match(markup, /data-revolving-credit-setup="true"/);
  assert.match(markup, /保存后这里会出现“借一笔”/);
  assert.match(markup, /href="\/management\/liabilities"/);
  assert.doesNotMatch(markup, /from-green-500|from-red-500/);
});

test('LiabilityCards presents revolving credit as used and available limit with two-way actions', () => {
  const markup = renderToString(
    <LiabilityCards
      liabilities={[{
        id: 'revolving-credit',
        name: '经营循环贷',
        interestRate: 0.045,
        currentBalance: '30000',
        principal: '100000',
        termMonths: 36,
        startDate: '2026-01-01',
        paymentMethod: 'revolving_credit',
      }]}
      transactions={[
        {
          id: 'draw-1',
          liabilityId: 'revolving-credit',
          type: 'LIABILITY_DRAW',
          amount: '30000',
          occurredAt: '2026-08-01',
        },
      ]}
    />,
  );

  assert.match(markup, /aria-label="经营循环贷额度使用：已用 30%，可用 70%"/);
  assert.match(markup, /100,000\.00/);
  assert.match(markup, /70,000\.00/);
  assert.match(markup, /\+ 借一笔/);
  assert.match(markup, /\+ 还一笔/);
  assert.match(markup, /借还流水/);
  assert.doesNotMatch(markup, /data-revolving-credit-setup="true"/);
  assert.doesNotMatch(markup, /已结清/);
});
