import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'src/lib/legal-consent.ts',
  'src/components/common/LegalConsentGate.tsx',
  'src/components/layout/AppShell.tsx',
  'docs/release/privacy-data-safety.md',
  'docs/release/store-publishing-checklist.md',
  'scripts/store-preflight.ts',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for legal consent gate readiness.`);
}

async function main() {
  const {
    LEGAL_CONSENT_PUBLIC_PATHS,
    LEGAL_CONSENT_STORAGE_KEY,
    LEGAL_CONSENT_VERSION,
    shouldBypassLegalConsent,
  } = await import('../src/lib/legal-consent');

  assert.equal(LEGAL_CONSENT_STORAGE_KEY, 'elevate-life:legal-consent');
  assert.match(LEGAL_CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(LEGAL_CONSENT_PUBLIC_PATHS, ['/privacy', '/terms', '/support', '/account-deletion']);

  for (const path of ['/privacy', '/privacy/detail', '/terms', '/support', '/account-deletion']) {
    assert.equal(shouldBypassLegalConsent(path), true, `${path} should bypass legal consent.`);
  }
  for (const path of ['/', '/login', '/register', '/management/assets', '/management/budget']) {
    assert.equal(shouldBypassLegalConsent(path), false, `${path} should require legal consent.`);
  }

  const gateSource = read('src/components/common/LegalConsentGate.tsx');
  assert(
    gateSource.includes("'use client'") &&
      gateSource.includes('localStorage') &&
      gateSource.includes('LEGAL_CONSENT_STORAGE_KEY') &&
      gateSource.includes('LEGAL_CONSENT_VERSION') &&
      gateSource.includes('shouldBypassLegalConsent') &&
      gateSource.includes('role="dialog"') &&
      gateSource.includes('aria-modal="true"') &&
      gateSource.includes('/privacy') &&
      gateSource.includes('/terms') &&
      gateSource.includes('隐私政策') &&
      gateSource.includes('用户协议') &&
      gateSource.includes('同意并继续') &&
      gateSource.includes('不同意'),
    'Legal consent gate should be a client dialog with localStorage, legal links, and agree/decline actions.',
  );

  const shellSource = read('src/components/layout/AppShell.tsx');
  assert(
    shellSource.includes("import LegalConsentGate from '@/components/common/LegalConsentGate';") &&
      shellSource.includes('<LegalConsentGate />') &&
      shellSource.includes('/terms') &&
      shellSource.includes('/privacy'),
    'AppShell should render LegalConsentGate and keep legal pages in publicPaths.',
  );

  const privacyGuide = read('docs/release/privacy-data-safety.md');
  assert(
    privacyGuide.includes('首次启动') &&
      privacyGuide.includes('用户协议') &&
      privacyGuide.includes('隐私政策') &&
      privacyGuide.includes('同意前'),
    'Privacy/data-safety guide should document first-launch consent before optional SDK initialization.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('首次启动') &&
      checklist.includes('用户协议') &&
      checklist.includes('隐私政策') &&
      checklist.includes('同意前'),
    'Publishing checklist should include first-launch privacy and terms consent.',
  );

  const preflightSource = read('scripts/store-preflight.ts');
  assert(
    preflightSource.includes('Legal consent gate') &&
      preflightSource.includes('npx tsx scripts/check-legal-consent-gate.ts'),
    'Store preflight should include the legal consent gate readiness check.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-legal-consent-gate.ts') &&
      releaseReadiness.includes('src/components/common/LegalConsentGate.tsx') &&
      releaseReadiness.includes('src/lib/legal-consent.ts'),
    'Overall store release readiness should include legal consent gate files.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
