import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEDGER_CATEGORY_PRESETS,
  QUICK_ENTRY_CATEGORY_ORDER,
  findMissingLedgerCategoryPresets,
  ledgerCategoryKey,
} from './ledger-category-presets';

test('starter categories use the approved expense and income order', () => {
  assert.deepEqual(QUICK_ENTRY_CATEGORY_ORDER.EXPENSE, [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来',
  ]);
  assert.deepEqual(QUICK_ENTRY_CATEGORY_ORDER.INCOME, ['工资', '理财收益', '人情往来']);
});

test('income and expense 人情往来 are separate starter records', () => {
  const social = LEDGER_CATEGORY_PRESETS.filter((item) => item.name === '人情往来');
  assert.deepEqual(social.map((item) => item.type).sort(), ['EXPENSE', 'INCOME']);
  assert.notEqual(ledgerCategoryKey('EXPENSE', '人情往来'), ledgerCategoryKey('INCOME', '人情往来'));
});

test('missing calculation is idempotent for an already complete account', () => {
  const complete = LEDGER_CATEGORY_PRESETS.map(({ name, type }) => ({ name, type }));
  assert.deepEqual(findMissingLedgerCategoryPresets(complete), []);
});

test('missing calculation adds only absent name and type combinations', () => {
  const existing = LEDGER_CATEGORY_PRESETS
    .filter((item) => !(item.name === '日用' && item.type === 'EXPENSE'))
    .filter((item) => !(item.name === '人情往来' && item.type === 'INCOME'));
  assert.deepEqual(
    findMissingLedgerCategoryPresets(existing)
      .map((item) => ledgerCategoryKey(item.type, item.name))
      .sort(),
    ['EXPENSE:日用', 'INCOME:人情往来'],
  );
});
