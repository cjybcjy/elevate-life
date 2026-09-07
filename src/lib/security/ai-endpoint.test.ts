import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAllowedAiEndpoint } from './ai-endpoint';

test('AI endpoint policy accepts built-in providers over HTTPS', () => {
  assert.equal(
    assertAllowedAiEndpoint('https://api.openai.com/v1/chat/completions'),
    'https://api.openai.com/v1/chat/completions',
  );
  assert.equal(
    assertAllowedAiEndpoint('https://api.deepseek.com/chat/completions'),
    'https://api.deepseek.com/chat/completions',
  );
});

test('AI endpoint policy blocks SSRF targets, insecure transport, and redirects by hostname', () => {
  assert.throws(
    () => assertAllowedAiEndpoint('http://api.openai.com/v1/chat/completions'),
    /HTTPS/,
  );
  assert.throws(
    () => assertAllowedAiEndpoint('https://127.0.0.1/internal'),
    /未获服务器允许/,
  );
  assert.throws(
    () => assertAllowedAiEndpoint('https://api.openai.com.evil.example/v1/chat/completions'),
    /未获服务器允许/,
  );
  assert.throws(
    () => assertAllowedAiEndpoint('https://user:pass@api.openai.com/v1/chat/completions'),
    /不能包含凭据/,
  );
  assert.throws(
    () => assertAllowedAiEndpoint('https://api.openai.com:8443/v1/chat/completions'),
    /非标准端口/,
  );
});

test('AI endpoint policy allows only explicitly configured custom hosts', () => {
  const original = process.env.AI_ALLOWED_ENDPOINT_HOSTS;
  process.env.AI_ALLOWED_ENDPOINT_HOSTS = 'llm.example.com';

  try {
    assert.equal(
      assertAllowedAiEndpoint('https://llm.example.com/v1/chat/completions'),
      'https://llm.example.com/v1/chat/completions',
    );
    assert.throws(
      () => assertAllowedAiEndpoint('https://sub.llm.example.com/v1/chat/completions'),
      /未获服务器允许/,
    );
  } finally {
    if (original === undefined) delete process.env.AI_ALLOWED_ENDPOINT_HOSTS;
    else process.env.AI_ALLOWED_ENDPOINT_HOSTS = original;
  }
});
