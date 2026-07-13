import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AmountKeypad from './AmountKeypad';

test('amount keypad exposes every approved key as a touch target', () => {
  const markup = renderToString(<AmountKeypad onKey={() => {}} />);
  for (const label of ['0', '00', '小数点', '加', '减', '退格']) assert.match(markup, new RegExp(`aria-label="${label}"`));
  assert.equal((markup.match(/data-amount-key=/g) ?? []).length, 15);
  assert.equal((markup.match(/min-h-11/g) ?? []).length, 15);
});
