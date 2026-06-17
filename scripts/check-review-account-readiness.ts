import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'prisma/seed.ts',
  'docs/release/app-store-metadata.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for review account readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['review:check'],
  'npx tsx scripts/check-review-account-readiness.ts',
  'package.json should expose a review:check readiness command.',
);
assert.equal(
  packageJson.scripts['review:seed'],
  'npx tsx prisma/seed.ts',
  'package.json should expose a review:seed command for the store review/demo account.',
);

const envExample = read('.env.example');
assert(
  envExample.includes('REVIEW_ACCOUNT_USERNAME=demo') &&
    envExample.includes('REVIEW_ACCOUNT_PASSWORD=demo123') &&
    envExample.includes('STORE_SCREENSHOT_USERNAME=demo') &&
    envExample.includes('STORE_SCREENSHOT_PASSWORD=demo123'),
  '.env.example should provide local review account defaults and wire them to screenshot capture defaults.',
);

const seed = read('prisma/seed.ts');
assert(
  seed.includes("import { loadEnvConfig } from '@next/env';") &&
    seed.includes('loadEnvConfig(process.cwd())') &&
    seed.includes("const { prisma } = await import('../src/lib/prisma')") &&
    !seed.includes("import { prisma } from '../src/lib/prisma';"),
  'Seed should load .env before dynamically importing Prisma so review:seed works outside Next CLI.',
);
assert(
  seed.includes("where: { username: REVIEW_ACCOUNT_USERNAME }") &&
    seed.includes("bcrypt.hash(REVIEW_ACCOUNT_PASSWORD") &&
    seed.includes("displayName: 'Store Review 家庭样例'"),
  'Seed should create a stable store review account from REVIEW_ACCOUNT_* constants.',
);
assert(
  seed.includes('prisma.savingsGoal.deleteMany') &&
    seed.includes('prisma.budget.deleteMany') &&
    seed.includes('prisma.recurringRule.deleteMany') &&
    seed.includes('prisma.transaction.deleteMany'),
  'Seed should clean all review-account-owned demo data before reseeding.',
);
assert(
  seed.includes("liquidityTier: 'tier1'") &&
    seed.includes("liquidityTier: 'tier2'") &&
    seed.includes("category: 'current_deposit'") &&
    seed.includes("category: 'cash'") &&
    seed.includes("category: 'stock'") &&
    seed.includes("category: 'gold_physical'"),
  'Seed should create review assets across cash, bank account, stock, gold, and liquidity tiers.',
);
assert(
  seed.includes('prisma.budget.createMany') &&
    seed.includes('currentMonthStart') &&
    seed.includes('currentMonthEnd') &&
    seed.includes("name: '餐饮预算'") &&
    seed.includes("name: '交通预算'") &&
    seed.includes("name: '固定支出预算'"),
  'Seed should create current-month budgets that are visible during review and screenshots.',
);
assert(
  seed.includes('prisma.transaction.createMany') &&
    seed.includes("type: 'INCOME'") &&
    seed.includes("type: 'EXPENSE'") &&
    seed.includes('fromAccountId: assetByName') &&
    seed.includes('toAccountId: assetByName') &&
    seed.includes('budgetId: budgetByName') &&
    seed.includes('liabilityId: liability.id') &&
    seed.includes('fromAccountId: null'),
  'Seed should create income, sourced expenses, budget-linked expenses, debt repayment, transfer, and one intentionally unassigned-source expense.',
);
assert(
  seed.includes('prisma.savingsGoal.create') &&
    seed.includes("name: '家庭应急金'"),
  'Seed should create a store-review savings goal for dashboard coverage.',
);

const metadata = read('docs/release/app-store-metadata.md');
assert(
  metadata.includes('测试账号：`demo`') &&
    metadata.includes('测试密码：`demo123`') &&
    metadata.includes('npm run review:seed') &&
    metadata.includes('STORE_SCREENSHOT_USERNAME=demo') &&
    metadata.includes('STORE_SCREENSHOT_PASSWORD=demo123'),
  'Store metadata draft should include the review account credentials and seed/screenshot commands.',
);

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('npm run review:check') &&
    checklist.includes('npm run review:seed') &&
    checklist.includes('demo/demo123') &&
    checklist.includes('示例资产、预算、负债、流水和资金账户'),
  'Publishing checklist should include review account readiness and seed steps.',
);

const releaseCheck = read('scripts/check-store-release-readiness.ts');
assert(
  releaseCheck.includes('scripts/check-review-account-readiness.ts') &&
    releaseCheck.includes('review:check') &&
    releaseCheck.includes('review:seed'),
  'Overall store release readiness check should include review account readiness.',
);
