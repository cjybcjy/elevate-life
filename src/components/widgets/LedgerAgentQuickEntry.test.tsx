import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import LedgerAgentQuickEntry from './LedgerAgentQuickEntry';

test('LedgerAgentQuickEntry renders a compact agent ledger launcher', () => {
  const markup = renderToString(
    <LedgerAgentQuickEntry
      categories={[{ id: 'cat-food', name: '餐饮', type: 'EXPENSE' }]}
      assets={[{ id: 'asset-cmb', name: '招商银行卡' }]}
      onApply={() => {}}
    />,
  );

  assert.match(markup, /Agent 记一笔/);
  assert.match(markup, /例如：昨天午饭 32 用招行/);
  assert.match(markup, />生成草稿<\/button>/);
  assert.match(markup, /昨天午饭 32 用招行/);
  assert.match(markup, /今天工资收入 18000 到招商银行卡/);
});

test('LedgerAgentQuickEntry gives every interactive control a 44px touch target', () => {
  const markup = renderToString(
    <LedgerAgentQuickEntry
      categories={[]}
      assets={[]}
      onApply={() => {}}
      examples={['今天午饭 32 用现金']}
    />,
  );

  assert.match(markup, /id="ledger-agent-input"[^>]*class="[^"]*min-h-11/);
  assert.match(markup, /class="[^"]*min-h-11[^"]*"[^>]*>生成草稿<\/button>/);
  assert.match(markup, /class="[^"]*min-h-11[^"]*"[^>]*>今天午饭 32 用现金<\/button>/);
});
