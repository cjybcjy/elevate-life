import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/capture-store-screenshots.ts',
  'docs/release/app-store-metadata.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for store screenshot readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['screenshots:check'],
  'npx tsx scripts/check-store-screenshot-readiness.ts',
  'package.json should expose a screenshots:check readiness command.',
);
assert.equal(
  packageJson.scripts['screenshots:store'],
  'npx tsx scripts/capture-store-screenshots.ts',
  'package.json should expose a screenshots:store capture command.',
);
assert(
  packageJson.devDependencies?.playwright,
  'playwright should be installed as a dev dependency for reproducible store screenshots.',
);

const envExample = read('.env.example');
assert(
  envExample.includes('STORE_SCREENSHOT_BASE_URL=$APP_PUBLIC_BASE_URL') &&
    envExample.includes('STORE_SCREENSHOT_OUTPUT_DIR=store-screenshots') &&
    envExample.includes('STORE_SCREENSHOT_USERNAME=demo') &&
    envExample.includes('STORE_SCREENSHOT_PASSWORD=demo123'),
  '.env.example should document store screenshot base URL, output dir, and optional review account credentials.',
);

const gitignore = read('.gitignore');
assert(
  gitignore.includes('/store-screenshots/'),
  '.gitignore should exclude generated store screenshots from source control.',
);

const captureSource = read('scripts/capture-store-screenshots.ts');
assert(
  captureSource.includes('chromium') &&
    captureSource.includes('devices') &&
    captureSource.includes('STORE_SCREENSHOT_BASE_URL') &&
    captureSource.includes('STORE_SCREENSHOT_USERNAME') &&
    captureSource.includes('STORE_SCREENSHOT_PASSWORD') &&
    captureSource.includes('STORE_SCREENSHOT_OUTPUT_DIR') &&
    captureSource.includes('LEGAL_CONSENT_STORAGE_KEY') &&
    captureSource.includes('LEGAL_CONSENT_VERSION') &&
    captureSource.includes('context.addInitScript') &&
    captureSource.includes('localStorage.setItem') &&
    captureSource.includes('cssWidth') &&
    captureSource.includes('cssHeight') &&
    captureSource.includes('outputWidth') &&
    captureSource.includes('outputHeight') &&
    captureSource.includes('deviceScaleFactor') &&
    captureSource.includes('Google Play phone') &&
    captureSource.includes('App Store 6.9 inch') &&
    captureSource.includes('Android domestic phone') &&
    captureSource.includes("page.fill('#username'") &&
    captureSource.includes("page.fill('#password'") &&
    captureSource.includes("path: '/'") &&
    captureSource.includes("path: '/management/assets'") &&
    captureSource.includes("path: '/management/ledger'") &&
    captureSource.includes("path: '/management/budget'") &&
    captureSource.includes("path: '/privacy'") &&
    captureSource.includes('fullPage: false') &&
    captureSource.includes('page.screenshot'),
  'Screenshot capture script should log in when credentials are provided and capture device-sized mobile review screens across phone presets.',
);

const appShellSource = read('src/components/layout/AppShell.tsx');
const sidebarSource = read('src/components/layout/Sidebar.tsx');
const globalCss = read('src/app/globals.css');
assert(
  appShellSource.includes('app-main') &&
    appShellSource.includes('app-main--with-nav') &&
    appShellSource.includes('app-main--public') &&
    sidebarSource.includes('mobile-topbar') &&
    sidebarSource.includes('mobile-bottom-nav') &&
    globalCss.includes('@media (max-width: 767px)') &&
    globalCss.includes('.app-sidebar') &&
    globalCss.includes('.mobile-topbar') &&
    globalCss.includes('.mobile-bottom-nav'),
  'Authenticated pages should expose a mobile app shell so store screenshots render phone navigation instead of the desktop sidebar.',
);

const metadata = read('docs/release/app-store-metadata.md');
assert(
  metadata.includes('npm run screenshots:store') &&
    metadata.includes('store-screenshots/') &&
    metadata.includes('STORE_SCREENSHOT_BASE_URL') &&
    metadata.includes('STORE_SCREENSHOT_USERNAME') &&
    metadata.includes('home-family-safety') &&
    metadata.includes('assets-account-view') &&
    metadata.includes('ledger-source-account') &&
    metadata.includes('budget-expense-source') &&
    metadata.includes('privacy-public-page'),
  'Store metadata guide should document screenshot generation command, env vars, output folder, and required screenshot names.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('npm run screenshots:check') &&
    checklist.includes('npm run screenshots:store') &&
    checklist.includes('store-screenshots/') &&
    checklist.includes('测试账号'),
  'Publishing checklist should include store screenshot readiness and capture steps.',
);

const releaseCheck = read('scripts/check-store-release-readiness.ts');
assert(
  releaseCheck.includes('scripts/check-store-screenshot-readiness.ts') &&
    releaseCheck.includes('scripts/capture-store-screenshots.ts') &&
    releaseCheck.includes('screenshots:check') &&
    releaseCheck.includes('screenshots:store'),
  'Overall store release readiness check should include screenshot asset tooling.',
);
