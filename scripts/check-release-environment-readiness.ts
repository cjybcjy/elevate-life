import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-release-env.ts',
  'docs/release/production-environment.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for release environment readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['release:check'],
  'npx tsx scripts/validate-release-env.ts',
  'package.json should expose release:check for strict pre-submission environment validation.',
);

const envExample = read('.env.example');
for (const key of [
  'APP_PUBLIC_BASE_URL=https://app.example.com',
  'APP_SUPPORT_EMAIL=support@example.com',
  'CAPACITOR_SERVER_URL=$APP_PUBLIC_BASE_URL',
  'CAPACITOR_APP_ID=com.elevatelife.app',
  'ANDROID_PACKAGE_NAME=$CAPACITOR_APP_ID',
  'ANDROID_SHA256_CERT_FINGERPRINTS=',
  'TWA_MANIFEST_URL=$APP_PUBLIC_BASE_URL/manifest.webmanifest',
  'STORE_SCREENSHOT_BASE_URL=$APP_PUBLIC_BASE_URL',
]) {
  assert(envExample.includes(key), `.env.example should document ${key}.`);
}

const validatorSource = read('scripts/validate-release-env.ts');
assert(
  validatorSource.includes("from '@next/env'") &&
    validatorSource.includes('loadEnvConfig(process.cwd())'),
  'release:check should load .env files with @next/env because it runs outside the Next.js runtime.',
);

async function main() {
  const { validateReleaseEnv } = await import('./validate-release-env');

  const validEnv = {
    APP_PUBLIC_BASE_URL: 'https://app.elevatelife.example',
    APP_SUPPORT_EMAIL: 'support@elevatelife.example',
    CAPACITOR_SERVER_URL: 'https://app.elevatelife.example',
    CAPACITOR_APP_ID: 'com.elevatelife.app',
    ANDROID_PACKAGE_NAME: 'com.elevatelife.app',
    ANDROID_SHA256_CERT_FINGERPRINTS:
      'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
    TWA_MANIFEST_URL: 'https://app.elevatelife.example/manifest.webmanifest',
    STORE_SCREENSHOT_BASE_URL: 'https://app.elevatelife.example',
  };

  const validResult = validateReleaseEnv(validEnv);
  assert.deepEqual(validResult.errors, [], `valid release env should have no errors: ${validResult.errors.join(', ')}`);

  const invalidResult = validateReleaseEnv({
    APP_PUBLIC_BASE_URL: 'http://localhost:3000',
    APP_SUPPORT_EMAIL: 'support@example.com',
    CAPACITOR_SERVER_URL: 'https://other.example.com',
    CAPACITOR_APP_ID: 'com.example.elevatelife',
    ANDROID_PACKAGE_NAME: 'com.other.app',
    ANDROID_SHA256_CERT_FINGERPRINTS: 'not-a-fingerprint',
    TWA_MANIFEST_URL: 'https://example.com/manifest.webmanifest',
    STORE_SCREENSHOT_BASE_URL: 'http://localhost:3000',
  });
  assert(!invalidResult.ok, 'invalid release env should fail strict validation.');
  for (const phrase of [
    'APP_PUBLIC_BASE_URL',
    'APP_SUPPORT_EMAIL',
    'CAPACITOR_SERVER_URL',
    'CAPACITOR_APP_ID',
    'ANDROID_PACKAGE_NAME',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'TWA_MANIFEST_URL',
    'STORE_SCREENSHOT_BASE_URL',
  ]) {
    assert(
      invalidResult.errors.some((error: string) => error.includes(phrase)),
      `invalid release env should report ${phrase}.`,
    );
  }

  const guide = read('docs/release/production-environment.md');
  for (const phrase of [
    'npm run release:check',
    'APP_PUBLIC_BASE_URL',
    'APP_SUPPORT_EMAIL',
    'CAPACITOR_SERVER_URL',
    'CAPACITOR_APP_ID',
    'ANDROID_PACKAGE_NAME',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'TWA_MANIFEST_URL',
    '/privacy',
    '/support',
    '/account-deletion',
    '/.well-known/assetlinks.json',
  ]) {
    assert(guide.includes(phrase), `production environment guide should mention ${phrase}.`);
  }

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run release:check') &&
      checklist.includes('docs/release/production-environment.md') &&
      checklist.includes('真实 HTTPS 域名'),
    'Publishing checklist should include production environment validation before app builds.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-release-environment-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-release-env.ts') &&
      releaseReadiness.includes('docs/release/production-environment.md') &&
      releaseReadiness.includes('release:check'),
    'Overall store release readiness should include strict release environment validation artifacts.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
