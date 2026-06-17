import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-android-signing.ts',
  'docs/release/android-signing.md',
  'docs/release/google-play-twa.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Android signing readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['android:signing:check'],
  'npx tsx scripts/validate-android-signing.ts',
  'package.json should expose android:signing:check.',
);

const envExample = read('.env.example');
for (const key of [
  'TWA_SIGNING_KEY_PATH=',
  'TWA_SIGNING_KEY_ALIAS=',
  'ANDROID_KEYSTORE_STORE_PASSWORD=',
  'ANDROID_KEYSTORE_KEY_PASSWORD=',
  'ANDROID_SHA256_CERT_FINGERPRINTS=',
]) {
  assert(envExample.includes(key), `.env.example should document ${key}.`);
}

const gitignore = read('.gitignore');
assert(
  gitignore.includes('*.keystore') &&
    gitignore.includes('*.jks') &&
    gitignore.includes('*.aab') &&
    gitignore.includes('*.apk') &&
    gitignore.includes('/android-twa/'),
  '.gitignore should exclude Android signing secrets and generated release packages.',
);

const capacitorAndroidGradle = read('android/app/build.gradle');
assert(
  capacitorAndroidGradle.includes('signingConfigs') &&
    capacitorAndroidGradle.includes('releaseSigningReady') &&
    capacitorAndroidGradle.includes('TWA_SIGNING_KEY_PATH') &&
    capacitorAndroidGradle.includes('TWA_SIGNING_KEY_ALIAS') &&
    capacitorAndroidGradle.includes('ANDROID_KEYSTORE_STORE_PASSWORD') &&
    capacitorAndroidGradle.includes('ANDROID_KEYSTORE_KEY_PASSWORD') &&
    capacitorAndroidGradle.includes('signingConfig signingConfigs.release'),
  'Capacitor Android release build should be able to sign AAB/APK from env-driven upload keystore settings.',
);

async function main() {
  const { parseSha256Fingerprint, validateAndroidSigningConfig } = await import('./validate-android-signing');

  const fingerprint =
    'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
  const keytoolOutput = `Alias name: elevate-life\nSHA256: ${fingerprint}\nSignature algorithm name: SHA256withRSA`;

  assert.equal(parseSha256Fingerprint(keytoolOutput), fingerprint);

  const okResult = validateAndroidSigningConfig(
    {
      TWA_SIGNING_KEY_PATH: '/secure/elevate-life-upload.keystore',
      TWA_SIGNING_KEY_ALIAS: 'elevate-life',
      ANDROID_KEYSTORE_STORE_PASSWORD: 'not-a-real-password',
      ANDROID_SHA256_CERT_FINGERPRINTS: `${fingerprint},11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00`,
    },
    {
      fileExists: () => true,
      runKeytool: () => keytoolOutput,
    },
  );
  assert.deepEqual(okResult.errors, [], `valid Android signing config should pass: ${okResult.errors.join(', ')}`);

  const badResult = validateAndroidSigningConfig(
    {
      TWA_SIGNING_KEY_PATH: '/secure/path/elevate-life-upload.keystore',
      TWA_SIGNING_KEY_ALIAS: '',
      ANDROID_KEYSTORE_STORE_PASSWORD: '',
      ANDROID_SHA256_CERT_FINGERPRINTS: 'not-a-fingerprint',
    },
    {
      fileExists: () => false,
      runKeytool: () => 'no sha256 here',
    },
  );
  assert(!badResult.ok, 'invalid Android signing config should fail.');
  for (const phrase of [
    'TWA_SIGNING_KEY_PATH',
    'TWA_SIGNING_KEY_ALIAS',
    'ANDROID_KEYSTORE_STORE_PASSWORD',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
  ]) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid Android signing config should report ${phrase}.`,
    );
  }

  const signingGuide = read('docs/release/android-signing.md');
  for (const phrase of [
    'npm run android:signing:check',
    'keytool',
    'TWA_SIGNING_KEY_PATH',
    'TWA_SIGNING_KEY_ALIAS',
    'ANDROID_KEYSTORE_STORE_PASSWORD',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'Play App Signing',
    '/.well-known/assetlinks.json',
  ]) {
    assert(signingGuide.includes(phrase), `Android signing guide should mention ${phrase}.`);
  }

  const twaGuide = read('docs/release/google-play-twa.md');
  assert(
    twaGuide.includes('npm run android:signing:check') &&
      twaGuide.includes('docs/release/android-signing.md'),
    'Google Play TWA guide should link Android signing verification.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run android:signing:check') &&
      checklist.includes('docs/release/android-signing.md'),
    'Store publishing checklist should include Android signing verification before Android package builds.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-android-signing-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-android-signing.ts') &&
      releaseReadiness.includes('docs/release/android-signing.md') &&
      releaseReadiness.includes('android:signing:check'),
    'Overall store release readiness should include Android signing artifacts.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
