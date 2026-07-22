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
  await settle(page);
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
  assert.equal(await menu.evaluate((element) => element.contains(document.activeElement)), true);
  await page.keyboard.press('Tab');
  assert.equal(await menu.evaluate((element) => element.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await moreTrigger.evaluate((element) => element === document.activeElement), true);
  await assertNoHorizontalOverflow(page);
}

async function openQuickEntry(page: Page) {
  if (new URL(page.url()).pathname === '/') {
    await page.getByRole('link', { name: /记一笔/ }).click();
    await page.waitForURL((url) => (
      url.pathname === '/management/ledger' && url.searchParams.get('focus') === 'create'
    ));
  } else {
    await page.goto(new URL('/management/ledger?focus=create', baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
  }
  await settle(page);
  const quick = page.locator('[data-mobile-quick-entry="true"]');
  await quick.waitFor({ state: 'visible' });
  await waitForTransactionsReady(page);
  return quick;
}

async function waitForTransactionsReady(page: Page) {
  const list = page.locator(
    '[data-transaction-list="true"][data-transactions-ready="true"]',
  );
  await list.waitFor({ state: 'attached' });
  return list;
}

function markerRows(page: Page, marker: string) {
  return page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
}

async function readAccountBalance(context: BrowserContext, accountName: string) {
  const page = await context.newPage();
  try {
    await page.goto(new URL('/management/assets', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await settle(page);
    const account = page.getByRole('button').filter({ hasText: accountName }).first();
    await account.waitFor({ state: 'visible' });
    const amountText = await account.locator('.font-mono').first().innerText();
    const balance = Number(amountText.replace(/[^\d.-]/g, ''));
    assert.equal(Number.isFinite(balance), true, `could not parse ${accountName} balance: ${amountText}`);
    return balance;
  } finally {
    await page.close();
  }
}

async function waitForMarkerRowCount(page: Page, marker: string, expected: number) {
  await page.waitForFunction(({ rowMarker, expectedCount }) => (
    Array.from(document.querySelectorAll('[data-transaction-list="true"] tbody tr'))
      .filter((row) => row.textContent?.includes(rowMarker)).length === expectedCount
  ), { rowMarker: marker, expectedCount: expected });
}

async function assertPersistedTransaction(page: Page, marker: string, phase: string) {
  await waitForTransactionsReady(page);
  const rows = markerRows(page, marker);
  assert.equal(await rows.count(), 1, `${phase}: expected exactly one transaction ${marker}`);
  const cells = rows.first().locator('td');
  assert.match(
    (await cells.nth(1).innerText()).trim(),
    /^¥32(?:\.0+)?$/,
    `${phase}: persisted amount is not exactly ¥32`,
  );
  assert.equal((await cells.nth(2).innerText()).trim(), '餐饮', `${phase}: persisted category mismatch`);
  assert.equal((await cells.nth(3).innerText()).trim(), '餐饮预算', `${phase}: persisted budget mismatch`);
  assert.equal((await cells.nth(7).innerText()).trim(), marker, `${phase}: persisted note mismatch`);
  console.log(`${phase} fields verified: amount=¥32 category=餐饮 budget=餐饮预算 note=${marker}`);
}

async function assertIndependentRecurringAndQuickEntryFlow(page: Page) {
  await page.goto(new URL('/management/ledger', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await waitForTransactionsReady(page);
  await expectHidden(page.locator('[data-mobile-quick-entry="true"]'), 'ordinary mobile quick entry');
  await expectHidden(page.locator('[data-ledger-create-form="true"]'), 'ordinary mobile full create form');
  assert.equal(await page.locator('[data-transaction-list="true"]').isVisible(), true);

  assert.equal(await page.getByRole('button', { name: '周期交易' }).count(), 0);
  await page.getByRole('button', { name: '更多功能' }).click();
  await page.getByRole('dialog', { name: '更多功能菜单' })
    .getByRole('link', { name: '周期交易', exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === '/management/recurring');
  await page.locator('#recurring-form').waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: '周期交易', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('link', { name: /记一笔/ }).click();
  await page.waitForURL((url) => (
    url.pathname === '/management/ledger' && url.searchParams.get('focus') === 'create'
  ));
  await page.locator('[data-mobile-quick-entry="true"]').waitFor({ state: 'visible' });
  console.log('Independent flow verified: ordinary ledger -> More/周期交易 -> standalone page -> bottom 记一笔');
}

async function assertOptionsSheetFocusLoop(page: Page, quick: ReturnType<Page['locator']>) {
  const trigger = quick.getByRole('button', { name: '更多选项' });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: '更多记账选项' });
  await sheet.waitFor({ state: 'visible' });
  assert.equal(
    await sheet.evaluate((element) => element === document.activeElement),
    true,
    'options sheet panel did not receive focus',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await sheet.evaluate((element) => element.contains(document.activeElement)),
    true,
    'Tab escaped the options sheet',
  );
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await sheet.evaluate((element) => element.contains(document.activeElement)),
    true,
    'Shift+Tab escaped the options sheet',
  );
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'hidden' });
  assert.equal(
    await trigger.evaluate((element) => element === document.activeElement),
    true,
    'options sheet did not restore focus to its trigger',
  );
}

async function assertTypeSpecificOptionalFields(page: Page, quick: ReturnType<Page['locator']>) {
  await quick.getByRole('button', { name: '收入', exact: true }).click();
  await quick.locator('button[aria-label^="更多选项："]').click();
  let sheet = page.getByRole('dialog', { name: '更多记账选项' });
  await sheet.waitFor({ state: 'visible' });
  assert.equal(await sheet.getByLabel('收款账户（选填）').count(), 1);
  assert.equal(await sheet.getByLabel('付款账户（选填）').count(), 0);
  assert.equal(await sheet.getByLabel('预算（选填）').count(), 0);
  await sheet.getByRole('button', { name: '完成', exact: true }).click();

  await quick.getByRole('button', { name: '转账', exact: true }).click();
  sheet = page.getByRole('dialog', { name: '选择转账账户' });
  await sheet.waitFor({ state: 'visible' });
  assert.equal(await sheet.getByLabel('转出账户').count(), 1);
  assert.equal(await sheet.getByLabel('转入账户').count(), 1);
  assert.equal(await sheet.getByLabel('预算（选填）').count(), 0);
  await sheet.getByRole('button', { name: '完成', exact: true }).click();

  await quick.getByRole('button', { name: '支出', exact: true }).click();
  await quick.locator('button[aria-label^="更多选项："]').click();
  sheet = page.getByRole('dialog', { name: '更多记账选项' });
  await sheet.waitFor({ state: 'visible' });
  assert.equal(await sheet.getByLabel('付款账户（选填）').count(), 1);
  assert.equal(await sheet.getByLabel('收款账户（选填）').count(), 0);
  assert.equal(await sheet.getByLabel('预算（选填）').count(), 1);
  await sheet.getByRole('button', { name: '完成', exact: true }).click();
  await sheet.waitFor({ state: 'hidden' });
}

async function removeTransactionIfPresent(page: Page, marker: string, requireUnique = true) {
  await page.goto(new URL('/management/ledger', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  if (await page.locator('[data-transaction-list="true"]').count() === 0) {
    await page.getByRole('button', { name: '流水记录' }).click();
  }
  await waitForTransactionsReady(page);
  const rows = markerRows(page, marker);
  const initialCount = await rows.count();
  const uniquenessError = requireUnique && initialCount > 1
    ? new Error(`cleanup found ${initialCount} transactions for unique marker ${marker}`)
    : null;
  const deletionErrors: Error[] = [];

  let attempts = 0;
  const maxAttempts = Math.max(initialCount * 2, 1);
  while (await markerRows(page, marker).count() > 0 && attempts < maxAttempts) {
    attempts += 1;
    const beforeCount = await markerRows(page, marker).count();
    const row = markerRows(page, marker).first();
    try {
      const transactionId = await row.locator('input[name="id"]').inputValue();
      const deletionSettled = page.waitForResponse((response) => (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/management/ledger' &&
        response.request().postData()?.includes(transactionId) === true
      ));
      await row.getByRole('button', { name: '删除' }).click();
      await deletionSettled;
      await waitForMarkerRowCount(page, marker, beforeCount - 1);
    } catch (error) {
      deletionErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  await waitForTransactionsReady(page);
  assert.equal(
    await markerRows(page, marker).count(),
    0,
    `transaction ${marker} persisted after cleanup`,
  );
  console.log(`Cleanup verified after reload: ${marker}`);
  if (deletionErrors.length > 0) throw deletionErrors[0];
  if (uniquenessError) throw uniquenessError;
}

async function createAndRemoveMobileTransaction(page: Page) {
  const marker = `手机极速记账-${Date.now()}`;
  const cashBalanceBefore = await readAccountBalance(page.context(), '现金备用金');
  try {
    let quick = await openQuickEntry(page);

    await quick.getByRole('button', { name: '收入', exact: true }).click();
    assert.equal(await quick.locator('[data-quick-category="人情往来"]').count(), 1);
    await quick.getByRole('button', { name: '支出', exact: true }).click();
    await quick.getByRole('button', { name: '说一句', exact: true }).click();
    await quick.locator('#ledger-agent-input').fill('今天午饭 32 用现金');
    await quick.getByRole('button', { name: '识别并填入' }).click();
    assert.match(await quick.getByLabel('金额', { exact: true }).textContent() ?? '', /32/);
    await quick.getByRole('button', { name: '更多选项' }).click();
    const agentSheet = page.getByRole('dialog', { name: '更多记账选项' });
    assert.equal((await agentSheet.getByLabel('付款账户（选填）').locator('option:checked').innerText()).trim(), '现金备用金');
    await agentSheet.getByRole('button', { name: '完成' }).click();
    await agentSheet.waitFor({ state: 'hidden' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    quick = page.locator('[data-mobile-quick-entry="true"]');
    await quick.waitFor({ state: 'visible' });
    await waitForTransactionsReady(page);
    assert.equal(
      (await quick.getByLabel('金额', { exact: true }).textContent() ?? '').trim(),
      '¥0',
    );

    await quick.locator('[data-quick-category="餐饮"]').click();
    await assertOptionsSheetFocusLoop(page, quick);
    await assertTypeSpecificOptionalFields(page, quick);
    await quick.locator('[data-quick-category="餐饮"]').click();
    const trigger = quick.getByRole('button', { name: '更多选项' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: '更多记账选项' });
    await sheet.getByLabel('付款账户（选填）').selectOption({ label: '现金备用金' });
    await sheet.getByLabel('备注（选填）').fill(marker);
    await sheet.getByRole('button', { name: '完成' }).click();
    await sheet.waitFor({ state: 'hidden' });

    await quick.locator('[data-amount-key="3"]').click();
    await quick.locator('[data-amount-key="2"]').click();
    const createSettled = page.waitForResponse((response) => (
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/management/ledger' &&
      response.request().postData()?.includes(marker) === true
    ));
    await quick.locator('[data-amount-complete="true"]').click();
    await createSettled;
    await quick.getByText(/已记 ¥32(?:\.00)? · 餐饮预算还剩/).waitFor({ state: 'visible' });
    await quick.getByRole('button', { name: '撤销', exact: true }).waitFor({ state: 'visible' });
    await quick.getByRole('button', { name: '再记一笔', exact: true }).waitFor({ state: 'visible' });

    await assertPersistedTransaction(page, marker, 'Initial persisted row');
    const cashBalanceAfterCreate = await readAccountBalance(page.context(), '现金备用金');
    assert.equal(cashBalanceAfterCreate, cashBalanceBefore - 32, 'expense did not deduct the source account');
    await page.screenshot({
      path: resolve(outputDir, '360x800-category-first-success.png'),
      fullPage: false,
    });
    console.log(`Transaction created and visible: ${marker}`);

    await quick.getByRole('button', { name: '撤销', exact: true }).click();
    await quick.getByText('已撤销上一笔记账', { exact: true }).waitFor({ state: 'visible' });
    await waitForMarkerRowCount(page, marker, 0);
    const cashBalanceAfterUndo = await readAccountBalance(page.context(), '现金备用金');
    assert.equal(cashBalanceAfterUndo, cashBalanceBefore, 'undo did not restore the source account balance');
    await page.screenshot({
      path: resolve(outputDir, '360x800-undo-success.png'),
      fullPage: false,
    });
    await quick.getByRole('button', { name: '再记一笔', exact: true }).click();
    await expectHidden(quick.getByText('已撤销上一笔记账', { exact: true }), 'undo feedback after 再记一笔');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await waitForTransactionsReady(page);
    assert.equal(await markerRows(page, marker).count(), 0, 'undone transaction returned after reload');
    console.log(`Real undo verified after reload: ${marker}`);
  } finally {
    await removeTransactionIfPresent(page, marker);
  }
}

async function screenshotQuickEntryViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  browserDiagnostics: string[],
  width: number,
  height: number,
) {
  const label = `${width}x${height}`;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, `${label}-category-first`, browserDiagnostics);
  const quick = await openQuickEntry(page);
  const ledgerHeader = page.getByRole('heading', { name: '流水管理' }).locator('..');
  assert.equal(await ledgerHeader.isVisible(), false, `${label} legacy ledger header is visible`);
  assert.equal(await page.getByRole('button', { name: '流水记录' }).isVisible(), false);
  assert.equal(await page.getByRole('button', { name: '周期交易' }).isVisible(), false);
  assert.equal(
    await quick.getByRole('button', { name: '支出', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await quick.getByRole('button', { name: '说一句', exact: true }).waitFor({ state: 'visible' });
  await quick.getByText('只需选择分类、输入金额；账户、日期和预算会自动处理。', { exact: true })
    .waitFor({ state: 'visible' });
  assert.equal(await quick.getByRole('group', { name: '交易类型' }).getByRole('button').count(), 3);
  assert.equal(await quick.locator('[aria-label="金额键盘"] > button').count(), 16);
  assert.equal(await quick.locator('[data-amount-complete="true"]').count(), 1);
  await quick.locator('button[aria-label^="更多选项：今天，"]').waitFor({ state: 'visible' });
  assert.equal(await quick.getByLabel('日期').count(), 0, `${label} date field leaked onto the main screen`);
  assert.equal(await quick.getByLabel('付款账户（选填）').count(), 0, `${label} account field leaked onto the main screen`);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(outputDir, `${label}-category-first.png`),
    fullPage: false,
  });
  await context.close();
}

async function checkRecurringDiscoveryViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  browserDiagnostics: string[],
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, '390x844-recurring-discovery', browserDiagnostics);

  await page.goto(new URL('/me', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  assert.equal(new URL(page.url()).pathname, '/me');
  assert.match(await page.title(), /家庭账本/);
  assert.doesNotMatch(await page.locator('body').innerText(), /Runtime Error|Application error/);
  const recurringLink = page.getByRole('link', { name: /周期交易.*管理房租、工资和定期转账的自动记账/ });
  await recurringLink.waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(outputDir, '390x844-me-recurring-entry.png'),
    fullPage: false,
  });

  await recurringLink.click();
  await page.waitForURL((url) => url.pathname === '/management/recurring');
  assert.match(await page.title(), /家庭账本/);
  assert.doesNotMatch(await page.locator('body').innerText(), /Runtime Error|Application error/);
  await page.getByRole('heading', { name: '周期交易', exact: true }).waitFor({ state: 'visible' });
  await page.locator('#recurring-form').waitFor({ state: 'visible' });
  await page.getByRole('link', { name: '查看流水', exact: true }).waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(outputDir, '390x844-recurring-standalone.png'),
    fullPage: false,
  });
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
  const quick = await openQuickEntry(page);
  await quick.locator('[data-amount-key="3"]').click();
  await quick.locator('[data-amount-key="2"]').click();
  const submit = quick.locator('[data-amount-complete="true"]');
  await submit.scrollIntoViewIfNeeded();
  await assertInsideViewport(page, submit, 'quick-entry confirm button');
  assert.equal(
    await submit.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === element || element.contains(hit);
    }),
    true,
    'quick-entry confirm button is covered in the reduced viewport',
  );
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(outputDir, '360x520-keyboard-pressure.png'),
    fullPage: false,
  });
  await context.close();
}

