import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-android-release-apk-signature.ts',
  'docs/release/android-native-artifact.md',
  'docs/release/android-signing.md',
  'docs/release/store-publishing-checklist.md',
  'docs/release/store-release.env.example',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Android APK signature readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['android:apk:signature:check'],
  'npx tsx scripts/validate-android-release-apk-signature.ts',
  'package.json should expose android:apk:signature:check.',
);

async function main() {
  const {
    parseAndroidApkCertificateFingerprint,
    validateAndroidReleaseApkSignature,
  } = await import('./validate-android-release-apk-signature');

  const fingerprint =
    'AB:F0:1E:B5:F2:4F:EF:3A:59:D4:B2:AE:02:C2:55:08:62:48:FE:49:3F:79:7E:0B:33:98:21:B8:26:B5:AD:E3';
  const apksignerOutput = `Signer #1 certificate DN: CN=Elevate Life\nSigner #1 certificate SHA-256 digest: abf01eb5f24fef3a59d4b2ae02c255086248fe493f797e0b339821b826b5ade3`;

  assert.equal(parseAndroidApkCertificateFingerprint(apksignerOutput), fingerprint);

  const okResult = validateAndroidReleaseApkSignature(
    {
      ANDROID_RELEASE_APK_PATH: 'android/app/build/outputs/apk/release/app-release.apk',
      ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint,
    },
    {
      exists: () => true,
      fileSize: () => 1024,
      runApkSignerVerify: () => apksignerOutput,
    },
  );
  assert.deepEqual(okResult.errors, [], `valid signed APK should pass: ${okResult.errors.join(', ')}`);
  assert.equal(okResult.apkPath, 'android/app/build/outputs/apk/release/app-release.apk');
  assert.equal(okResult.signerFingerprint, fingerprint);

  const badResult = validateAndroidReleaseApkSignature(
    {
      ANDROID_RELEASE_APK_PATH: 'android/app/build/outputs/apk/release/app-release.apk',
      ANDROID_SHA256_CERT_FINGERPRINTS: '11:22',
    },
    {
      exists: () => true,
      fileSize: () => 0,
      runApkSignerVerify: () => 'DOES NOT VERIFY',
    },
  );
  assert(!badResult.ok, 'unsigned or malformed APK should fail.');
  for (const phrase of ['non-empty', 'apksigner', 'ANDROID_SHA256_CERT_FINGERPRINTS']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid signed APK should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-android-release-apk-signature.ts');
  for (const phrase of [
    'ANDROID_RELEASE_APK_PATH',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'apksigner',
    'SHA-256 digest',
  ]) {
    assert(validator.includes(phrase), `Android APK signature validator should mention ${phrase}.`);
  }

  const artifactGuide = read('docs/release/android-native-artifact.md');
  assert(
    artifactGuide.includes('npm run android:apk:signature:check') &&
      artifactGuide.includes('ANDROID_RELEASE_APK_PATH') &&
      artifactGuide.includes('apksigner'),
    'Android native artifact guide should document APK signature validation.',
  );

  const signingGuide = read('docs/release/android-signing.md');
  assert(
    signingGuide.includes('npm run android:apk:signature:check') &&
      signingGuide.includes('app-release.apk'),
    'Android signing guide should point to APK signature validation after release build.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run android:apk:signature:check') &&
      checklist.includes('APK 签名'),
    'Store publishing checklist should include Android APK signature validation.',
  );

  const envTemplate = read('docs/release/store-release.env.example');
  assert(
    envTemplate.includes('ANDROID_RELEASE_APK_PATH=android/app/build/outputs/apk/release/app-release.apk'),
    'Store release env template should document Android release APK path.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-android-release-apk-signature-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-android-release-apk-signature.ts') &&
      releaseReadiness.includes('android:apk:signature:check'),
    'Overall store release readiness should include Android APK signature validation.',
  );

  const storePreflight = read('scripts/store-preflight.ts');
  assert(
    storePreflight.includes('scripts/check-android-release-apk-signature-readiness.ts'),
    'Store preflight should run Android APK signature readiness.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
