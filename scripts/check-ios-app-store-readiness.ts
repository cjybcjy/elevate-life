import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/validate-ios-archive.ts',
  'docs/release/ios-app-store.md',
  'docs/release/native-wrapper.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for iOS App Store readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['ios:archive:check'],
  'npx tsx scripts/validate-ios-archive.ts',
  'package.json should expose ios:archive:check.',
);

async function main() {
  const { validateIosArchive } = await import('./validate-ios-archive');
  const env = {
    CAPACITOR_APP_ID: 'com.elevatelife.app',
    CAPACITOR_SERVER_URL: 'https://app.elevatelife.example',
    IOS_NATIVE_PROJECT_DIR: 'ios',
    IOS_ARCHIVE_PATH: 'ios/build/ElevateLife.xcarchive',
  };
  const capacitorConfig = {
    appId: 'com.elevatelife.app',
    appName: 'Elevate Life',
    server: { url: 'https://app.elevatelife.example', cleartext: false },
  };
  const appInfoPlist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0"><dict>',
    '<key>CFBundleIdentifier</key><string>com.elevatelife.app</string>',
    '</dict></plist>',
  ].join('\n');

  const okResult = validateIosArchive(env, {
    exists: (path) =>
      [
        'ios/App/App.xcodeproj/project.pbxproj',
        'ios/App/App/Info.plist',
        'ios/App/App/capacitor.config.json',
        'ios/build/ElevateLife.xcarchive',
        'ios/build/ElevateLife.xcarchive/Info.plist',
        'ios/build/ElevateLife.xcarchive/Products/Applications/App.app/Info.plist',
      ].includes(path),
    readText: (path) => {
      if (path.endsWith('project.pbxproj')) {
        return 'PRODUCT_BUNDLE_IDENTIFIER = com.elevatelife.app;';
      }
      if (path.endsWith('capacitor.config.json')) {
        return JSON.stringify(capacitorConfig);
      }
      return appInfoPlist;
    },
  });
  assert.deepEqual(okResult.errors, [], `valid iOS archive should pass: ${okResult.errors.join(', ')}`);
  assert.equal(okResult.archivePath, 'ios/build/ElevateLife.xcarchive');

  const badResult = validateIosArchive(env, {
    exists: (path) =>
      ['ios/App/App.xcodeproj/project.pbxproj', 'ios/App/App/capacitor.config.json'].includes(path),
    readText: (path) => {
      if (path.endsWith('project.pbxproj')) {
        return 'PRODUCT_BUNDLE_IDENTIFIER = com.other.app;';
      }
      return JSON.stringify({
        appId: 'com.other.app',
        server: { url: 'http://localhost:3000', cleartext: true },
      });
    },
  });
  assert(!badResult.ok, 'invalid iOS archive should fail.');
  for (const phrase of ['iOS archive', 'PRODUCT_BUNDLE_IDENTIFIER', 'server.url', 'cleartext', 'Info.plist']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `invalid iOS archive should report ${phrase}.`,
    );
  }

  const validator = read('scripts/validate-ios-archive.ts');
  for (const phrase of [
    'IOS_NATIVE_PROJECT_DIR',
    'IOS_ARCHIVE_PATH',
    'CAPACITOR_APP_ID',
    'CAPACITOR_SERVER_URL',
    'PRODUCT_BUNDLE_IDENTIFIER',
    'capacitor.config.json',
    '.xcarchive',
    'CFBundleIdentifier',
  ]) {
    assert(validator.includes(phrase), `iOS archive validator should mention ${phrase}.`);
  }

  const iosGuide = read('docs/release/ios-app-store.md');
  assert(
    iosGuide.includes('npm run ios:archive:check') &&
      iosGuide.includes('IOS_ARCHIVE_PATH') &&
      iosGuide.includes('Xcode 26') &&
      iosGuide.includes('CAPACITOR_SERVER_URL') &&
      iosGuide.includes('CAPACITOR_APP_ID') &&
      iosGuide.includes('App Store Connect'),
    'iOS guide should document archive validation, Xcode requirement, env vars, and App Store Connect steps.',
  );

  const nativeGuide = read('docs/release/native-wrapper.md');
  assert(
    nativeGuide.includes('docs/release/ios-app-store.md') &&
      nativeGuide.includes('npm run ios:archive:check'),
    'Native wrapper guide should link the iOS archive validation guide.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run ios:archive:check') &&
      checklist.includes('iOS Archive 产物'),
    'Store publishing checklist should include iOS archive validation.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-ios-app-store-readiness.ts') &&
      releaseReadiness.includes('scripts/validate-ios-archive.ts') &&
      releaseReadiness.includes('ios:archive:check'),
    'Overall store release readiness should include iOS archive validation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
