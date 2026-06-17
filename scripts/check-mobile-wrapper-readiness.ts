import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function readJson(path: string) {
  return JSON.parse(read(path));
}

const requiredFiles = [
  'capacitor.config.ts',
  'mobile-web/index.html',
  'docs/release/native-wrapper.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for native mobile packaging readiness.`);
}

const packageJson = readJson('package.json');

for (const dependency of ['@capacitor/core', '@capacitor/android', '@capacitor/ios']) {
  assert(
    packageJson.dependencies?.[dependency],
    `${dependency} should be installed so Android domestic and iOS wrappers can be generated.`,
  );
}

assert(
  packageJson.devDependencies?.['@capacitor/cli'],
  '@capacitor/cli should be installed as a dev dependency for native sync/build commands.',
);

const requiredScripts = {
  'mobile:check': 'npx tsx scripts/check-mobile-wrapper-readiness.ts',
  'mobile:identity:check': 'npx tsx scripts/check-native-package-identity-readiness.ts',
  'mobile:sync': 'npm run mobile:check && npx cap sync && npm run mobile:identity:check',
  'mobile:add:android': 'npx cap add android',
  'mobile:add:ios': 'npx cap add ios',
  'mobile:open:android': 'npx cap open android',
  'mobile:open:ios': 'npx cap open ios',
};

for (const [name, command] of Object.entries(requiredScripts)) {
  assert.equal(packageJson.scripts?.[name], command, `${name} script should be "${command}".`);
}

const configSource = read('capacitor.config.ts');
assert(
  configSource.includes('CapacitorConfig') &&
    configSource.includes('CAPACITOR_SERVER_URL') &&
    configSource.includes('CAPACITOR_APP_ID') &&
    configSource.includes("appName: 'Elevate Life'") &&
    configSource.includes("webDir: 'mobile-web'") &&
    configSource.includes('cleartext: false') &&
    configSource.includes("backgroundColor: '#0f172a'"),
  'Capacitor config should support env-driven HTTPS server URL, package id, fallback webDir, and store-safe defaults.',
);

const fallbackSource = read('mobile-web/index.html');
assert(
  fallbackSource.includes('Elevate Life') &&
    fallbackSource.includes('需要连接到线上服务') &&
    fallbackSource.includes('/support') &&
    fallbackSource.includes('/privacy'),
  'Native fallback page should explain that the app requires the hosted service and link compliance pages.',
);

const nativeGuideSource = read('docs/release/native-wrapper.md');
assert(
  nativeGuideSource.includes('CAPACITOR_SERVER_URL') &&
    nativeGuideSource.includes('CAPACITOR_APP_ID') &&
    nativeGuideSource.includes('npm run mobile:add:android') &&
    nativeGuideSource.includes('npm run mobile:add:ios') &&
    nativeGuideSource.includes('Android 国内市场') &&
    nativeGuideSource.includes('iOS App Store') &&
    nativeGuideSource.includes('不要把 .next 当作 Capacitor webDir') &&
    nativeGuideSource.includes('真实 HTTPS 域名'),
  'Native wrapper guide should document env variables, commands, Android/iOS store path, and hosted Next.js constraint.',
);

const checklistSource = read('docs/release/store-publishing-checklist.md');
assert(
  checklistSource.includes('docs/release/native-wrapper.md') &&
    checklistSource.includes('mobile:check') &&
    checklistSource.includes('CAPACITOR_SERVER_URL'),
  'Main publishing checklist should link the native wrapper guide and validation command.',
);

const envExampleSource = read('.env.example');
assert(
  envExampleSource.includes('CAPACITOR_SERVER_URL=') &&
    envExampleSource.includes('CAPACITOR_APP_ID='),
  '.env.example should document the mobile wrapper environment variables.',
);
