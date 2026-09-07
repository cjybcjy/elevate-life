import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithAntiCrawl } from './anti-crawl';

test('interactive quote fetch fails fast without retrying', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('provider unavailable');
  }) as typeof fetch;

  try {
    await assert.rejects(
      fetchWithAntiCrawl(
        'https://quotes.invalid/test',
        undefined,
        { skipInitialDelay: true, attempts: 1, timeoutMs: 50 },
      ),
      /provider unavailable/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
