import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-mobile-permissions.ts',
  'docs/release/mobile-permissions.md',
  'docs/release/native-wrapper.md',
  'docs/release/privacy-data-safety.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for mobile permissions readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['mobile:permissions:check'],
  'npx tsx scripts/validate-mobile-permissions.ts',
  'package.json should expose mobile:permissions:check.',
);

async function main() {
  const {
    DEFAULT_ALLOWED_ANDROID_PERMISSIONS,
    SENSITIVE_ANDROID_PERMISSIONS,
    SENSITIVE_IOS_USAGE_KEYS,
    validateMobilePermissions,
  } = await import('./validate-mobile-permissions');

  assert(DEFAULT_ALLOWED_ANDROID_PERMISSIONS.includes('android.permission.INTERNET'));
  assert(DEFAULT_ALLOWED_ANDROID_PERMISSIONS.includes('android.permission.ACCESS_NETWORK_STATE'));
  assert(SENSITIVE_ANDROID_PERMISSIONS.includes('android.permission.CAMERA'));
  assert(SENSITIVE_ANDROID_PERMISSIONS.includes('android.permission.ACCESS_FINE_LOCATION'));
  assert(SENSITIVE_ANDROID_PERMISSIONS.includes('android.permission.READ_CONTACTS'));
  assert(SENSITIVE_ANDROID_PERMISSIONS.includes('android.permission.READ_SMS'));
  assert(SENSITIVE_IOS_USAGE_KEYS.includes('NSCameraUsageDescription'));
  assert(SENSITIVE_IOS_USAGE_KEYS.includes('NSLocationWhenInUseUsageDescription'));
  assert(SENSITIVE_IOS_USAGE_KEYS.includes('NSContactsUsageDescription'));

  const okResult = validateMobilePermissions(
    {
      ANDROID_NATIVE_PROJECT_DIR: 'android',
      IOS_NATIVE_PROJECT_DIR: 'ios',
    },
    {
      exists: (path) =>
        [
          'android/app/src/main/AndroidManifest.xml',
          'ios/App/App/Info.plist',
        ].includes(path),
      readText: (path) => {
        if (path.endsWith('AndroidManifest.xml')) {
          return [
            '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
            '  <uses-permission android:name="android.permission.INTERNET" />',
            '  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
            '</manifest>',
          ].join('\n');
        }
        return '<plist version="1.0"><dict><key>CFBundleName</key><string>Elevate Life</string></dict></plist>';
      },
    },
  );
  assert.deepEqual(okResult.errors, [], `network-only mobile permissions should pass: ${okResult.errors.join(', ')}`);

  const badResult = validateMobilePermissions(
    {
      ANDROID_NATIVE_PROJECT_DIR: 'android',
      IOS_NATIVE_PROJECT_DIR: 'ios',
    },
    {
      exists: (path) =>
        [
          'android/app/src/main/AndroidManifest.xml',
          'ios/App/App/Info.plist',
        ].includes(path),
      readText: (path) => {
        if (path.endsWith('AndroidManifest.xml')) {
          return [
            '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
            '  <uses-permission android:name="android.permission.CAMERA" />',
            '  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
            '  <uses-permission android:name="android.permission.READ_SMS" />',
            '</manifest>',
          ].join('\n');
        }
        return [
          '<plist version="1.0"><dict>',
          '<key>NSCameraUsageDescription</key><string>Scan receipts</string>',
          '<key>NSLocationWhenInUseUsageDescription</key><string>Nearby banks</string>',
          '<key>NSContactsUsageDescription</key><string>Invite family</string>',
          '</dict></plist>',
        ].join('\n');
      },
    },
  );
  assert.equal(badResult.ok, false, 'sensitive mobile permissions should fail.');
  for (const phrase of [
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.READ_SMS',
    'NSCameraUsageDescription',
    'NSLocationWhenInUseUsageDescription',
    'NSContactsUsageDescription',
  ]) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `mobile permission validator should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-mobile-permissions.ts');
  for (const phrase of [
    'ANDROID_NATIVE_PROJECT_DIR',
    'IOS_NATIVE_PROJECT_DIR',
    'MOBILE_ALLOWED_ANDROID_PERMISSIONS',
    'MOBILE_ALLOWED_IOS_USAGE_KEYS',
    'AndroidManifest.xml',
    'Info.plist',
    'android.permission.CAMERA',
    'NSCameraUsageDescription',
  ]) {
    assert(validator.includes(phrase), `mobile permissions validator should mention ${phrase}.`);
  }

  const permissionsGuide = read('docs/release/mobile-permissions.md');
  assert(
    permissionsGuide.includes('npm run mobile:permissions:check') &&
      permissionsGuide.includes('AndroidManifest.xml') &&
      permissionsGuide.includes('Info.plist') &&
      permissionsGuide.includes('通讯录') &&
      permissionsGuide.includes('定位') &&
      permissionsGuide.includes('相机') &&
      permissionsGuide.includes('麦克风') &&
      permissionsGuide.includes('短信'),
    'Mobile permissions guide should document the permission audit and sensitive capability policy.',
  );

  const nativeGuide = read('docs/release/native-wrapper.md');
  assert(
    nativeGuide.includes('docs/release/mobile-permissions.md') &&
      nativeGuide.includes('npm run mobile:permissions:check'),
    'Native wrapper guide should link the mobile permissions audit.',
  );

  const privacyGuide = read('docs/release/privacy-data-safety.md');
  assert(
    privacyGuide.includes('npm run mobile:permissions:check') &&
      privacyGuide.includes('权限最小化'),
    'Privacy guide should include the mobile permissions audit command.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run mobile:permissions:check') &&
      checklist.includes('移动权限审计'),
    'Store publishing checklist should include mobile permissions audit.',
  );

  const preflightSource = read('scripts/store-preflight.ts');
  assert(
    preflightSource.includes('Mobile permission readiness') &&
      preflightSource.includes('npx tsx scripts/check-mobile-permissions-readiness.ts'),
    'Store preflight should include mobile permissions readiness.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-mobile-permissions-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-mobile-permissions.ts') &&
      releaseReadiness.includes('mobile:permissions:check'),
    'Overall store release readiness should include mobile permissions validation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
