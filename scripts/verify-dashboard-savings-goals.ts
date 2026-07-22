import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../src/lib/legal-consent';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const username = process.env.MOBILE_QA_USERNAME || 'demo';
const password = process.env.MOBILE_QA_PASSWORD || 'demo123';
const outputPath = resolve(process.cwd(), 'artifacts/design-qa/mobile-dashboard-savings-goals-390x844.png');

async function main() {
  await mkdir(resolve(process.cwd(), 'artifacts/design-qa'), { recursive: true });

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
      localStorage.setItem(storageKey, JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    },
    { storageKey: LEGAL_CONSENT_STORAGE_KEY, version: LEGAL_CONSENT_VERSION },
  );

  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    const consentButton = page.getByRole('button', { name: '同意并继续' });
    if (await consentButton.isVisible()) await consentButton.click();
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && Object.keys(button).some((key) => key.startsWith('__reactProps')));
    });
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 }),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);
    await page.waitForLoadState('networkidle');

    const scissor = page.getByText('收支剪刀图', { exact: true });
    const forecast = page.getByText('现金流预测', { exact: true });
    const savings = page.getByText('储蓄目标', { exact: true });
    await scissor.waitFor();
    await forecast.waitFor();
    await savings.waitFor();

    const [scissorBox, forecastBox, savingsBox] = await Promise.all([
      scissor.boundingBox(),
      forecast.boundingBox(),
      savings.boundingBox(),
    ]);
    if (!scissorBox || !forecastBox || !savingsBox) throw new Error('Dashboard sequence elements are not measurable');
    if (!(scissorBox.y < forecastBox.y && forecastBox.y < savingsBox.y)) {
      throw new Error(`Unexpected dashboard order: ${scissorBox.y}, ${forecastBox.y}, ${savingsBox.y}`);
    }

    const goalCard = savings.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " card ")]').first();
    const goalCardBox = await goalCard.boundingBox();
    if (!goalCardBox || goalCardBox.width < 350) {
      throw new Error(`Savings card is not full width on mobile: ${goalCardBox?.width ?? 'missing'}`);
    }

    const bodyWidth = await page.evaluate(() => ({ scrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth }));
    if (bodyWidth.scrollWidth > bodyWidth.innerWidth) {
      throw new Error(`Horizontal overflow: ${bodyWidth.scrollWidth}px > ${bodyWidth.innerWidth}px`);
    }

    const goalsLink = page.getByRole('link', { name: '查看全部目标' });
    if (await goalsLink.getAttribute('href') !== '/management/goals') {
      throw new Error('View-all goals link does not point to goal management');
    }
    if (await page.getByText(/目标线/).count() > 0) {
      throw new Error('Ordinary goal target-line copy remains in the cashflow card');
    }

    await goalCard.screenshot({ path: outputPath });

    const recurringLink = page.getByRole('link', { name: '管理周期转账' });
    if (await recurringLink.isVisible()) {
      await recurringLink.click();
      await page.waitForURL((url) => url.pathname === '/management/recurring');
      await page.locator('#recurring-form').waitFor();
      await page.getByRole('heading', { name: '周期交易', exact: true }).waitFor();
    }

    if (errors.length > 0) throw new Error(`Browser runtime errors:\n${errors.join('\n')}`);
    console.log(outputPath);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
