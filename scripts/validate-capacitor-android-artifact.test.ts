import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCapacitorAndroidArtifact } from './validate-capacitor-android-artifact';

const projectDir = 'android';
const gradlePath = `${projectDir}/app/build.gradle`;
const manifestPath = `${projectDir}/app/src/main/AndroidManifest.xml`;
const nativeConfigPath = `${projectDir}/app/src/main/assets/capacitor.config.json`;
const artifactPath = `${projectDir}/app/build/outputs/bundle/release/app-release.aab`;

function buildFakeFs(artifactMtimeMs: number, nativeConfigMtimeMs: number) {
  const files = new Set([gradlePath, manifestPath, nativeConfigPath, artifactPath]);

  return {
    exists: (path: string) => files.has(path),
    fileSize: (path: string) => (path === artifactPath ? 1024 : 1),
    fileMtimeMs: (path: string) => {
      if (path === artifactPath) return artifactMtimeMs;
      if (path === nativeConfigPath) return nativeConfigMtimeMs;
      return 1;
    },
    readText: (path: string) => {
      if (path === gradlePath) {
        return [
          'android {',
          '  namespace "com.elevatelife.app"',
          '  defaultConfig { applicationId "com.elevatelife.app" }',
          '}',
        ].join('\n');
      }

      if (path === nativeConfigPath) {
        return JSON.stringify({
          appId: 'com.elevatelife.app',
          server: {
            url: 'https://app.elevatelife.test',
            cleartext: false,
          },
        });
      }

      return '';
    },
  };
}

test('validateCapacitorAndroidArtifact rejects a release artifact older than the synced native config', () => {
  const result = validateCapacitorAndroidArtifact(
    {
      ANDROID_NATIVE_PROJECT_DIR: projectDir,
      CAPACITOR_APP_ID: 'com.elevatelife.app',
      CAPACITOR_SERVER_URL: 'https://app.elevatelife.test',
    },
    buildFakeFs(1000, 2000),
  );

  assert.equal(result.ok, false);
  assert(
    result.errors.some((error) => error.includes('release artifact should be rebuilt after the latest native sync')),
    `expected stale artifact error, got: ${result.errors.join(' | ')}`,
  );
});

test('validateCapacitorAndroidArtifact accepts a release artifact newer than the synced native config', () => {
  const result = validateCapacitorAndroidArtifact(
    {
      ANDROID_NATIVE_PROJECT_DIR: projectDir,
      CAPACITOR_APP_ID: 'com.elevatelife.app',
      CAPACITOR_SERVER_URL: 'https://app.elevatelife.test',
    },
    buildFakeFs(3000, 2000),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});
