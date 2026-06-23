import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import MarkdownContent from './MarkdownContent';

test('MarkdownContent renders headings, lists, tables, and inline emphasis', () => {
  const markup = renderToString(
    <MarkdownContent
      content={[
        '## 优先研究名单',
        '',
        '- **贵州茅台**：业务位置待确认',
        '- `Needs checking`：年报和公告',
        '',
        '| 标的 | 证据强度 |',
        '| --- | --- |',
        '| 贵州茅台 | Needs checking |',
      ].join('\n')}
    />,
  );

  assert.match(markup, /<h2/);
  assert.match(markup, /优先研究名单/);
  assert.match(markup, /<ul/);
  assert.match(markup, /<strong>贵州茅台<\/strong>/);
  assert.match(markup, /<code/);
  assert.match(markup, /<table/);
  assert.match(markup, /<th/);
  assert.match(markup, /<td/);
  assert.doesNotMatch(markup, /<pre/);
});

test('MarkdownContent keeps fenced code as code blocks only when fences are present', () => {
  const markup = renderToString(
    <MarkdownContent
      content={[
        '```',
        'const verdict = "Needs checking";',
        '```',
      ].join('\n')}
    />,
  );

  assert.match(markup, /<pre/);
  assert.match(markup, /const verdict/);
});
