import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'src/app/manifest.ts',
  'public/sw.js',
  'public/offline.html',
  'src/components/common/PwaRegistration.tsx',
  'src/components/common/LegalConsentGate.tsx',
  'src/lib/legal-consent.ts',
  'src/app/.well-known/assetlinks.json/route.ts',
  'docs/android/assetlinks.template.json',
  'docs/android/twa-manifest.template.json',
  'docs/release/android-native-artifact.md',
  'docs/release/android-signing.md',
  'docs/release/google-play-twa.md',
  'docs/release/ios-app-store.md',
  'docs/release/mobile-permissions.md',
  'docs/release/privacy-data-safety.md',
  'docs/release/production-environment.md',
  'docs/release/store-release.env.example',
  'docs/release/store-preflight.md',
  'docs/release/store-publishing-checklist.md',
  'docs/release/store-submission-package.md',
  'docs/release/app-store-metadata.md',
  'scripts/check-android-signing-readiness.ts',
  'scripts/check-android-release-bundle-signature-readiness.ts',
  'scripts/check-android-release-apk-signature-readiness.ts',
  'scripts/check-capacitor-android-artifact-readiness.ts',
  'scripts/check-google-play-twa-artifact-readiness.ts',
  'scripts/check-google-play-twa-readiness.ts',
  'scripts/check-ios-app-store-readiness.ts',
  'scripts/check-deployed-store-smoke-readiness.ts',
  'scripts/check-legal-consent-gate.ts',
  'scripts/check-market-privacy-readiness.ts',
  'scripts/check-mobile-permissions-readiness.ts',
  'scripts/check-native-package-identity-readiness.ts',
  'scripts/check-release-environment-readiness.ts',
  'scripts/check-store-release-env-template-readiness.ts',
  'scripts/check-review-account-readiness.ts',
  'scripts/check-store-screenshot-readiness.ts',
  'scripts/check-store-preflight-readiness.ts',
  'scripts/check-store-submission-package-readiness.ts',
  'scripts/capture-store-screenshots.ts',
  'scripts/generate-store-submission-package.ts',
  'scripts/store-preflight.ts',
  'scripts/validate-android-signing.ts',
  'scripts/validate-android-release-bundle-signature.ts',
  'scripts/validate-android-release-apk-signature.ts',
  'scripts/validate-capacitor-android-artifact.ts',
  'scripts/validate-ios-archive.ts',
  'scripts/validate-mobile-permissions.ts',
  'scripts/validate-twa-build-artifact.ts',
  'scripts/validate-release-env.ts',
  'scripts/smoke-test-store-deployment.ts',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for store release readiness.`);
}

const manifestSource = read('src/app/manifest.ts');
assert(
  manifestSource.includes('MetadataRoute.Manifest') &&
    manifestSource.includes("id: '/'") &&
    manifestSource.includes("scope: '/'") &&
    manifestSource.includes("display: 'standalone'") &&
    manifestSource.includes("orientation: 'portrait-primary'") &&
    manifestSource.includes("lang: 'zh-CN'") &&
    manifestSource.includes("categories: ['finance', 'productivity']") &&
    manifestSource.includes("purpose: 'maskable'"),
  'App manifest should expose store-friendly PWA metadata and maskable icons.',
);

const registrationSource = read('src/components/common/PwaRegistration.tsx');
const legalConsentSource = read('src/components/common/LegalConsentGate.tsx');
const legalConsentLogicSource = read('src/lib/legal-consent.ts');
const layoutSource = read('src/app/layout.tsx');
const shellSource = read('src/components/layout/AppShell.tsx');
const proxySource = read('src/proxy.ts');
assert(
  registrationSource.includes("'use client'") &&
    registrationSource.includes("navigator.serviceWorker.register('/sw.js'") &&
    registrationSource.includes("process.env.NODE_ENV === 'production'"),
  'PWA registration should be a production-only client component.',
);
assert(
  (layoutSource.includes("import AppShell from '@/components/layout/AppShell';") ||
    layoutSource.includes('import AppShell from "@/components/layout/AppShell";')) &&
    layoutSource.includes('<AppShell>') &&
    shellSource.includes('<PwaRegistration />') &&
    shellSource.includes('<LegalConsentGate />') &&
    layoutSource.includes('manifest: "/manifest.webmanifest"'),
  'Root layout and AppShell should register PWA support and point metadata at the App Router manifest.',
);
assert(
  legalConsentSource.includes('LEGAL_CONSENT_STORAGE_KEY') &&
    legalConsentSource.includes('localStorage') &&
    legalConsentSource.includes('/privacy') &&
    legalConsentSource.includes('/terms') &&
    legalConsentLogicSource.includes('shouldBypassLegalConsent') &&
    legalConsentLogicSource.includes('LEGAL_CONSENT_PUBLIC_PATHS'),
  'Legal consent gate should block app usage until the user accepts privacy policy and terms, while allowing legal pages.',
);
assert(
  proxySource.includes('export const proxy') &&
    proxySource.includes('/manifest.webmanifest') &&
    proxySource.includes('/sw.js') &&
    proxySource.includes('/offline.html') &&
    proxySource.includes("/.well-known/"),
  'Auth proxy should allow anonymous access to PWA and Digital Asset Links files.',
);

const serviceWorkerSource = read('public/sw.js');
assert(
  serviceWorkerSource.includes('elevate-life-shell') &&
    serviceWorkerSource.includes('/offline.html') &&
    serviceWorkerSource.includes("url.pathname.startsWith('/api/')") &&
    serviceWorkerSource.includes("request.mode === 'navigate'"),
  'Service worker should provide a conservative offline shell and avoid caching API responses.',
);

const assetLinksTemplateSource = read('docs/android/assetlinks.template.json');
const assetLinksRouteSource = read('src/app/.well-known/assetlinks.json/route.ts');
const twaTemplateSource = read('docs/android/twa-manifest.template.json');
assert(
  assetLinksTemplateSource.includes('delegate_permission/common.handle_all_urls') &&
    assetLinksTemplateSource.includes('PACKAGE_NAME') &&
    assetLinksTemplateSource.includes('SHA256_FINGERPRINT'),
  'Digital Asset Links template should document the placeholders needed by TWA packaging.',
);
assert(
  assetLinksRouteSource.includes('ANDROID_PACKAGE_NAME') &&
    assetLinksRouteSource.includes('ANDROID_SHA256_CERT_FINGERPRINTS') &&
    assetLinksRouteSource.includes('delegate_permission/common.handle_all_urls') &&
    assetLinksRouteSource.includes('sha256_cert_fingerprints'),
  'Digital Asset Links route should serve the TWA association file from environment variables.',
);
assert(
  twaTemplateSource.includes('"packageId": "APP_PACKAGE_ID"') &&
    twaTemplateSource.includes('"webManifestUrl": "https://APP_HOST/manifest.webmanifest"') &&
    twaTemplateSource.includes('"fallbackType": "customtabs"') &&
    twaTemplateSource.includes('"generatorApp": "bubblewrap-cli"'),
  'TWA manifest template should document the Bubblewrap fields required for the Google Play wrapper.',
);

const publishingGuideSource = read('docs/release/store-publishing-checklist.md');
assert(
    publishingGuideSource.includes('从易到难') &&
    publishingGuideSource.includes('Google Play') &&
    publishingGuideSource.includes('docs/release/store-preflight.md') &&
    publishingGuideSource.includes('npm run store:preflight') &&
    publishingGuideSource.includes('docs/release/store-submission-package.md') &&
    publishingGuideSource.includes('npm run store:submission') &&
    publishingGuideSource.includes('docs/release/android-signing.md') &&
    publishingGuideSource.includes('npm run android:signing:check') &&
    publishingGuideSource.includes('npm run android:aab:signature:check') &&
    publishingGuideSource.includes('npm run android:apk:signature:check') &&
    publishingGuideSource.includes('docs/release/android-native-artifact.md') &&
    publishingGuideSource.includes('npm run android:artifact:check') &&
    publishingGuideSource.includes('docs/release/mobile-permissions.md') &&
    publishingGuideSource.includes('npm run mobile:permissions:check') &&
    publishingGuideSource.includes('docs/release/production-environment.md') &&
    publishingGuideSource.includes('docs/release/store-release.env.example') &&
    publishingGuideSource.includes('npm run release:env:template:check') &&
    publishingGuideSource.includes('npm run release:check') &&
    publishingGuideSource.includes('npm run release:smoke') &&
    publishingGuideSource.includes('docs/release/privacy-data-safety.md') &&
    publishingGuideSource.includes('npm run privacy:check') &&
    publishingGuideSource.includes('Trusted Web Activity') &&
    publishingGuideSource.includes('Bubblewrap') &&
    publishingGuideSource.includes('docs/release/google-play-twa.md') &&
    publishingGuideSource.includes('npm run twa:check') &&
    publishingGuideSource.includes('npm run twa:artifact:check') &&
    publishingGuideSource.includes('API level 35') &&
    publishingGuideSource.includes('/.well-known/assetlinks.json') &&
    publishingGuideSource.includes('ANDROID_SHA256_CERT_FINGERPRINTS') &&
    publishingGuideSource.includes('Android 国内市场') &&
    publishingGuideSource.includes('Capacitor Android release 产物') &&
    publishingGuideSource.includes('移动权限审计') &&
    publishingGuideSource.includes('APP 备案') &&
    publishingGuideSource.includes('iOS App Store') &&
    publishingGuideSource.includes('docs/release/ios-app-store.md') &&
    publishingGuideSource.includes('npm run ios:archive:check') &&
    publishingGuideSource.includes('iOS Archive 产物') &&
    publishingGuideSource.includes('Xcode 26') &&
    publishingGuideSource.includes('隐私政策') &&
    publishingGuideSource.includes('截图'),
  'Publishing checklist should cover Google Play, Android domestic stores, iOS App Store, current SDK/API requirements, privacy, China filing, and screenshots.',
);

const metadataSource = read('docs/release/app-store-metadata.md');
assert(
  metadataSource.includes('应用名称') &&
    metadataSource.includes('一句话简介') &&
    metadataSource.includes('关键词') &&
    metadataSource.includes('隐私政策 URL') &&
    metadataSource.includes('审核备注') &&
    metadataSource.includes('截图规格'),
  'Store metadata draft should include app name, subtitle, keywords, privacy URL, review notes, and screenshot requirements.',
);

const packageJson = JSON.parse(read('package.json'));
assert(
  packageJson.scripts['screenshots:check'] === 'npx tsx scripts/check-store-screenshot-readiness.ts' &&
    packageJson.scripts['screenshots:store'] === 'npx tsx scripts/capture-store-screenshots.ts' &&
    packageJson.scripts['store:preflight'] === 'npx tsx scripts/store-preflight.ts' &&
    packageJson.scripts['store:preflight:check'] === 'npx tsx scripts/check-store-preflight-readiness.ts' &&
    packageJson.scripts['store:submission'] === 'npx tsx scripts/generate-store-submission-package.ts' &&
    packageJson.scripts['store:submission:check'] === 'npx tsx scripts/check-store-submission-package-readiness.ts' &&
    packageJson.scripts['android:signing:check'] === 'npx tsx scripts/validate-android-signing.ts' &&
    packageJson.scripts['android:aab:signature:check'] === 'npx tsx scripts/validate-android-release-bundle-signature.ts' &&
    packageJson.scripts['android:apk:signature:check'] === 'npx tsx scripts/validate-android-release-apk-signature.ts' &&
    packageJson.scripts['android:artifact:check'] === 'npx tsx scripts/validate-capacitor-android-artifact.ts' &&
    packageJson.scripts['mobile:identity:check'] === 'npx tsx scripts/check-native-package-identity-readiness.ts' &&
    packageJson.scripts['mobile:permissions:check'] === 'npx tsx scripts/validate-mobile-permissions.ts' &&
    packageJson.scripts['ios:archive:check'] === 'npx tsx scripts/validate-ios-archive.ts' &&
    packageJson.scripts['twa:artifact:check'] === 'npx tsx scripts/validate-twa-build-artifact.ts' &&
    packageJson.scripts['release:check'] === 'npx tsx scripts/validate-release-env.ts' &&
    packageJson.scripts['release:env:template:check'] === 'npx tsx scripts/check-store-release-env-template-readiness.ts' &&
    packageJson.scripts['release:smoke'] === 'npx tsx scripts/smoke-test-store-deployment.ts' &&
    packageJson.scripts['review:check'] === 'npx tsx scripts/check-review-account-readiness.ts' &&
    packageJson.scripts['review:seed'] === 'npx tsx prisma/seed.ts' &&
    packageJson.devDependencies?.playwright,
  'Store release readiness should include review account and reproducible Playwright screenshot commands.',
);
assert(
  publishingGuideSource.includes('npm run screenshots:check') &&
    publishingGuideSource.includes('npm run screenshots:store') &&
    publishingGuideSource.includes('store-screenshots/'),
  'Publishing checklist should include screenshot generation as a release step.',
);