async function checkDesktopViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  browserDiagnostics: string[],
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  collectBrowserDiagnostics(page, '1440x900-desktop', browserDiagnostics);
  await page.goto(new URL('/management/ledger?focus=create', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
  });
  await settle(page);
  await expectHidden(page.locator('[data-mobile-quick-entry="true"]'), 'desktop mobile quick entry');
  const form = page.locator('[data-ledger-create-form="true"]');
  await form.waitFor({ state: 'visible' });
  await assertInsideViewport(page, form, 'desktop ledger create form');
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(outputDir, '1440x900-ledger-create-form.png'),
    fullPage: false,
  });

  assert.equal(await page.getByRole('button', { name: '周期交易' }).count(), 0);
  await page.getByRole('link', { name: /周期交易/ }).click();
  await page.waitForURL((url) => url.pathname === '/management/recurring');
  await page.locator('#recurring-form').waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: '周期交易', exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: resolve(outputDir, '1440x900-recurring-standalone.png'),
    fullPage: false,
  });

  await page.goto(new URL('/management/ledger?tab=recurring', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL((url) => url.pathname === '/management/recurring');
  console.log('Desktop standalone route and legacy recurring deep-link redirect verified');
  await context.close();
}

async function expectHidden(locator: ReturnType<Page['locator']>, label: string) {
  assert.equal(await locator.isVisible(), false, `${label} is visible`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserDiagnostics: string[] = [];
  try {
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
    const storageState = await context.storageState();
    await context.close();

    for (const [width, height] of [[360, 640], [360, 800], [390, 844], [412, 839]]) {
      await screenshotQuickEntryViewport(
        browser,
        storageState,
        browserDiagnostics,
        width,
        height,
      );
    }
    await checkRecurringDiscoveryViewport(browser, storageState, browserDiagnostics);
    await checkKeyboardPressureViewport(browser, storageState, browserDiagnostics);
    await checkDesktopViewport(browser, storageState, browserDiagnostics);

    const writeContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
      storageState,
    });
    const writePage = await writeContext.newPage();
    collectBrowserDiagnostics(writePage, '360x800-persisted-flow', browserDiagnostics);
    await writePage.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await settle(writePage);
    await removeTransactionIfPresent(writePage, '手机极速记账-', false);
    await assertIndependentRecurringAndQuickEntryFlow(writePage);
    await createAndRemoveMobileTransaction(writePage);
    await writeContext.close();

    assert.deepEqual(browserDiagnostics, []);
    console.log(`Mobile ledger flow passed. Screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
