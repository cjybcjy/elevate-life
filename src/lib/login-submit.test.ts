import assert from 'node:assert/strict';
import test from 'node:test';
import { submitLoginForm } from './login-submit';

test('submitLoginForm handles a failed server action response inside the form', async () => {
  const events: string[] = [];

  let thrown: unknown;
  try {
    await submitLoginForm({
      username: 'the2ofus',
      password: 'password',
      login: async () => {
        throw new Error('An unexpected response was received from the server.');
      },
      onSuccess: () => events.push('success'),
      setError: (message) => events.push(`error:${message}`),
      setLoading: (loading) => events.push(`loading:${loading}`),
    });
  } catch (error) {
    thrown = error;
  }

  assert.equal(thrown, undefined);
  assert.deepEqual(events, [
    'error:',
    'loading:true',
    'error:登录请求失败，请刷新页面后重试',
    'loading:false',
  ]);
});
