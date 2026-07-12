import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const username = process.env.MOBILE_QA_USERNAME || '';
const password = process.env.MOBILE_QA_PASSWORD || '';
const outputDir = process.env.MOBILE_QA_OUTPUT_DIR || '/tmp/elevate-life-mobile-qa';

if (!username || !password) {
  throw new Error('Set MOBILE_QA_USERNAME and MOBILE_QA_PASSWORD before running mobile:flow:check.');
}

async function settle(page: Page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 1,
    `horizontal overflow: document=${dimensions.document}, viewport=${dimensions.viewport}`,
  );
}

async function acceptConsent(page: Page) {
  const dialog = page.getByRole('dialog', { name: '请先阅读并同意' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '同意并继续' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

async function login(page: Page) {
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await acceptConsent(page);

  await page.locator('#username').fill('__mobile_invalid__');
  await page.locator('#password').fill('invalid-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByText(/Invalid credentials|登录失败/).waitFor({ state: 'visible' });

  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 15000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

async function assertMobileShell(page: Page) {
  const nav = page.getByRole('navigation', { name: '主要导航' });
  await nav.waitFor({ state: 'visible' });
  assert.equal(await nav.locator('[data-mobile-primary-nav]').count(), 5);
  await page.getByRole('button', { name: '更多功能' }).click();
  const menu = page.getByRole('dialog', { name: '更多功能菜单' });
  await menu.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await assertNoHorizontalOverflow(page);
}

async function removeTransactionIfPresent(page: Page, marker: string) {
  await page.goto(new URL('/management/ledger', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
  if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
    await row.getByRole('button', { name: '删除' }).click();
    await row.waitFor({ state: 'detached' });
  }
}

async function createAndRemoveMobileTransaction(page: Page) {
  const marker = `手机验收-${Date.now()}`;
  try {
    await page.getByRole('link', { name: /记一笔/ }).click();
    await page.waitForURL((url) => url.pathname === '/management/ledger' && url.searchParams.get('focus') === 'create');

    await page.locator('#ledger-agent-input').fill(`今天午饭 32 用现金 ${marker}`);
    await page.getByRole('button', { name: '生成草稿' }).click();

    const form = page.locator('[data-ledger-create-form="true"]');
    await form.waitFor({ state: 'visible' });
    assert.equal(await form.locator('input[name="amount"]').inputValue(), '32');
    assert.match(await form.locator('input[name="description"]').inputValue(), new RegExp(marker));

    await form.getByRole('button', { name: '创建' }).click();
    await page.getByText('已记账').waitFor({ state: 'visible' });

    const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
    await row.waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(outputDir, '360x800-ledger-success.png'), fullPage: false });
  } finally {
    await removeTransactionIfPresent(page, marker);
  }
}

async function screenshotViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  viewport: { name: string; width: number; height: number },
  browserErrors: string[],
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[${viewport.name}] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[${viewport.name}] ${error.message}`));
  await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await assertMobileShell(page);
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}.png`), fullPage: false });
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserErrors: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await login(page);
    await assertMobileShell(page);
    await createAndRemoveMobileTransaction(page);
    const storageState = await context.storageState();
    await context.close();

    for (const viewport of [
      { name: '360x640-short', width: 360, height: 640 },
      { name: '412x839-pixel-7', width: 412, height: 839 },
      { name: '360x520-keyboard-pressure', width: 360, height: 520 },
    ]) {
      await screenshotViewport(browser, storageState, viewport, browserErrors);
    }

    assert.deepEqual(browserErrors, []);
    console.log(`Mobile ledger flow passed. Screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
