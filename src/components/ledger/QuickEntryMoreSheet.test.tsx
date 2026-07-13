import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import QuickEntryMoreSheet from './QuickEntryMoreSheet';

test('open sheet has modal semantics and an accessible close control', () => {
  const markup = renderToString(
    <QuickEntryMoreSheet open title="更多记账选项" onClose={() => {}}><button>内容</button></QuickEntryMoreSheet>,
  );
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-label="关闭更多记账选项"/);
  assert.match(markup, /min-h-11/);
});
