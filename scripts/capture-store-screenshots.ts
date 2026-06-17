import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices, type Page } from 'playwright';
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../src/lib/legal-consent';

const baseUrl = process.env.STORE_SCREENSHOT_BASE_URL || 'http://localhost:3000';
const outputDir = process.env.STORE_SCREENSHOT_OUTPUT_DIR || 'store-screenshots';
const username = process.env.STORE_SCREENSHOT_USERNAME || '';
const password = process.env.STORE_SCREENSHOT_PASSWORD || '';

const mobileDevice = devices['Pixel 7'] ?? devices['iPhone 15 Pro Max'];

const presets = [
  { name: 'Google Play phone', slug: 'google-play-phone', cssWidth: 360, cssHeight: 640, outputWidth: 1080, outputHeight: 1920 },
  { name: 'Android domestic phone', slug: 'android-domestic-phone', cssWidth: 360, cssHeight: 800, outputWidth: 1080, outputHeight: 2400 },
  { name: 'App Store 6.9 inch', slug: 'app-store-6-9-inch', cssWidth: 430, cssHeight: 932, outputWidth: 1290, outputHeight: 2796 },
] as const;

const screens = [
  { name: 'Home family safety', slug: 'home-family-safety', path: '/', requiresAuth: true },
  { name: 'Assets account view', slug: 'assets-account-view', path: '/management/assets', requiresAuth: true },
  { name: 'Ledger source account', slug: 'ledger-source-account', path: '/management/ledger', requiresAuth: true },
  { name: 'Budget expense source', slug: 'budget-expense-source', path: '/management/budget', requiresAuth: true },
  { name: 'Privacy public page', slug: 'privacy-public-page', path: '/privacy', requiresAuth: false },
] as const;

function absoluteUrl(path: string) {
  return new URL(path, baseUrl).toString();
}

async function settle(page: Page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function login(page: Page) {
  if (!username || !password) {
    throw new Error(
      'Set STORE_SCREENSHOT_USERNAME and STORE_SCREENSHOT_PASSWORD before capturing protected store screenshots.',
    );
  }

  await page.goto(absoluteUrl('/login'), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.locator('#username').waitFor({ state: 'visible' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => new URL(url).pathname !== '/login', { timeout: 15000 }).catch(() => undefined),
    page.click('button[type="submit"]'),
  ]);
  await settle(page);

  if (new URL(page.url()).pathname === '/login') {
    throw new Error('Store screenshot login failed. Check STORE_SCREENSHOT_USERNAME and STORE_SCREENSHOT_PASSWORD.');
  }
}

async function main() {
  await mkdir(resolve(process.cwd(), outputDir), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const preset of presets) {
      const context = await browser.newContext({
        viewport: { width: preset.cssWidth, height: preset.cssHeight },
        deviceScaleFactor: preset.outputWidth / preset.cssWidth,
        isMobile: true,
        hasTouch: true,
        locale: 'zh-CN',
        userAgent: mobileDevice?.userAgent,
      });
      await context.addInitScript(
        ({ storageKey, version }) => {
          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
            );
          } catch {
            // Some browser internals may not expose localStorage; app pages will.
          }
        },
        { storageKey: LEGAL_CONSENT_STORAGE_KEY, version: LEGAL_CONSENT_VERSION },
      );

      const page = await context.newPage();
      if (screens.some((screen) => screen.requiresAuth)) {
        await login(page);
      }

      for (const screen of screens) {
        await page.goto(absoluteUrl(screen.path), { waitUntil: 'domcontentloaded' });
        await settle(page);
        const filename = `${preset.slug}-${screen.slug}.png`;
        await page.screenshot({
          path: resolve(process.cwd(), outputDir, filename),
          fullPage: false,
        });
        console.log(`${preset.name}: ${screen.name} -> ${outputDir}/${filename}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
