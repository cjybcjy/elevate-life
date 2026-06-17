import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function exists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

const requiredFiles = [
  'docs/release/store-release.env.example',
  'docs/release/production-environment.md',
  'docs/release/store-preflight.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(exists(path), `${path} should exist for release environment handoff readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['release:env:template:check'],
  'npx tsx scripts/check-store-release-env-template-readiness.ts',
  'package.json should expose release:env:template:check.',
);

const envExample = read('.env.example');
assert(
  envExample.includes('CAPACITOR_APP_ID=com.elevatelife.app') &&
    !envExample.includes('CAPACITOR_APP_ID=com.example.elevatelife'),
  '.env.example should use the current default app id instead of the old com.example placeholder.',
);

const template = read('docs/release/store-release.env.example');
for (const key of [
  'APP_PUBLIC_BASE_URL=',
  'APP_SUPPORT_EMAIL=',
  'CAPACITOR_SERVER_URL=',
  'CAPACITOR_APP_ID=com.elevatelife.app',
  'ANDROID_PACKAGE_NAME=com.elevatelife.app',
  'ANDROID_SHA256_CERT_FINGERPRINTS=',
  'TWA_MANIFEST_URL=',
  'STORE_SCREENSHOT_BASE_URL=',
  'TWA_SIGNING_KEY_PATH=',
  'TWA_SIGNING_KEY_ALIAS=',
  'ANDROID_KEYSTORE_STORE_PASSWORD=',
  'ANDROID_KEYSTORE_KEY_PASSWORD=',
  'IOS_ARCHIVE_PATH=',
  'STORE_SCREENSHOT_USERNAME=',
  'STORE_SCREENSHOT_PASSWORD=',
  'REVIEW_ACCOUNT_USERNAME=',
  'REVIEW_ACCOUNT_PASSWORD=',
]) {
  assert(template.includes(key), `store release env template should include ${key}.`);
}

assert(
  template.includes('不要提交') &&
    template.includes('真实 HTTPS') &&
    template.includes('Play App Signing') &&
    template.includes('upload keystore') &&
    !template.includes('com.example.elevatelife'),
  'store release env template should warn about secrets, real HTTPS values, signing fingerprints, and avoid old placeholder ids.',
);

const productionGuide = read('docs/release/production-environment.md');
assert(
  productionGuide.includes('docs/release/store-release.env.example') &&
    productionGuide.includes('release:env:template:check'),
  'Production environment guide should point to the release env template and its check.',
);

const preflightGuide = read('docs/release/store-preflight.md');
assert(
  preflightGuide.includes('release:env:template:check') &&
    preflightGuide.includes('store-release.env.example'),
  'Store preflight guide should mention the release env template check.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('docs/release/store-release.env.example') &&
    checklist.includes('npm run release:env:template:check'),
  'Publishing checklist should include the release env template handoff step.',
);

const releaseReadiness = read('scripts/check-store-release-readiness.ts');
assert(
  releaseReadiness.includes('scripts/check-store-release-env-template-readiness.ts') &&
    releaseReadiness.includes('docs/release/store-release.env.example') &&
    releaseReadiness.includes('release:env:template:check'),
  'Overall release readiness should include the release env template.',
);

const storePreflight = read('scripts/store-preflight.ts');
assert(
  storePreflight.includes('scripts/check-store-release-env-template-readiness.ts'),
  'Store preflight should run the release env template readiness check.',
);
