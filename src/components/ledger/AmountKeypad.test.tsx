import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AmountKeypad from './AmountKeypad';

test('amount keypad exposes every approved key as a touch target', () => {
  const markup = renderToString(
    <AmountKeypad
      onKey={() => {}}
      onComplete={() => {}}
      completeLabel="记 ¥32"
    />,
  );
  const approvedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '.', '+', '-', 'backspace'];
  const renderedKeys = Array.from(markup.matchAll(/data-amount-key="([^"]+)"/g), (match) => match[1]);
  const buttons = markup.match(/<button\b[^>]*data-amount-key="[^"]+"[^>]*>/g) ?? [];

  for (const label of ['0', '00', '小数点', '加', '减', '退格']) assert.match(markup, new RegExp(`aria-label="${label}"`));
  assert.equal(new Set(renderedKeys).size, 15);
  assert.deepEqual(renderedKeys.toSorted(), approvedKeys.toSorted());
  assert.equal(buttons.length, 15);
  assert.match(markup, /grid-cols-4/);
  assert.match(markup, /data-amount-complete="true"/);
  assert.match(markup, /aria-label="记 ¥32"/);
  for (const button of buttons) {
    assert.match(button, /class="[^"]*\bmin-h-12\b/);
    assert.match(button, /class="[^"]*\bmin-w-11\b/);
  }
});
