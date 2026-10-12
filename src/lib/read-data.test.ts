import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readData } from './read-data';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('independent reads start together and keep private data out of browser cache', async () => {
  const pending: Array<() => void> = [];
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = ((url, init) => {
    requests.push({ url: String(url), init });
    return new Promise<Response>((resolve) => {
      pending.push(() => resolve(Response.json({ success: true, data: [] })));
    });
  }) as typeof fetch;

  const assets = readData('assets');
  const budgets = readData('budgets', { date: '2026-09-19' });
  assert.equal(requests.length, 2, 'second read must start before first read completes');
  assert.equal(requests[1].url, '/api/data/budgets?date=2026-09-19');
  for (const request of requests) {
    assert.equal(request.init?.cache, 'no-store');
    assert.equal(request.init?.credentials, 'same-origin');
  }
  pending.forEach((resolve) => resolve());
  await Promise.all([assets, budgets]);
});

test('HTTP failures propagate to SWR instead of appearing as empty successful data', async () => {
  globalThis.fetch = (async () => Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })) as typeof fetch;
  await assert.rejects(readData('assets'), /Unauthorized/);
});

test('dates cross the GET boundary as ISO strings accepted by date consumers', async () => {
  const updatedAt = new Date('2026-09-19T08:15:00.000Z');
  globalThis.fetch = (async () => Response.json({ success: true, data: { updatedAt } })) as typeof fetch;
  const result = await readData('gold-price');
  assert.equal(result.data?.updatedAt, updatedAt.toISOString());
  assert.equal(new Date(result.data!.updatedAt).getTime(), updatedAt.getTime());
});

test('category budget reads send both filters through the independent GET endpoint', async () => {
  let requestedUrl = '';
  globalThis.fetch = (async (url) => {
    requestedUrl = String(url);
    return Response.json({ success: true, data: [{ id: 'budget-a', name: '餐饮预算' }] });
  }) as typeof fetch;
  const result = await readData('budgets-for-category', { date: '2026-09-19', categoryId: 'category-a' });
  assert.equal(requestedUrl, '/api/data/budgets-for-category?date=2026-09-19&categoryId=category-a');
  assert.equal(result.data?.[0].name, '餐饮预算');
});
