import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { ExpandableDetail } from './SpecialAccountsPanel';

const assets = [
  {
    id: 'gold-physical',
    name: '实物金条',
    category: 'gold_physical',
    balance: '60000',
    quantity: 100,
    unitPrice: 600,
  },
  {
    id: 'gold-paper',
    name: '纸黄金账户',
    category: 'gold_paper',
    balance: '30000',
    quantity: 50,
    unitPrice: 600,
  },
];

test('ExpandableDetail uses the color label as the collapsed trigger without a triangle glyph', () => {
  const markup = renderToString(
    <ExpandableDetail
      cat="gold"
      assets={assets}
      color="#f59e0b"
      label="黄金"
    />,
  );

  assert.doesNotMatch(markup, /▸|▾/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-label="展开黄金明细"/);
  assert.match(markup, />黄金</);
});
