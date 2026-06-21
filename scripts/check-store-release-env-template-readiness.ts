import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function exists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

const requiredFiles = [
  'docs/release/store-release.env.example',
  'docs/release/production-environment.md',
  'docs/release/store-preflight.md',
  'docs/release/store-publishing-checklist.md',
  'scripts/print-store-release-env-draft.ts',
];

for (const path of requiredFiles) {
  assert(exists(path), `${path} should exist for release environment handoff readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['release:env:template:check'],
  'npx tsx scripts/check-store-release-env-template-readiness.ts',
  'package.json should expose release:env:template:check.',
);
assert.equal(
  packageJson.scripts['release:env:draft'],
  'npx tsx scripts/print-store-release-env-draft.ts',
  'package.json should expose release:env:draft for assembling a private release env handoff.',
);
assert.equal(
  packageJson.scripts['release:env:next'],
  'npx tsx scripts/print-release-env-next-steps.ts',
  'package.json should expose release:env:next for the first public release environment blocker.',
);

const envExample = read('.env.example');
assert(
  envExample.includes('CAPACITOR_APP_ID=com.elevatelife.app') &&
    !envExample.includes('CAPACITOR_APP_ID=com.example.elevatelife'),
  '.env.example should use the current default app id instead of the old com.example placeholder.',
);

const template = read('docs/release/store-release.env.example');
for (const key of [
  'APP_PUBLIC_BASE_URL=',
  'APP_SUPPORT_EMAIL=',
  'CAPACITOR_SERVER_URL=',
  'CAPACITOR_APP_ID=com.elevatelife.app',
  'ANDROID_PACKAGE_NAME=com.elevatelife.app',
  'ANDROID_SHA256_CERT_FINGERPRINTS=',
  'TWA_MANIFEST_URL=',
  'STORE_SCREENSHOT_BASE_URL=',
  'TWA_SIGNING_KEY_PATH=',
  'TWA_SIGNING_KEY_ALIAS=',
  'ANDROID_KEYSTORE_STORE_PASSWORD=',
  'ANDROID_KEYSTORE_KEY_PASSWORD=',
  'IOS_ARCHIVE_PATH=',
  'STORE_SCREENSHOT_USERNAME=',
  'STORE_SCREENSHOT_PASSWORD=',
  'REVIEW_ACCOUNT_USERNAME=',
  'REVIEW_ACCOUNT_PASSWORD=',
]) {
  assert(template.includes(key), `store release env template should include ${key}.`);
}

assert(
  template.includes('不要提交') &&
    template.includes('真实 HTTPS') &&
    template.includes('Play App Signing') &&
    template.includes('upload keystore') &&
    !template.includes('com.example.elevatelife'),
  'store release env template should warn about secrets, real HTTPS values, signing fingerprints, and avoid old placeholder ids.',
);

const productionGuide = read('docs/release/production-environment.md');
assert(
  productionGuide.includes('docs/release/store-release.env.example') &&
    productionGuide.includes('npm run release:env:draft') &&
    productionGuide.includes('npm run release:env:next') &&
    productionGuide.includes('release:env:template:check'),
  'Production environment guide should point to the release env next-step command, draft command, template, and its check.',
);

const preflightGuide = read('docs/release/store-preflight.md');
assert(
  preflightGuide.includes('release:env:template:check') &&
    preflightGuide.includes('store-release.env.example'),
  'Store preflight guide should mention the release env template check.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('docs/release/store-release.env.example') &&
    checklist.includes('npm run release:env:next') &&
    checklist.includes('npm run release:env:draft') &&
    checklist.includes('npm run release:env:template:check'),
  'Publishing checklist should include the release env next-step command, draft, and template handoff step.',
);

const releaseReadiness = read('scripts/check-store-release-readiness.ts');
assert(
  releaseReadiness.includes('scripts/check-store-release-env-template-readiness.ts') &&
    releaseReadiness.includes('scripts/print-store-release-env-draft.ts') &&
    releaseReadiness.includes('scripts/print-release-env-next-steps.ts') &&
    releaseReadiness.includes('docs/release/store-release.env.example') &&
    releaseReadiness.includes('release:env:next') &&
    releaseReadiness.includes('release:env:draft') &&
    releaseReadiness.includes('release:env:template:check'),
  'Overall release readiness should include the release env next-step command, draft command, and template.',
);

const storePreflight = read('scripts/store-preflight.ts');
assert(
  storePreflight.includes('scripts/check-store-release-env-template-readiness.ts'),
  'Store preflight should run the release env template readiness check.',
);

async function main() {
  const { buildStoreReleaseEnvDraft } = await import('./print-store-release-env-draft');
  const fingerprint =
    'AB:F0:1E:B5:F2:4F:EF:3A:59:D4:B2:AE:02:C2:55:08:62:48:FE:49:3F:79:7E:0B:33:98:21:B8:26:B5:AD:E3';
  const draft = buildStoreReleaseEnvDraft(
    {
      APP_PUBLIC_BASE_URL: 'https://app.example.com',
      APP_SUPPORT_EMAIL: 'support@example.com',
      CAPACITOR_APP_ID: 'com.elevatelife.app',
    },
    {
      buildAabFingerprintReport: () => ({
        ok: true,
        errors: [],
        bundlePath: 'android/app/build/outputs/bundle/release/app-release.aab',
        signerFingerprint: fingerprint,
        envLine: `ANDROID_SHA256_CERT_FINGERPRINTS=${fingerprint}`,
      }),
    },
  );

  assert(draft.content.includes('APP_PUBLIC_BASE_URL=https://<your-production-host>'));
  assert(draft.content.includes('APP_SUPPORT_EMAIL=support@<your-domain>'));
  assert(draft.content.includes(`ANDROID_SHA256_CERT_FINGERPRINTS=${fingerprint}`));
  assert(draft.content.includes('TWA_MANIFEST_URL=https://<your-production-host>/manifest.webmanifest'));
  assert(draft.content.includes('ANDROID_APKSIGNER_PATH='));
  assert(!draft.content.includes('app.example.com'), 'release env draft should not carry app.example.com placeholders forward.');
  assert(
    draft.warnings.some((warning: string) => warning.includes('真实 HTTPS')) &&
      draft.warnings.some((warning: string) => warning.includes('Play App Signing')),
    'release env draft should warn about replacing public values and adding Play App Signing SHA-256.',
  );

  const draftSource = read('scripts/print-store-release-env-draft.ts');
  for (const phrase of [
    'buildStoreReleaseEnvDraft',
    'ANDROID_SHA256_CERT_FINGERPRINTS',
    'buildAndroidAabFingerprintReport',
    'release:check',
    '不要提交',
  ]) {
    assert(draftSource.includes(phrase), `release env draft script should mention ${phrase}.`);
  }

  const { buildReleaseEnvNextSteps } = await import('./print-release-env-next-steps');
  const nextSteps = buildReleaseEnvNextSteps({
    APP_PUBLIC_BASE_URL: 'https://app.example.com',
    APP_SUPPORT_EMAIL: '',
    CAPACITOR_SERVER_URL: '',
    CAPACITOR_APP_ID: 'com.elevatelife.app',
    ANDROID_PACKAGE_NAME: 'com.elevatelife.app',
    TWA_MANIFEST_URL: '',
    STORE_SCREENSHOT_BASE_URL: '',
    ANDROID_SHA256_CERT_FINGERPRINTS: '',
  });

  assert(nextSteps.includes('# Release environment next steps'));
  assert(nextSteps.includes('.env.production.local'));
  assert(nextSteps.includes('APP_PUBLIC_BASE_URL must be set to a real value'));
  assert(nextSteps.includes('APP_SUPPORT_EMAIL must be a real support mailbox'));
  assert(nextSteps.includes('npm run release:env:draft > /tmp/elevate-life-release.env'));
  assert(nextSteps.includes('npm run release:check'));
  assert(nextSteps.includes('npm run release:smoke'));
  assert(nextSteps.includes('不要提交'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
