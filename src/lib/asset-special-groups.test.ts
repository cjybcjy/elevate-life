import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSpecialAssetGroups,
  getAssetDisplayGroupKey,
  specialAssetGroupConfig,
} from './asset-special-groups';

test('special asset groups combine physical and paper gold assets', () => {
  assert.equal(specialAssetGroupConfig.gold.label, '黄金');
  assert.equal(getAssetDisplayGroupKey('gold_physical'), 'gold');
  assert.equal(getAssetDisplayGroupKey('gold_paper'), 'gold');

  const groups = buildSpecialAssetGroups([
    {
      id: 'physical-gold',
      name: '实物金条',
      category: 'gold_physical',
      balance: '3500.0000',
      quantity: 5,
    },
    {
      id: 'paper-gold',
      name: '银行黄金',
      category: 'gold_paper',
      balance: '1830.6400',
      quantity: 2,
    },
    {
      id: 'cash',
      name: '现金备用金',
      category: 'cash',
      balance: '100.0000',
    },
  ]);

  assert.deepEqual(Object.keys(groups), ['gold']);
  assert.equal(groups.gold.label, '黄金');
  assert.deepEqual(groups.gold.assets.map((asset) => asset.name), ['实物金条', '银行黄金']);
  assert.equal(groups.gold.total, 5330.64);
  assert.equal(groups.gold.quantityTotal, 7);
});
