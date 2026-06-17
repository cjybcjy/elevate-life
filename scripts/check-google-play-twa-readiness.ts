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
  'docs/android/twa-manifest.template.json',
  'docs/release/google-play-twa.md',
  'scripts/require-twa-env.ts',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for Google Play TWA release readiness.`);
}

const packageJson = readJson('package.json');
assert(
  packageJson.devDependencies?.['@bubblewrap/cli'],
  '@bubblewrap/cli should be installed as a dev dependency for reproducible TWA builds.',
);

const requiredScripts = {
  'twa:check': 'npx tsx scripts/check-google-play-twa-readiness.ts',
  'twa:init': 'npm run twa:check && npx tsx scripts/require-twa-env.ts && bubblewrap init --manifest="$TWA_MANIFEST_URL" --directory="${TWA_OUTPUT_DIR:-android-twa}"',
  'twa:update': 'npm run twa:check && npx tsx scripts/require-twa-env.ts && cd "${TWA_OUTPUT_DIR:-android-twa}" && bubblewrap update',
  'twa:build': 'npm run twa:check && npx tsx scripts/require-twa-env.ts && cd "${TWA_OUTPUT_DIR:-android-twa}" && bubblewrap build',
};

for (const [name, command] of Object.entries(requiredScripts)) {
  assert.equal(packageJson.scripts?.[name], command, `${name} script should be "${command}".`);
}

const envExample = read('.env.example');
assert(
  envExample.includes('TWA_MANIFEST_URL=') &&
    envExample.includes('TWA_OUTPUT_DIR=') &&
    envExample.includes('TWA_SIGNING_KEY_PATH=') &&
    envExample.includes('TWA_SIGNING_KEY_ALIAS='),
  '.env.example should document the Bubblewrap/TWA environment variables.',
);

const envGuardSource = read('scripts/require-twa-env.ts');
assert(
  envGuardSource.includes('TWA_MANIFEST_URL') &&
    envGuardSource.includes('https://') &&
    envGuardSource.includes('process.exit(1)'),
  'TWA env guard should stop init/build commands when the hosted manifest URL is missing or unsafe.',
);

const template = readJson('docs/android/twa-manifest.template.json');
assert.equal(template.packageId, 'APP_PACKAGE_ID');
assert.equal(template.host, 'APP_HOST');
assert.equal(template.name, 'Elevate Life 家庭账本');
assert.equal(template.launcherName, '家庭账本');
assert.equal(template.display, 'standalone');
assert.equal(template.startUrl, '/');
assert.equal(template.webManifestUrl, 'https://APP_HOST/manifest.webmanifest');
assert.equal(template.iconUrl, 'https://APP_HOST/icon-512.png');
assert.equal(template.maskableIconUrl, 'https://APP_HOST/icon-512.png');
assert.equal(template.fallbackType, 'customtabs');
assert.equal(template.orientation, 'portrait');
assert.equal(template.signingKey.path, 'TWA_SIGNING_KEY_PATH');
assert.equal(template.signingKey.alias, 'TWA_SIGNING_KEY_ALIAS');
assert.deepEqual(template.fingerprints, []);

const guide = read('docs/release/google-play-twa.md');
assert(
  guide.includes('bubblewrap init --manifest') &&
    guide.includes('npm run twa:init') &&
    guide.includes('npm run twa:build') &&
    guide.includes('app-release-bundle.aab') &&
    guide.includes('/.well-known/assetlinks.json') &&
    guide.includes('Play App Signing') &&
    guide.includes('JDK') &&
    guide.includes('Android command line tools') &&
    guide.includes('target API level 35'),
  'Google Play TWA guide should document Bubblewrap init/build, AAB output, assetlinks, signing, and target API requirement.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('docs/release/google-play-twa.md') &&
    checklist.includes('npm run twa:check') &&
    checklist.includes('npm run twa:init') &&
    checklist.includes('app-release-bundle.aab'),
  'Main publishing checklist should link Google Play TWA docs and commands.',
);

const storeReadiness = read('scripts/check-store-release-readiness.ts');
assert(
  storeReadiness.includes('scripts/check-google-play-twa-readiness.ts') &&
    storeReadiness.includes('docs/release/google-play-twa.md') &&
    storeReadiness.includes('docs/android/twa-manifest.template.json'),
  'Overall store readiness check should include the Google Play TWA readiness artifacts.',
);
