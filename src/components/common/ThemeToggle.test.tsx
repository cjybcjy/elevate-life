import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import ThemeToggle from './ThemeToggle';

function clearBrowserGlobals() {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
}

function installBrowserGlobals(storedTheme: string | null) {
  const storage = new Map<string, string>();
  if (storedTheme) storage.set('theme', storedTheme);

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: storedTheme === 'dark' }),
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
}

test.afterEach(() => {
  clearBrowserGlobals();
});

test('ThemeToggle renders stable initial markup before reading browser theme storage', () => {
  clearBrowserGlobals();
  const serverMarkup = renderToString(<ThemeToggle />);

  installBrowserGlobals('dark');
  const clientInitialMarkup = renderToString(<ThemeToggle />);

  assert.equal(clientInitialMarkup, serverMarkup);
  assert.match(serverMarkup, /title="切换到暗色模式"/);
});
