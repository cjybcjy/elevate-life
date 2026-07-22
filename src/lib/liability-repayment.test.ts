import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRepaymentAssetBalance,
  getRepaymentSourceOptions,
  getRepaymentSuggestions,
} from './liability-repayment';

test('repayment sources only include positive CNY cash-like accounts', () => {
  const sources = getRepaymentSourceOptions([
    { id: 'cash', name: '现金', category: 'cash', balance: '500', currency: 'CNY' },
    { id: 'bank', name: '银行卡', category: 'current_deposit', balance: '8000', currency: 'CNY' },
    { id: 'usd', name: '美元账户', category: 'current_deposit', balance: '9000', currency: 'USD' },
    { id: 'stock', name: '股票', category: 'stock', balance: '20000', currency: 'CNY' },
    { id: 'empty', name: '空账户', category: 'cash', balance: '0', currency: 'CNY' },
  ]);

  assert.deepEqual(sources.map((source) => source.id), ['bank', 'cash']);
  assert.equal(getRepaymentAssetBalance(sources[0]), 8000);
});

test('repayment suggestions prioritize the configured monthly payment', () => {
  assert.deepEqual(getRepaymentSuggestions({ balance: 10000, monthlyPayment: 2400 }), [
    { amount: 2400, label: '本期 ¥2,400' },
    { amount: 500, label: '+¥500' },
    { amount: 1000, label: '+¥1,000' },
    { amount: 3000, label: '+¥3,000' },
  ]);
});

test('small remaining liabilities offer a one-click payoff without overpay options', () => {
  assert.deepEqual(getRepaymentSuggestions({ balance: 320 }), [
    { amount: 320, label: '结清 ¥320' },
  ]);
  assert.deepEqual(getRepaymentSuggestions({ balance: 0, monthlyPayment: 500 }), []);
});
