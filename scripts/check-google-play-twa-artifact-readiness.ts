import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-twa-build-artifact.ts',
  'docs/release/google-play-twa.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Google Play TWA artifact readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['twa:artifact:check'],
  'npx tsx scripts/validate-twa-build-artifact.ts',
  'package.json should expose twa:artifact:check.',
);

async function main() {
  const { validateTwaBuildArtifact } = await import('./validate-twa-build-artifact');
  const fingerprint =
    'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
  const manifest = {
    packageId: 'com.elevatelife.app',
    host: 'app.elevatelife.example',
    webManifestUrl: 'https://app.elevatelife.example/manifest.webmanifest',
    startUrl: '/',
    display: 'standalone',
    signingKey: { path: '/secure/elevate-life.keystore', alias: 'elevate-life' },
    fingerprints: [fingerprint],
  };

  const okResult = validateTwaBuildArtifact(
    {
      APP_PUBLIC_BASE_URL: 'https://app.elevatelife.example',
      ANDROID_PACKAGE_NAME: 'com.elevatelife.app',
      ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint,
      TWA_OUTPUT_DIR: 'android-twa',
      TWA_MANIFEST_URL: 'https://app.elevatelife.example/manifest.webmanifest',
      TWA_SIGNING_KEY_PATH: '/secure/elevate-life.keystore',
      TWA_SIGNING_KEY_ALIAS: 'elevate-life',
    },
    {
      exists: (path) => path === 'android-twa/twa-manifest.json' || path === 'android-twa/app-release-bundle.aab',
      readText: () => JSON.stringify(manifest),
      fileSize: () => 128_000,
    },
  );
  assert.deepEqual(okResult.errors, [], `valid TWA artifact should pass: ${okResult.errors.join(', ')}`);
  assert.equal(okResult.aabPath, 'android-twa/app-release-bundle.aab');

  const badResult = validateTwaBuildArtifact(
    {
      APP_PUBLIC_BASE_URL: 'https://app.elevatelife.example',
      ANDROID_PACKAGE_NAME: 'com.elevatelife.app',
      ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint,
      TWA_OUTPUT_DIR: 'android-twa',
      TWA_MANIFEST_URL: 'https://app.elevatelife.example/manifest.webmanifest',
      TWA_SIGNING_KEY_PATH: '/secure/elevate-life.keystore',
      TWA_SIGNING_KEY_ALIAS: 'elevate-life',
    },
    {
      exists: (path) => path === 'android-twa/twa-manifest.json',
      readText: () => JSON.stringify({ ...manifest, packageId: 'com.other.app', display: 'browser', fingerprints: [] }),
      fileSize: () => 0,
    },
  );
  assert(!badResult.ok, 'invalid TWA artifact should fail.');
  for (const phrase of ['app-release-bundle.aab', 'packageId', 'display', 'fingerprints']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid TWA artifact should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-twa-build-artifact.ts');
  for (const phrase of [
    'TWA_OUTPUT_DIR',
    'twa-manifest.json',
    'app-release-bundle.aab',
    'ANDROID_PACKAGE_NAME',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'TWA_MANIFEST_URL',
    'TWA_SIGNING_KEY_PATH',
    'TWA_SIGNING_KEY_ALIAS',
  ]) {
    assert(validator.includes(phrase), `TWA artifact validator should mention ${phrase}.`);
  }

  const twaGuide = read('docs/release/google-play-twa.md');
  assert(
    twaGuide.includes('npm run twa:artifact:check') &&
      twaGuide.includes('app-release-bundle.aab') &&
      twaGuide.includes('twa-manifest.json'),
    'Google Play TWA guide should document TWA artifact validation.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run twa:artifact:check') &&
      checklist.includes('AAB 产物'),
    'Store publishing checklist should include TWA AAB artifact validation.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-google-play-twa-artifact-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-twa-build-artifact.ts') &&
      releaseReadiness.includes('twa:artifact:check'),
    'Overall store release readiness should include Google Play TWA artifact validation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
