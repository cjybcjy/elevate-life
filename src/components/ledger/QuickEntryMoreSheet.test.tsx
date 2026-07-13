import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import QuickEntryMoreSheet from './QuickEntryMoreSheet';

test('open sheet has modal semantics and an accessible close control', () => {
  const markup = renderToString(
    <QuickEntryMoreSheet open title="更多记账选项" onClose={() => {}}><div>内容</div></QuickEntryMoreSheet>,
  );
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.equal((markup.match(/aria-label="关闭更多记账选项"/g) ?? []).length, 2);
  assert.equal((markup.match(/<button\b/g) ?? []).length, 2);
  assert.equal((markup.match(/md:hidden/g) ?? []).length, 2);
  assert.match(markup, /min-h-11/);
});

test('closed sheet renders no modal shell', () => {
  const markup = renderToString(
    <QuickEntryMoreSheet open={false} title="更多记账选项" onClose={() => {}}><div>内容</div></QuickEntryMoreSheet>,
  );

  assert.equal(markup, '');
});
