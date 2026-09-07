import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { MobileEditorBar } from './MobileEditorBar';

test('MobileEditorBar keeps save and cancel reachable as 44px mobile actions', () => {
  const markup = renderToString(
    <MobileEditorBar
      title="编辑记录"
      onCancel={() => {}}
      onSave={() => {}}
    />,
  );

  assert.match(markup, /sticky/);
  assert.match(markup, /top-\[calc\(64px\+env\(safe-area-inset-top\)\)\]/);
  assert.equal((markup.match(/min-h-11/g) ?? []).length, 2);
  assert.match(markup, />取消<\/button>/);
  assert.match(markup, />保存<\/button>/);
});

test('MobileEditorBar can submit a linked form without changing desktop markup', () => {
  const markup = renderToString(
    <MobileEditorBar
      title="编辑资产"
      onCancel={() => {}}
      formId="asset-edit-form"
    />,
  );

  assert.match(markup, /type="submit"/);
  assert.match(markup, /form="asset-edit-form"/);
  assert.match(markup, /md:hidden/);
});
