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

function collectBrowserDiagnostics(page: Page, label: string, diagnostics: string[]) {
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      diagnostics.push(`[${label}] console.${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => diagnostics.push(`[${label}] pageerror: ${error.message}`));
}

async function assertInsideViewport(page: Page, locator: ReturnType<Page['locator']>, label: string) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label} has no bounding box`);
  const viewport = page.viewportSize();
  assert.ok(viewport, `${label} has no viewport`);
  assert.ok(box.y >= 0, `${label} begins above the viewport: y=${box.y}`);
  assert.ok(
    box.y + box.height <= viewport.height + 1,
    `${label} ends below the viewport: bottom=${box.y + box.height}, viewport=${viewport.height}`,
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
  const moreTrigger = page.getByRole('button', { name: '更多功能' });
  await moreTrigger.click();
  const menu = page.getByRole('dialog', { name: '更多功能菜单' });
  await menu.waitFor({ state: 'visible' });
  assert.equal(await menu.evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await menu.evaluate((element) => element.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await menu.evaluate((element) => element.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await moreTrigger.evaluate((element) => element === document.activeElement), true);
  await assertNoHorizontalOverflow(page);
}

async function removeTransactionIfPresent(page: Page, marker: string) {
  await page.goto(new URL('/management/ledger', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
  if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
    const deletionSettled = page.waitForResponse((response) => (
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/management/ledger'
    ));
    await row.getByRole('button', { name: '删除' }).click();
    await deletionSettled;
    await row.waitFor({ state: 'detached' });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  assert.equal(
    await page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker }).count(),
    0,
    `transaction ${marker} persisted after cleanup`,
  );
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

async function checkShortConsentViewport(
  browser: Browser,
  browserDiagnostics: string[],
) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, '360x640-short', browserDiagnostics);
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  const dialog = page.getByRole('dialog', { name: '请先阅读并同意' });
  await dialog.waitFor({ state: 'visible' });
  const panel = dialog.locator('section');
  await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  const decline = page.getByRole('button', { name: '不同意' });
  const accept = page.getByRole('button', { name: '同意并继续' });
  await decline.scrollIntoViewIfNeeded();
  await accept.scrollIntoViewIfNeeded();
  await assertInsideViewport(page, decline, 'legal decline button');
  await assertInsideViewport(page, accept, 'legal accept button');
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(outputDir, '360x640-short.png'), fullPage: false });
  await context.close();
}

async function screenshotPixelViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  browserDiagnostics: string[],
) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 839 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, '412x839-pixel-7', browserDiagnostics);
  await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await assertMobileShell(page);
  await page.screenshot({ path: resolve(outputDir, '412x839-pixel-7.png'), fullPage: false });
  await context.close();
}

async function checkKeyboardPressureViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  browserDiagnostics: string[],
) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 520 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, '360x520-keyboard-pressure', browserDiagnostics);
  await page.goto(new URL('/management/ledger?focus=create', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  const quickInput = page.locator('#ledger-agent-input');
  await quickInput.focus();
  assert.equal(await quickInput.evaluate((element) => element === document.activeElement), true);
  await quickInput.fill('今天午饭 32 用现金');
  await page.getByRole('button', { name: '生成草稿' }).click();
  const form = page.locator('[data-ledger-create-form="true"]');
  await form.waitFor({ state: 'visible' });
  const submit = form.getByRole('button', { name: '创建' });
  await submit.scrollIntoViewIfNeeded();
  await assertInsideViewport(page, submit, 'ledger create button');
  assert.equal(
    await submit.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === element || element.contains(hit);
    }),
    true,
    'ledger create button is covered in the reduced viewport',
  );
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(outputDir, '360x520-keyboard-pressure.png'), fullPage: false });
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserDiagnostics: string[] = [];
  try {
    await checkShortConsentViewport(browser, browserDiagnostics);
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    collectBrowserDiagnostics(page, '360x800-primary', browserDiagnostics);

    await login(page);
    await assertMobileShell(page);
    await createAndRemoveMobileTransaction(page);
    const storageState = await context.storageState();
    await context.close();

    await screenshotPixelViewport(browser, storageState, browserDiagnostics);
    await checkKeyboardPressureViewport(browser, storageState, browserDiagnostics);

    assert.deepEqual(browserDiagnostics, []);
    console.log(`Mobile ledger flow passed. Screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
