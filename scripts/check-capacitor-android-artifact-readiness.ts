import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-capacitor-android-artifact.ts',
  'docs/release/android-native-artifact.md',
  'docs/release/native-wrapper.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Capacitor Android artifact readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['android:artifact:check'],
  'npx tsx scripts/validate-capacitor-android-artifact.ts',
  'package.json should expose android:artifact:check.',
);

async function main() {
  const { validateCapacitorAndroidArtifact } = await import('./validate-capacitor-android-artifact');
  const env = {
    CAPACITOR_APP_ID: 'com.elevatelife.app',
    CAPACITOR_SERVER_URL: 'https://app.elevatelife.example',
    ANDROID_NATIVE_PROJECT_DIR: 'android',
  };
  const capacitorConfig = {
    appId: 'com.elevatelife.app',
    appName: 'Elevate Life',
    server: { url: 'https://app.elevatelife.example', cleartext: false },
  };

  const okResult = validateCapacitorAndroidArtifact(env, {
    exists: (path) =>
      [
        'android/app/build.gradle',
        'android/app/src/main/AndroidManifest.xml',
        'android/app/src/main/assets/capacitor.config.json',
        'android/app/build/outputs/bundle/release/app-release.aab',
      ].includes(path),
    readText: (path) => {
      if (path.endsWith('build.gradle')) {
        return [
          'android {',
          '  namespace "com.elevatelife.app"',
          '  defaultConfig {',
          '    applicationId "com.elevatelife.app"',
          '  }',
          '}',
        ].join('\n');
      }
      if (path.endsWith('AndroidManifest.xml')) {
        return '<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>';
      }
      return JSON.stringify(capacitorConfig);
    },
    fileSize: () => 256_000,
  });
  assert.deepEqual(okResult.errors, [], `valid Capacitor Android artifact should pass: ${okResult.errors.join(', ')}`);
  assert.equal(okResult.artifactPath, 'android/app/build/outputs/bundle/release/app-release.aab');

  const badResult = validateCapacitorAndroidArtifact(env, {
    exists: (path) =>
      ['android/app/build.gradle', 'android/app/src/main/assets/capacitor.config.json'].includes(path),
    readText: (path) => {
      if (path.endsWith('build.gradle')) {
        return 'android { namespace "com.other.app" defaultConfig { applicationId "com.other.app" } }';
      }
      return JSON.stringify({
        appId: 'com.other.app',
        server: { url: 'http://localhost:3000', cleartext: true },
      });
    },
    fileSize: () => 0,
  });
  assert(!badResult.ok, 'invalid Capacitor Android artifact should fail.');
  for (const phrase of ['release APK or AAB', 'applicationId', 'server.url', 'cleartext', 'AndroidManifest.xml']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid Capacitor Android artifact should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-capacitor-android-artifact.ts');
  for (const phrase of [
    'ANDROID_NATIVE_PROJECT_DIR',
    'CAPACITOR_APP_ID',
    'CAPACITOR_SERVER_URL',
    'applicationId',
    'namespace',
    'capacitor.config.json',
    'app-release.aab',
    'app-release.apk',
  ]) {
    assert(validator.includes(phrase), `Capacitor Android artifact validator should mention ${phrase}.`);
  }

  const artifactGuide = read('docs/release/android-native-artifact.md');
  assert(
    artifactGuide.includes('npm run android:artifact:check') &&
      artifactGuide.includes('app-release.aab') &&
      artifactGuide.includes('app-release.apk') &&
      artifactGuide.includes('CAPACITOR_SERVER_URL') &&
      artifactGuide.includes('CAPACITOR_APP_ID'),
    'Android native artifact guide should document commands, release outputs, and required env vars.',
  );

  const nativeGuide = read('docs/release/native-wrapper.md');
  assert(
    nativeGuide.includes('docs/release/android-native-artifact.md') &&
      nativeGuide.includes('npm run android:artifact:check'),
    'Native wrapper guide should link the Android artifact validation guide.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run android:artifact:check') &&
      checklist.includes('Capacitor Android release 产物'),
    'Store publishing checklist should include Capacitor Android artifact validation.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-capacitor-android-artifact-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-capacitor-android-artifact.ts') &&
      releaseReadiness.includes('android:artifact:check'),
    'Overall store release readiness should include Capacitor Android artifact validation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
