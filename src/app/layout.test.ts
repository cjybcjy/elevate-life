import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layoutSource = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');

test('root layout is light-only and has no runtime theme initialization', () => {
  assert.doesNotMatch(layoutSource, /from ["']next\/script["']/);
  assert.doesNotMatch(layoutSource, /strategy=["']beforeInteractive["']/);
  assert.doesNotMatch(layoutSource, /localStorage|data-theme|ServerInsertedThemeScript/);
  assert.match(layoutSource, /themeColor: ["']#F7F7F7["']/);
  assert.match(layoutSource, /colorScheme: ["']light["']/);
});
