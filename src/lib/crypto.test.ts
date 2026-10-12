import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { createValueDecryptor, decryptValue, encryptValue } from './crypto';

// Fixed fixtures use the original scrypt + AES-256-GCM format:
// 16-byte IV, 16-byte authentication tag, then ciphertext.
const legacyRecords = [
  { plaintext: '1234.5600', ciphertext: 'enc:AQEBAQEBAQEBAQEBAQEBAZiL67xE8SJ3kW26kgaR8QqwA5n8bEyjepE=' },
  { plaintext: '0.0000', ciphertext: 'enc:AgICAgICAgICAgICAgICAsgMI96n7N5btE2EEk3e5iUTA6mOfeE=' },
  { plaintext: '家庭预算', ciphertext: 'enc:AwMDAwMDAwMDAwMDAwMDAxGNBk03sd0GzAQPYcAQJh1nOjha9xQODhUXZLY=' },
];

test('batch decryption reads existing encrypted records and newly written values', () => {
  const decrypt = createValueDecryptor('legacy-derived-key', 'legacy-user');
  for (const record of legacyRecords) {
    assert.equal(decrypt(record.ciphertext), record.plaintext);
    assert.equal(decryptValue(record.ciphertext, 'legacy-derived-key', 'legacy-user'), record.plaintext);
  }
  assert.equal(decrypt(encryptValue('-250.7500', 'legacy-derived-key', 'legacy-user')), '-250.7500');
});

test('a batch cannot decrypt another user or password key and does not affect valid batches', () => {
  const ciphertext = legacyRecords[0].ciphertext;
  const correct = createValueDecryptor('legacy-derived-key', 'legacy-user');
  const otherUser = createValueDecryptor('legacy-derived-key', 'other-user');
  const otherKey = createValueDecryptor('other-derived-key', 'legacy-user');

  assert.equal(correct(ciphertext), '1234.5600');
  assert.throws(() => otherUser(ciphertext));
  assert.throws(() => otherKey(ciphertext));
  assert.equal(correct(ciphertext), '1234.5600');
});

test('tampered ciphertext is rejected without breaking subsequent values in the batch', () => {
  const decrypt = createValueDecryptor('legacy-derived-key', 'legacy-user');
  const bytes = Buffer.from(legacyRecords[0].ciphertext.slice(4), 'base64');
  bytes[bytes.length - 1] ^= 1;

  assert.throws(() => decrypt(`enc:${bytes.toString('base64')}`));
  assert.throws(() => decrypt('enc:invalid'));
  assert.equal(decrypt(legacyRecords[1].ciphertext), '0.0000');
});

test('plaintext needs no derivation and each encrypted read batch derives its key only once', (t) => {
  const derivation = t.mock.method(crypto, 'scryptSync');
  syncBuiltinESMExports();
  t.after(() => {
    derivation.mock.restore();
    syncBuiltinESMExports();
  });

  const decrypt = createValueDecryptor('legacy-derived-key', 'legacy-user');
  assert.equal(derivation.mock.callCount(), 0);
  for (const value of ['', '0.0000', '-19.50', '家庭预算']) {
    assert.equal(decrypt(value), value);
  }
  assert.equal(derivation.mock.callCount(), 0);

  for (const record of legacyRecords) assert.equal(decrypt(record.ciphertext), record.plaintext);
  assert.equal(derivation.mock.callCount(), 1);

  const nextBatch = createValueDecryptor('legacy-derived-key', 'legacy-user');
  assert.equal(nextBatch(legacyRecords[0].ciphertext), '1234.5600');
  assert.equal(derivation.mock.callCount(), 2);
});
