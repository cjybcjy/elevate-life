import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import SerenityAnalysisPanel from './SerenityAnalysisPanel';

test('SerenityAnalysisPanel renders prior answers and a follow-up form', () => {
  const markup = renderToString(
    <SerenityAnalysisPanel
      providerLabel="DeepSeek"
      messages={[
        { role: 'assistant', content: '## 初筛\n- 先查客户验证' },
        { role: 'user', content: '下一步先查什么？' },
      ]}
      status=""
      loading={false}
      draft=""
      onDraftChange={() => {}}
      onSubmit={() => {}}
      onClose={() => {}}
    />,
  );

  assert.match(markup, /Serenity 持仓分析/);
  assert.match(markup, /<h2/);
  assert.match(markup, /下一步先查什么/);
  assert.match(markup, /继续追问/);
  assert.match(markup, /textarea/);
});

test('SerenityAnalysisPanel hides the follow-up form before the first answer', () => {
  const markup = renderToString(
    <SerenityAnalysisPanel
      providerLabel="DeepSeek"
      messages={[]}
      status=""
      loading
      draft=""
      onDraftChange={() => {}}
      onSubmit={() => {}}
      onClose={() => {}}
    />,
  );

  assert.match(markup, /正在按产业链层级和卡点梳理持仓/);
  assert.doesNotMatch(markup, /textarea/);
});
