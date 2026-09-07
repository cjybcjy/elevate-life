import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRegistrationMode,
  validateRegistrationInput,
  validateRegistrationPolicy,
} from './credentials';

test('registration is closed unless an explicit mode is configured', () => {
  assert.equal(getRegistrationMode({}), 'closed');
  assert.equal(getRegistrationMode({ NODE_ENV: 'development' }), 'closed');
  assert.equal(getRegistrationMode({ REGISTRATION_MODE: 'open' }), 'open');
});

test('invite registration fails closed when the secret is absent or wrong', () => {
  assert.equal(
    validateRegistrationPolicy('', { REGISTRATION_MODE: 'invite' }).success,
    false,
  );

  const env = {
    REGISTRATION_MODE: 'invite',
    REGISTRATION_INVITE_CODE: 'invite-code-with-32-random-chars',
  };

  assert.equal(validateRegistrationPolicy('wrong', env).success, false);
  assert.equal(
    validateRegistrationPolicy('invite-code-with-32-random-chars', env).success,
    true,
  );
});

test('registration input normalizes usernames and enforces password rules', () => {
  assert.deepEqual(
    validateRegistrationInput({
      username: '  Family.Admin  ',
      password: 'safe-password-2026',
      displayName: ' 家庭管理员 ',
    }),
    {
      success: true,
      data: {
        username: 'family.admin',
        password: 'safe-password-2026',
        displayName: '家庭管理员',
      },
    },
  );

  assert.equal(
    validateRegistrationInput({
      username: 'admin',
      password: 'password-only',
      displayName: '管理员',
    }).success,
    false,
  );
});
