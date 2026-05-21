import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 32);
}

export function encryptValue(plaintext: string, password: string, userId: string): string {
  const key = getKey(password, userId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return 'enc:' + combined.toString('base64');
}

export function decryptValue(ciphertext: string, password: string, userId: string): string {
  if (!ciphertext.startsWith('enc:')) return ciphertext;
  const key = getKey(password, userId);
  const combined = Buffer.from(ciphertext.slice(4), 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function generateDerivedKey(password: string, userId: string): string {
  return scryptSync(password, userId, 32).toString('base64');
}
