import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { buildSpecialAssetGroups } from '@/lib/asset-special-groups';
import AccountViewLayer from './AccountViewLayer';

const stocks = [
  { id: 'stock-cn', name: '测试A股持仓', category: 'stock', market: 'cn', balance: '7106' },
  { id: 'stock-hk', name: '测试港股持仓', category: 'stock', market: 'hk', balance: '11350' },
  { id: 'stock-us', name: '测试美股持仓', category: 'stock', market: 'us', balance: '9000' },
];

const specialAccounts = [
  { id: 'provident', name: '测试公积金账户', category: 'provident_fund', balance: '4000' },
  { id: 'paper-gold', name: '测试纸黄金账户', category: 'gold_paper', balance: '1800', quantity: 2 },
  { id: 'physical-gold', name: '测试实物黄金账户', category: 'gold_physical', balance: '9000', quantity: 10 },
];

test('account overview excludes stocks from every market and selects the first remaining account', () => {
  const assets = [
    stocks[0],
    { id: 'bank', name: '测试银行卡', category: 'current_deposit', balance: '2000' },
    stocks[1],
    stocks[2],
  ];
  const originalAssets = structuredClone(assets);
  const markup = renderToString(
    <AccountViewLayer
      assets={assets}
      transactions={[
        { id: 'bank-income', type: 'INCOME', amount: '500', toAccountId: 'bank', occurredAt: '2026-08-01', description: '银行到账测试' },
        { id: 'stock-income', type: 'INCOME', amount: '100', toAccountId: 'stock-cn', occurredAt: '2026-08-01', description: '股票分红测试' },
      ]}
    />,
  );

  for (const stock of stocks) assert.ok(!markup.includes(stock.name));
  assert.match(markup, /<h3[^>]*>测试银行卡<\/h3>/);
  assert.match(markup, /银行到账测试/);
  assert.doesNotMatch(markup, /股票分红测试/);
  assert.equal((markup.match(/<button /g) ?? []).length, 1);
  assert.deepEqual(assets, originalAssets, 'Filtering the overview must not modify the source asset data.');
});

test('stock-only accounts use the empty state without falling back to a stock detail', () => {
  const markup = renderToString(<AccountViewLayer assets={stocks} transactions={[]} />);

  assert.match(markup, /先创建一个银行卡、现金或投资账户/);
  assert.doesNotMatch(markup, /当前资金账户|最近流水|<button /);
  for (const stock of stocks) assert.ok(!markup.includes(stock.name));
});

test('provident fund and both gold categories stay in special summaries instead of the account overview', () => {
  const assets = [
    ...specialAccounts,
    { id: 'bank', name: '测试银行卡', category: 'current_deposit', balance: '2000' },
    ...stocks,
  ];
  const originalAssets = structuredClone(assets);
  const markup = renderToString(
    <AccountViewLayer
      assets={assets}
      transactions={[
        { id: 'transfer', type: 'TRANSFER', amount: '500', fromAccountId: 'provident', toAccountId: 'bank', occurredAt: '2026-08-01', description: '专项账户转入银行卡' },
        { id: 'special-income', type: 'INCOME', amount: '100', toAccountId: 'provident', occurredAt: '2026-08-01', description: '专项账户单独流水' },
      ]}
    />,
  );

  for (const asset of [...specialAccounts, ...stocks]) assert.ok(!markup.includes(asset.name));
  assert.match(markup, /<h3[^>]*>测试银行卡<\/h3>/);
  assert.match(markup, /专项账户转入银行卡/);
  assert.doesNotMatch(markup, /专项账户单独流水/);
  assert.equal((markup.match(/<button /g) ?? []).length, 1);
  assert.deepEqual(assets, originalAssets);

  const groups = buildSpecialAssetGroups(assets);
  assert.deepEqual(groups.provident_fund.assets.map((asset) => asset.id), ['provident']);
  assert.equal(groups.provident_fund.total, 4000);
  assert.deepEqual(groups.gold.assets.map((asset) => asset.id), ['paper-gold', 'physical-gold']);
  assert.equal(groups.gold.total, 10800);
  assert.equal(groups.gold.quantityTotal, 12);
});

test('only stocks and special accounts show the empty state without a hidden account detail', () => {
  const markup = renderToString(<AccountViewLayer assets={[...specialAccounts, ...stocks]} transactions={[]} />);

  assert.match(markup, /先创建一个银行卡、现金或投资账户/);
  assert.doesNotMatch(markup, /当前资金账户|最近流水|<button /);
  for (const asset of [...specialAccounts, ...stocks]) assert.ok(!markup.includes(asset.name));
});

test('all other categories and their order remain available in the account overview', () => {
  const categories = ['cash', 'current_deposit', 'fund', 'bond', 'pension', 'vehicle', 'real_estate', 'other'];
  const assets = categories.map((category) => ({
    id: category,
    name: `测试账户-${category}`,
    category,
    balance: '100',
  }));
  const markup = renderToString(<AccountViewLayer assets={assets} transactions={[]} />);

  let lastPosition = -1;
  for (const asset of assets) {
    const position = markup.indexOf(asset.name);
    assert.ok(position > lastPosition, `${asset.category} should remain in its original order.`);
    lastPosition = position;
  }
  assert.equal((markup.match(/<button /g) ?? []).length, assets.length);
});

test('an empty account collection retains the create-account state', () => {
  const markup = renderToString(<AccountViewLayer assets={[]} transactions={[]} />);

  assert.match(markup, /创建资金账户/);
  assert.doesNotMatch(markup, /当前资金账户/);
});
