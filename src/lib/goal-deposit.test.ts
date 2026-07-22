import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGoalDepositBalance,
  getGoalDepositSourceOptions,
  isGoalDepositAccountCategory,
} from './goal-deposit';

test('goal deposits only use positive cash accounts in the target currency', () => {
  const sources = getGoalDepositSourceOptions([
    { id: 'target', name: '应急金账户', category: 'current_deposit', balance: '3000', currency: 'CNY' },
    { id: 'cash', name: '日常银行卡', category: 'current_deposit', balance: '8000', currency: 'CNY' },
    { id: 'wallet', name: '现金', category: 'cash', balance: '500', currency: 'CNY' },
    { id: 'usd', name: '美元账户', category: 'current_deposit', balance: '9000', currency: 'USD' },
    { id: 'stock', name: '股票账户', category: 'stock', balance: '20000', currency: 'CNY' },
    { id: 'empty', name: '空账户', category: 'cash', balance: '0', currency: 'CNY' },
  ], 'target', 'CNY');

  assert.deepEqual(sources.map((source) => source.id), ['cash', 'wallet']);
});

test('goal deposit account categories stay limited to cash-like balances', () => {
  assert.equal(isGoalDepositAccountCategory('cash'), true);
  assert.equal(isGoalDepositAccountCategory('current_deposit'), true);
  assert.equal(isGoalDepositAccountCategory('stock'), false);
  assert.equal(isGoalDepositAccountCategory('real_estate'), false);
});

test('invalid encrypted balance placeholders are treated as unavailable', () => {
  assert.equal(getGoalDepositBalance({ id: 'broken', name: '异常账户', balance: '[decryption error]' }), 0);
});
