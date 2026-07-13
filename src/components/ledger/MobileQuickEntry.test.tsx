import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import MobileQuickEntry from './MobileQuickEntry';

const categories = [
  { id: 'food', name: '餐饮', type: 'EXPENSE' },
  { id: 'daily', name: '日用', type: 'EXPENSE' },
  { id: 'salary', name: '工资', type: 'INCOME' },
  { id: 'social-in', name: '人情往来', type: 'INCOME' },
];

test('mobile quick entry renders the approved single-screen hierarchy', () => {
  const markup = renderToString(
    <MobileQuickEntry
      categories={categories}
      assets={[{ id: 'cash', name: '现金' }]}
      loadBudgets={async () => []}
      onSubmit={async () => ({ success: true, feedback: '已记 ¥32 · 餐饮' })}
      onSaveTemplate={() => {}}
    />,
  );

  assert.match(markup, /data-mobile-quick-entry="true"/);
  assert.match(markup, /<h1[^>]*>记一笔<\/h1>/);
  assert.match(markup, /aria-label="交易类型"/);
  assert.match(markup, /aria-label="常用分类"/);
  assert.match(markup, /aria-label="金额键盘"/);
  assert.match(markup, />确认记账<\/button>/);
  assert.match(markup, />说一句记账<\/button>/);
  assert.match(markup, />更多选项<\/button>/);
});
