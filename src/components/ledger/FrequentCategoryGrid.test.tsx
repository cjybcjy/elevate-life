import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import FrequentCategoryGrid from './FrequentCategoryGrid';

test('category grid renders seven categories plus 更多 with 44px targets', () => {
  const categories = ['餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行']
    .map((name, index) => ({ id: String(index), name, type: 'EXPENSE' }));
  const markup = renderToString(
    <FrequentCategoryGrid categories={categories} type="EXPENSE" selectedId="0" onSelect={() => {}} onMore={() => {}} />,
  );
  assert.equal((markup.match(/data-quick-category=/g) ?? []).length, 7);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /aria-label="更多分类"/);
  assert.equal((markup.match(/min-h-11/g) ?? []).length, 8);
});
