import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-android-release-bundle-signature.ts',
  'docs/release/android-native-artifact.md',
  'docs/release/android-signing.md',
  'docs/release/google-play-twa.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Android AAB signature readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['android:aab:signature:check'],
  'npx tsx scripts/validate-android-release-bundle-signature.ts',
  'package.json should expose android:aab:signature:check.',
);

async function main() {
  const {
    parseAndroidBundleCertificateFingerprint,
    validateAndroidReleaseBundleSignature,
  } = await import('./validate-android-release-bundle-signature');

  const fingerprint =
    'AB:F0:1E:B5:F2:4F:EF:3A:59:D4:B2:AE:02:C2:55:08:62:48:FE:49:3F:79:7E:0B:33:98:21:B8:26:B5:AD:E3';
  const certOutput = `Signer #1:\nCertificate fingerprints:\n\t SHA256: ${fingerprint}\nSignature algorithm name: SHA384withRSA`;

  assert.equal(parseAndroidBundleCertificateFingerprint(certOutput), fingerprint);

  const okResult = validateAndroidReleaseBundleSignature(
    {
      ANDROID_RELEASE_BUNDLE_PATH: 'android/app/build/outputs/bundle/release/app-release.aab',
      ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint,
    },
    {
      exists: () => true,
      fileSize: () => 1024,
      listEntries: () => [
        'META-INF/ELEVATE-.SF',
        'META-INF/ELEVATE-.RSA',
        'META-INF/MANIFEST.MF',
        'base/manifest/AndroidManifest.xml',
      ],
      runJarsignerVerify: () => 'jar verified.\nWarning: self-signed certificate',
      runKeytoolPrintCert: () => certOutput,
    },
  );
  assert.deepEqual(okResult.errors, [], `valid signed AAB should pass: ${okResult.errors.join(', ')}`);
  assert.equal(okResult.bundlePath, 'android/app/build/outputs/bundle/release/app-release.aab');
  assert.equal(okResult.signerFingerprint, fingerprint);

  const badResult = validateAndroidReleaseBundleSignature(
    {
      ANDROID_RELEASE_BUNDLE_PATH: 'android/app/build/outputs/bundle/release/app-release.aab',
      ANDROID_SHA256_CERT_FINGERPRINTS: '11:22',
    },
    {
      exists: () => true,
      fileSize: () => 0,
      listEntries: () => ['META-INF/MANIFEST.MF'],
      runJarsignerVerify: () => 'jar is unsigned.',
      runKeytoolPrintCert: () => 'no sha256 here',
    },
  );
  assert(!badResult.ok, 'unsigned or malformed AAB should fail.');
  for (const phrase of ['non-empty', 'META-INF', 'jarsigner', 'ANDROID_SHA256_CERT_FINGERPRINTS']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid signed AAB should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-android-release-bundle-signature.ts');
  for (const phrase of [
    'ANDROID_RELEASE_BUNDLE_PATH',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'jarsigner',
    'keytool',
    'META-INF',
    'jar verified',
  ]) {
    assert(validator.includes(phrase), `Android AAB signature validator should mention ${phrase}.`);
  }

  const artifactGuide = read('docs/release/android-native-artifact.md');
  assert(
    artifactGuide.includes('npm run android:aab:signature:check') &&
      artifactGuide.includes('ANDROID_RELEASE_BUNDLE_PATH') &&
      artifactGuide.includes('jarsigner'),
    'Android native artifact guide should document AAB signature validation.',
  );

  const signingGuide = read('docs/release/android-signing.md');
  assert(
    signingGuide.includes('npm run android:aab:signature:check') &&
      signingGuide.includes('app-release.aab'),
    'Android signing guide should point to AAB signature validation after release build.',
  );

  const twaGuide = read('docs/release/google-play-twa.md');
  assert(
    twaGuide.includes('npm run android:aab:signature:check') &&
      twaGuide.includes('app-release-bundle.aab'),
    'Google Play TWA guide should validate Bubblewrap AAB signatures before Play Console upload.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run android:aab:signature:check') &&
      checklist.includes('AAB 签名'),
    'Store publishing checklist should include Android AAB signature validation.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-android-release-bundle-signature-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-android-release-bundle-signature.ts') &&
      releaseReadiness.includes('android:aab:signature:check'),
    'Overall store release readiness should include Android AAB signature validation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
