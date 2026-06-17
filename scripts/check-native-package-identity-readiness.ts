import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_APP_ID = 'com.elevatelife.app';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function readJson(path: string) {
  return JSON.parse(read(path));
}

function exists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function assertNoExamplePackage(path: string) {
  assert(
    !read(path).includes('com.example.elevatelife'),
    `${path} should not contain the placeholder com.example.elevatelife package id.`,
  );
}

const requiredFiles = [
  'capacitor.config.ts',
  'android/app/build.gradle',
  'android/app/src/main/assets/capacitor.config.json',
  'android/app/src/main/res/values/strings.xml',
  'android/app/src/main/java/com/elevatelife/app/MainActivity.java',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/capacitor.config.json',
  'docs/release/native-wrapper.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(exists(path), `${path} should exist for native package identity readiness.`);
}

const packageJson = readJson('package.json');
assert.equal(
  packageJson.scripts['mobile:identity:check'],
  'npx tsx scripts/check-native-package-identity-readiness.ts',
  'package.json should expose mobile:identity:check.',
);
assert(
  packageJson.scripts['mobile:sync']?.includes('npm run mobile:identity:check'),
  'mobile:sync should run mobile:identity:check after Capacitor sync.',
);

const capacitorConfigSource = read('capacitor.config.ts');
assert(
  capacitorConfigSource.includes(`process.env.CAPACITOR_APP_ID || '${DEFAULT_APP_ID}'`),
  `Capacitor config default appId should be ${DEFAULT_APP_ID}.`,
);

const androidGradleSource = read('android/app/build.gradle');
assert(androidGradleSource.includes(`namespace "${DEFAULT_APP_ID}"`), 'Android namespace should use the default release app id.');
assert(
  androidGradleSource.includes(`applicationId "${DEFAULT_APP_ID}"`),
  'Android applicationId should use the default release app id.',
);

const androidConfig = readJson('android/app/src/main/assets/capacitor.config.json');
assert.equal(androidConfig.appId, DEFAULT_APP_ID, 'Android capacitor.config.json appId should match the default release app id.');

const androidStringsSource = read('android/app/src/main/res/values/strings.xml');
assert(androidStringsSource.includes(`<string name="package_name">${DEFAULT_APP_ID}</string>`));
assert(androidStringsSource.includes(`<string name="custom_url_scheme">${DEFAULT_APP_ID}</string>`));

const mainActivitySource = read('android/app/src/main/java/com/elevatelife/app/MainActivity.java');
assert(mainActivitySource.includes(`package ${DEFAULT_APP_ID};`), 'Android MainActivity package should match app id path.');
assert(
  !exists('android/app/src/main/java/com/example/elevatelife/MainActivity.java'),
  'Old Android MainActivity package path should be removed.',
);

const iosProjectSource = read('ios/App/App.xcodeproj/project.pbxproj');
assert(
  [...iosProjectSource.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].every((match) => match[1] === DEFAULT_APP_ID),
  'Every iOS PRODUCT_BUNDLE_IDENTIFIER should use the default release app id.',
);

const iosConfig = readJson('ios/App/App/capacitor.config.json');
assert.equal(iosConfig.appId, DEFAULT_APP_ID, 'iOS capacitor.config.json appId should match the default release app id.');

for (const path of [
  'android/app/build.gradle',
  'android/app/src/main/assets/capacitor.config.json',
  'android/app/src/main/res/values/strings.xml',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/capacitor.config.json',
]) {
  assertNoExamplePackage(path);
}

const nativeGuide = read('docs/release/native-wrapper.md');
assert(
  nativeGuide.includes('mobile:identity:check') &&
    nativeGuide.includes(DEFAULT_APP_ID) &&
    nativeGuide.includes('不要使用 com.example'),
  'Native wrapper guide should document package identity verification and avoid com.example package ids.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('npm run mobile:identity:check') &&
    checklist.includes(DEFAULT_APP_ID),
  'Store publishing checklist should include native package identity verification.',
);
