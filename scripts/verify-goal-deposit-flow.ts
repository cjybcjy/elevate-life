import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { chromium } from 'playwright';
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../src/lib/legal-consent';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const username = process.env.MOBILE_QA_USERNAME || 'demo';
const password = process.env.MOBILE_QA_PASSWORD || 'demo123';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ledger?schema=public';
const outputDir = resolve(process.cwd(), 'artifacts/design-qa');
const sourceMode = process.env.GOAL_DEPOSIT_SOURCE_MODE === 'account' ? 'account' : 'none';
const formScreenshot = resolve(outputDir, `mobile-goal-deposit-${sourceMode}-form-390x844.png`);
const successScreenshot = resolve(outputDir, `mobile-goal-deposit-${sourceMode}-success-390x844.png`);
const desktopFormScreenshot = resolve(outputDir, `desktop-goal-deposit-${sourceMode}-form-1440x1000.png`);

type GoalSnapshot = {
  id: string;
  name: string;
  assetId: string;
  currentAmount: string;
  updatedAt: Date;
};

type AssetSnapshot = {
  id: string;
  balance: string;
  updatedAt: Date;
};

async function main() {
  await mkdir(outputDir, { recursive: true });
  const pool = new Pool({ connectionString: databaseUrl });
  const browser = await chromium.launch({ headless: true });
  let goalSnapshot: GoalSnapshot | null = null;
  let sourceSnapshot: AssetSnapshot | null = null;
  let targetSnapshot: AssetSnapshot | null = null;
  let createdTransactionId: string | null = null;
  let existingGoalTransactionIds: string[] = [];
  let userId = '';

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
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  try {
    const userResult = await pool.query<{ id: string }>(
      'SELECT id FROM "User" WHERE username = $1',
      [username],
    );
    assert.equal(userResult.rowCount, 1, `Expected one user named ${username}`);
    userId = userResult.rows[0].id;

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

    const savingsCard = page.locator('[aria-label="储蓄目标"]');
    await savingsCard.scrollIntoViewIfNeeded();
    const primaryGoal = savingsCard.locator('section[data-goal-id]').first();
    const goalId = await primaryGoal.getAttribute('data-goal-id');
    assert(goalId, 'Primary goal should expose its id for verification');

    const goalResult = await pool.query<{
      id: string;
      name: string;
      assetId: string | null;
      currentAmount: string;
      updatedAt: Date;
    }>(
      'SELECT id, name, asset_id AS "assetId", current_amount::text AS "currentAmount", updated_at AS "updatedAt" FROM "SavingsGoal" WHERE id = $1 AND user_id = $2',
      [goalId, userId],
    );
    assert.equal(goalResult.rowCount, 1, 'Primary goal should exist for the demo user');
    assert(goalResult.rows[0].assetId, 'Primary goal should have a linked target asset');
    goalSnapshot = goalResult.rows[0] as GoalSnapshot;
    const targetAssetId = goalSnapshot.assetId;
    const existingTransactions = await pool.query<{ id: string }>(
      'SELECT id FROM "Transaction" WHERE user_id = $1 AND description = $2',
      [userId, `存入储蓄目标 · ${goalSnapshot.name}`],
    );
    existingGoalTransactionIds = existingTransactions.rows.map((transaction) => transaction.id);

    await primaryGoal.getByRole('button', { name: '+ 存一笔' }).click();
    const depositForm = primaryGoal.locator('form[id^="goal-deposit-"]');
    await depositForm.waitFor();

    const sourceSelect = depositForm.locator('select');
    assert.equal(await sourceSelect.count(), 1, 'Deposit form should expose one optional source selector');
    assert.equal(
      (await sourceSelect.locator('option[value=""]').textContent())?.trim(),
      '不填（不扣减其他账户）',
      'Deposit form should include a clear no-source option',
    );
    const sourceAssetId = sourceMode === 'account'
      ? await sourceSelect.locator('option:not([value=""])').first().getAttribute('value')
      : null;
    if (sourceMode === 'account') assert(sourceAssetId, 'Account mode should have a usable source account');
    await sourceSelect.selectOption(sourceAssetId || '');
    assert.equal(await sourceSelect.inputValue(), sourceAssetId || '');

    const assetResult = await pool.query<AssetSnapshot>(
      'SELECT id, balance, updated_at AS "updatedAt" FROM "Asset" WHERE user_id = $1',
      [userId],
    );
    sourceSnapshot = sourceAssetId
      ? assetResult.rows.find((asset) => asset.id === sourceAssetId) || null
      : null;
    targetSnapshot = assetResult.rows.find((asset) => asset.id === targetAssetId) || null;
    if (sourceAssetId) assert(sourceSnapshot, 'Source asset snapshot should exist');
    assert(targetSnapshot, 'Target asset snapshot should exist');

    await depositForm.screenshot({ path: formScreenshot });
    const quickAmount = depositForm.getByRole('button', { name: '+¥500' });
    if (await quickAmount.count()) {
      await quickAmount.click();
    } else {
      await depositForm.getByLabel(`存入${goalSnapshot.name}的金额`).fill('1');
    }
    const amount = Number(await depositForm.getByLabel(`存入${goalSnapshot.name}的金额`).inputValue());
    assert(amount > 0, 'A positive deposit amount should be selected');

    await depositForm.getByRole('button', { name: '确认存入' }).click();
    await savingsCard.getByRole('status').waitFor();
    await page.waitForFunction(
      ({ selector, expected }) => Number(document.querySelector(selector)?.getAttribute('data-goal-current')) === expected,
      {
        selector: `section[data-goal-id="${goalId}"]`,
        expected: Number(goalSnapshot.currentAmount) + amount,
      },
    );

    const transactionResult = await pool.query<{
      id: string;
      type: string;
      amount: string;
      fromAccountId: string | null;
      toAccountId: string | null;
    }>(
      'SELECT id, type, amount::text, from_account_id AS "fromAccountId", to_account_id AS "toAccountId" FROM "Transaction" WHERE user_id = $1 AND description = $2 AND NOT (id = ANY($3::text[])) ORDER BY created_at DESC LIMIT 1',
      [userId, `存入储蓄目标 · ${goalSnapshot.name}`, existingGoalTransactionIds],
    );
    assert.equal(transactionResult.rowCount, 1, 'A goal-deposit transfer should be recorded');
    const transaction = transactionResult.rows[0];
    createdTransactionId = transaction.id;
    assert.equal(transaction.type, 'TRANSFER');
    assert.equal(Number(transaction.amount), amount);
    assert.equal(transaction.fromAccountId, sourceAssetId);
    assert.equal(transaction.toAccountId, targetAssetId);

    const changedAssets = await pool.query<{ id: string; balance: string }>(
      'SELECT id, balance FROM "Asset" WHERE user_id = $1',
      [userId],
    );
    if (sourceAssetId && sourceSnapshot) {
      assert.notEqual(
        changedAssets.rows.find((asset) => asset.id === sourceAssetId)?.balance,
        sourceSnapshot.balance,
        'Source balance ciphertext should change after deposit',
      );
    }
    assert.notEqual(
      changedAssets.rows.find((asset) => asset.id === targetAssetId)?.balance,
      targetSnapshot.balance,
      'Target balance ciphertext should change after deposit',
    );
    for (const snapshot of assetResult.rows) {
      if (snapshot.id === targetAssetId || snapshot.id === sourceAssetId) continue;
      assert.equal(
        changedAssets.rows.find((asset) => asset.id === snapshot.id)?.balance,
        snapshot.balance,
        `Unselected asset ${snapshot.id} should not change`,
      );
    }

    const changedGoal = await pool.query<{ currentAmount: string }>(
      'SELECT current_amount::text AS "currentAmount" FROM "SavingsGoal" WHERE id = $1',
      [goalId],
    );
    assert.equal(Number(changedGoal.rows[0].currentAmount), Number(goalSnapshot.currentAmount) + amount);
    await savingsCard.screenshot({ path: successScreenshot });

    await page.goto(`${baseUrl}/management/ledger`, { waitUntil: 'networkidle' });
    await page.getByText(`存入储蓄目标 · ${goalSnapshot.name}`, { exact: true }).first().waitFor();

    const bodyWidth = await page.evaluate(() => ({ scrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth }));
    assert(bodyWidth.scrollWidth <= bodyWidth.innerWidth, `Horizontal overflow: ${bodyWidth.scrollWidth}px > ${bodyWidth.innerWidth}px`);

    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
    });
    try {
      await desktopContext.addInitScript(
        ({ storageKey, version }) => {
          localStorage.setItem(storageKey, JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
        },
        { storageKey: LEGAL_CONSENT_STORAGE_KEY, version: LEGAL_CONSENT_VERSION },
      );
      const desktopPage = await desktopContext.newPage();
      desktopPage.on('pageerror', (error) => runtimeErrors.push(error.message));
      desktopPage.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      await desktopPage.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
      const desktopConsentButton = desktopPage.getByRole('button', { name: '同意并继续' });
      if (await desktopConsentButton.isVisible()) await desktopConsentButton.click();
      await desktopPage.waitForFunction(() => {
        const button = document.querySelector('button[type="submit"]');
        return Boolean(button && Object.keys(button).some((key) => key.startsWith('__reactProps')));
      });
      await desktopPage.locator('#username').fill(username);
      await desktopPage.locator('#password').fill(password);
      await Promise.all([
        desktopPage.waitForURL((url) => url.pathname === '/', { timeout: 30_000 }),
        desktopPage.getByRole('button', { name: 'Sign In' }).click(),
      ]);
      await desktopPage.waitForLoadState('networkidle');
      const desktopSavingsCard = desktopPage.locator('[aria-label="储蓄目标"]');
      await desktopSavingsCard.scrollIntoViewIfNeeded();
      await desktopSavingsCard.locator('section[data-goal-id]').first().getByRole('button', { name: '+ 存一笔' }).click();
      await desktopSavingsCard.locator('form[id^="goal-deposit-"]').waitFor();
      await desktopSavingsCard.screenshot({ path: desktopFormScreenshot });
      const desktopWidth = await desktopPage.evaluate(() => ({ scrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth }));
      assert(desktopWidth.scrollWidth <= desktopWidth.innerWidth, `Desktop horizontal overflow: ${desktopWidth.scrollWidth}px > ${desktopWidth.innerWidth}px`);
    } finally {
      await desktopContext.close();
    }

    assert.deepEqual(runtimeErrors, [], `Browser runtime errors:\n${runtimeErrors.join('\n')}`);

    console.log(formScreenshot);
    console.log(successScreenshot);
    console.log(desktopFormScreenshot);
    console.log(`verified ${sourceMode} transaction ${createdTransactionId}`);
  } finally {
    if (userId && goalSnapshot && targetSnapshot) {
      if (!createdTransactionId) {
        const fallbackTransaction = await pool.query<{ id: string }>(
          'SELECT id FROM "Transaction" WHERE user_id = $1 AND description = $2 AND NOT (id = ANY($3::text[])) ORDER BY created_at DESC LIMIT 1',
          [userId, `存入储蓄目标 · ${goalSnapshot.name}`, existingGoalTransactionIds],
        );
        createdTransactionId = fallbackTransaction.rows[0]?.id || null;
      }

      await pool.query('BEGIN');
      try {
        if (sourceSnapshot) {
          await pool.query(
            'UPDATE "Asset" SET balance = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
            [sourceSnapshot.balance, sourceSnapshot.updatedAt, sourceSnapshot.id, userId],
          );
        }
        await pool.query(
          'UPDATE "Asset" SET balance = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
          [targetSnapshot.balance, targetSnapshot.updatedAt, targetSnapshot.id, userId],
        );
        await pool.query(
          'UPDATE "SavingsGoal" SET current_amount = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
          [goalSnapshot.currentAmount, goalSnapshot.updatedAt, goalSnapshot.id, userId],
        );
        if (createdTransactionId) {
          await pool.query(
            'DELETE FROM "Transaction" WHERE id = $1 AND user_id = $2',
            [createdTransactionId, userId],
          );
        }
        await pool.query('COMMIT');
        if (createdTransactionId) {
          const cleanupCheck = await pool.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM "Transaction" WHERE id = $1',
            [createdTransactionId],
          );
          assert.equal(cleanupCheck.rows[0].count, 0, 'QA transaction should be removed during cleanup');
        }
        const restoredGoal = await pool.query<{ currentAmount: string }>(
          'SELECT current_amount::text AS "currentAmount" FROM "SavingsGoal" WHERE id = $1',
          [goalSnapshot.id],
        );
        assert.equal(restoredGoal.rows[0].currentAmount, goalSnapshot.currentAmount, 'Goal progress should be restored after QA');
        console.log('cleanup complete');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    await context.close();
    await browser.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
