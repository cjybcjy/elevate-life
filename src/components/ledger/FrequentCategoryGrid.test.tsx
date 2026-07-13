import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import FrequentCategoryGrid, { CategoryIcon } from './FrequentCategoryGrid';

test('category grid renders seven categories plus 更多 with 44px targets', () => {
  const categories = ['餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行']
    .map((name, index) => ({ id: String(index), name, type: 'EXPENSE' }));
  const markup = renderToString(
    <FrequentCategoryGrid categories={categories} type="EXPENSE" selectedId="0" onSelect={() => {}} onMore={() => {}} />,
  );
  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];

  assert.equal((markup.match(/data-quick-category=/g) ?? []).length, 7);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /aria-label="更多分类"/);
  assert.equal(buttons.length, 8);
  for (const button of buttons) {
    assert.match(button, /class="[^"]*\bmin-h-11\b/);
    assert.match(button, /class="[^"]*\bmin-w-11\b/);
  }
});

test('category grid filters an income category that shares an expense name', () => {
  const markup = renderToString(
    <FrequentCategoryGrid
      categories={[
        { id: 'expense-food', name: '餐饮', type: 'EXPENSE' },
        { id: 'income-food', name: '餐饮', type: 'INCOME' },
      ]}
      type="EXPENSE"
      selectedId="income-food"
      onSelect={() => {}}
      onMore={() => {}}
    />,
  );

  assert.equal((markup.match(/data-quick-category="餐饮"/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /aria-pressed="true"/);
});

test('category icon identifies known mappings and the unknown fallback', () => {
  assert.match(renderToString(<CategoryIcon name="餐饮" />), /data-category-icon="餐饮"/);
  assert.match(renderToString(<CategoryIcon name="未知分类" />), /data-category-icon="fallback"/);
});
