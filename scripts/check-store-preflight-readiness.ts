import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/store-preflight.ts',
  'docs/release/store-preflight.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for store preflight readiness.`);
}

const expectedCommands = [
  'npx tsx scripts/check-store-release-readiness.ts',
  'npx tsx scripts/check-public-compliance-pages.ts',
  'npx tsx scripts/check-legal-consent-gate.ts',
  'npx tsx scripts/check-market-privacy-readiness.ts',
  'npx tsx scripts/check-review-account-readiness.ts',
  'npx tsx scripts/check-store-screenshot-readiness.ts',
  'npx tsx scripts/check-store-submission-package-readiness.ts',
  'npx tsx scripts/check-release-environment-readiness.ts',
  'npx tsx scripts/check-store-release-env-template-readiness.ts',
  'npx tsx scripts/check-deployed-store-smoke-readiness.ts',
  'npx tsx scripts/check-digital-asset-links-route.ts',
  'npx tsx scripts/check-android-signing-readiness.ts',
  'npx tsx scripts/check-android-release-apk-signature-readiness.ts',
  'npx tsx scripts/check-google-play-twa-readiness.ts',
  'npx tsx scripts/check-google-play-twa-artifact-readiness.ts',
  'npx tsx scripts/check-mobile-wrapper-readiness.ts',
  'npx tsx scripts/check-mobile-permissions-readiness.ts',
  'npx tsx scripts/check-capacitor-android-artifact-readiness.ts',
  'npx tsx scripts/check-ios-app-store-readiness.ts',
];

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['store:preflight'],
  'npx tsx scripts/store-preflight.ts',
  'package.json should expose store:preflight.',
);
assert.equal(
  packageJson.scripts['store:preflight:check'],
  'npx tsx scripts/check-store-preflight-readiness.ts',
  'package.json should expose store:preflight:check.',
);

async function main() {
  const { PREFLIGHT_CHECKS, runStorePreflight } = await import('./store-preflight');

  assert.deepEqual(
    PREFLIGHT_CHECKS.map((check: { command: string }) => check.command),
    expectedCommands,
    'Store preflight should run the local readiness checks in the expected order.',
  );

  const executed: string[] = [];
  const okResult = runStorePreflight({
    runner: (command: string) => {
      executed.push(command);
      return { status: 0 };
    },
    log: () => {},
  });
  assert.equal(okResult.ok, true, 'store preflight should pass when every child check exits 0.');
  assert.deepEqual(executed, expectedCommands, 'store preflight should execute every local readiness check.');

  const failResult = runStorePreflight({
    runner: (command: string) => ({ status: command.includes('check-google-play-twa-readiness') ? 1 : 0 }),
    log: () => {},
  });
  assert.equal(failResult.ok, false, 'store preflight should fail when a child check fails.');
  assert(
    failResult.failures.some((failure: { command: string }) =>
      failure.command.includes('check-google-play-twa-readiness'),
    ),
    'store preflight should report the failed child check.',
  );

  const preflightSource = read('scripts/store-preflight.ts');
  for (const command of expectedCommands) {
    assert(preflightSource.includes(command), `store preflight script should include ${command}.`);
  }
  assert(
    preflightSource.includes('STORE_PREFLIGHT_SKIP_BUILD') &&
      preflightSource.includes('npm run build') &&
      preflightSource.includes('PREFLIGHT_CHECKS'),
    'store preflight script should document optional build verification and expose PREFLIGHT_CHECKS.',
  );

  const preflightGuide = read('docs/release/store-preflight.md');
  assert(
    preflightGuide.includes('npm run store:preflight') &&
    preflightGuide.includes('STORE_PREFLIGHT_SKIP_BUILD=1') &&
    preflightGuide.includes('不会替代') &&
      preflightGuide.includes('release:env:template:check') &&
    preflightGuide.includes('android:artifact:check') &&
      preflightGuide.includes('ios:archive:check') &&
      preflightGuide.includes('twa:artifact:check'),
    'store preflight guide should explain command usage and real artifact checks it does not replace.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('docs/release/store-preflight.md') &&
      checklist.includes('npm run store:preflight'),
    'Publishing checklist should point to the store preflight command.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-store-preflight-readiness.ts') &&
      releaseReadiness.includes('scripts/store-preflight.ts') &&
      releaseReadiness.includes('docs/release/store-preflight.md') &&
      releaseReadiness.includes('store:preflight'),
    'Overall store release readiness should include store preflight readiness.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
