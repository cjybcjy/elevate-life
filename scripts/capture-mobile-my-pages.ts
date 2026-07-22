import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../src/lib/legal-consent';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const outputDir = process.env.MOBILE_QA_OUTPUT_DIR || 'artifacts/design-qa';
const username = process.env.MOBILE_QA_USERNAME || 'demo';
const password = process.env.MOBILE_QA_PASSWORD || 'demo123';
const testItemName = `QA 测试耳机 ${Date.now()}`;

function absoluteUrl(path: string) {
  return new URL(path, baseUrl).toString();
}

async function main() {
  await mkdir(resolve(process.cwd(), outputDir), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  await context.addInitScript(
    ({ storageKey, version }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
      );
    },
    { storageKey: LEGAL_CONSENT_STORAGE_KEY, version: LEGAL_CONSENT_VERSION },
  );

  const page = await context.newPage();
  const runtimeErrors: string[] = [];
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    if (!failure.includes('ERR_ABORTED')) {
      runtimeErrors.push(`Request failed: ${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  try {
    await page.goto(absoluteUrl('/login'), { waitUntil: 'domcontentloaded' });
    const consentButton = page.getByRole('button', { name: '同意并继续' });
    if (await consentButton.isVisible()) await consentButton.click();

    const submitButton = page.getByRole('button', { name: 'Sign In' });
    await submitButton.waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && Object.keys(button).some((key) => key.startsWith('__reactProps')));
    });
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);

    try {
      await Promise.all([
        page.waitForURL((url) => url.pathname !== '/login', {
          timeout: 30_000,
          waitUntil: 'commit',
        }),
        submitButton.click(),
      ]);
    } catch (error) {
      await page.screenshot({
        path: resolve(process.cwd(), outputDir, 'login-debug-390x844.png'),
        fullPage: false,
      });
      const visibleText = await page.locator('body').innerText();
      throw new Error(
        `Login did not complete at ${page.url()}: ${error instanceof Error ? error.message : error}\n${visibleText}`,
      );
    }

    await page.goto(absoluteUrl('/me'), { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '我的记录' }).waitFor();
    const primaryCount = await page.locator('[data-mobile-primary-nav]').count();
    if (primaryCount !== 5) throw new Error(`Expected 5 primary actions, received ${primaryCount}`);
    await page.locator('[data-mobile-primary-nav="me"][aria-current="page"]').waitFor();
    await page.screenshot({
      path: resolve(process.cwd(), outputDir, 'mobile-my-hub-390x844.png'),
      fullPage: false,
    });

    await page.getByRole('link', { name: /我的物品/ }).click();
    await page.waitForURL((url) => url.pathname === '/possessions');
    await page.getByRole('heading', { name: '我的物品' }).waitFor();
    await page.locator('[data-mobile-primary-nav="me"][aria-current="page"]').waitFor();

    const createHeading = page.getByRole('heading', { name: '添加一件物品' });
    if (!(await createHeading.isVisible())) {
      await page.getByRole('button', { name: '添加' }).click();
      await createHeading.waitFor();
    }

    await page.fill('input[name="name"]', testItemName);
    await page.selectOption('select[name="category"]', 'digital');
    await page.fill('input[name="purchasePrice"]', '1299');
    await page.fill('input[name="purchaseDate"]', '2025-07-13');
    await page.getByRole('button', { name: '保存并计算' }).click();
    await page.getByRole('heading', { name: testItemName }).waitFor({ timeout: 15_000 });
    await page.getByText('真实日均成本').last().waitFor();
    await page.locator('.toast-success').waitFor({ state: 'detached', timeout: 6_000 });
    await page.screenshot({
      path: resolve(process.cwd(), outputDir, 'mobile-possessions-390x844.png'),
      fullPage: false,
    });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `删除${testItemName}` }).click();
    await page.getByRole('heading', { name: testItemName }).waitFor({ state: 'detached', timeout: 15_000 });

    if (runtimeErrors.length > 0) {
      throw new Error(`Browser console errors:\n${runtimeErrors.join('\n')}`);
    }

    console.log(`${outputDir}/mobile-my-hub-390x844.png`);
    console.log(`${outputDir}/mobile-possessions-390x844.png`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
