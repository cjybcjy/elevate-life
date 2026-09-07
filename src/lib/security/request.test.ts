import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HttpSecurityError,
  isSameOriginRequest,
  readJsonBody,
  verifyBearerSecret,
} from './request';

const secret = '0123456789abcdef0123456789abcdef';

test('bearer verification fails closed and accepts only the exact configured secret', () => {
  const request = new Request('https://example.com/api/cron', {
    headers: { Authorization: `Bearer ${secret}` },
  });

  assert.equal(verifyBearerSecret(request, undefined), false);
  assert.equal(verifyBearerSecret(request, 'too-short'), false);
  assert.equal(verifyBearerSecret(request, `${secret}x`), false);
  assert.equal(verifyBearerSecret(request, secret), true);
});

test('same-origin verification rejects a cross-site browser request', () => {
  assert.equal(isSameOriginRequest(new Request('https://app.example.com/api/test', {
    headers: {
      Origin: 'https://evil.example',
      'Sec-Fetch-Site': 'cross-site',
    },
  })), false);

  assert.equal(isSameOriginRequest(new Request('https://app.example.com/api/test', {
    headers: { Origin: 'https://app.example.com' },
  })), true);
});

test('bounded JSON reader validates content type and body size', async () => {
  const parsed = await readJsonBody(new Request('https://example.com/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }), 64);
  assert.deepEqual(parsed, { ok: true });

  await assert.rejects(
    readJsonBody(new Request('https://example.com/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    })),
    (error: unknown) => error instanceof HttpSecurityError && error.status === 415,
  );

  await assert.rejects(
    readJsonBody(new Request('https://example.com/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(100) }),
    }), 32),
    (error: unknown) => error instanceof HttpSecurityError && error.status === 413,
  );
});
