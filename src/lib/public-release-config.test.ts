import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPublicReleaseContact } from './public-release-config';

test('buildPublicReleaseContact reads and trims APP_SUPPORT_EMAIL', () => {
  const contact = buildPublicReleaseContact({
    APP_SUPPORT_EMAIL: ' support@elevatelife.example ',
  });

  assert.equal(contact.supportEmail, 'support@elevatelife.example');
  assert.equal(contact.supportHref, 'mailto:support@elevatelife.example');
});

test('buildPublicReleaseContact falls back to the documented support email placeholder', () => {
  const contact = buildPublicReleaseContact({});

  assert.equal(contact.supportEmail, 'support@example.com');
  assert.equal(contact.supportHref, 'mailto:support@example.com');
});
