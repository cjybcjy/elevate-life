import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/generate-store-submission-package.ts',
  'docs/release/store-submission-package.md',
  'docs/release/app-store-metadata.md',
  'docs/release/privacy-data-safety.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for store submission package readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['store:submission'],
  'npx tsx scripts/generate-store-submission-package.ts',
  'package.json should expose store:submission.',
);
assert.equal(
  packageJson.scripts['store:submission:check'],
  'npx tsx scripts/check-store-submission-package-readiness.ts',
  'package.json should expose store:submission:check.',
);

const gitignore = read('.gitignore');
assert(
  gitignore.includes('/store-submission/'),
  '.gitignore should exclude generated store submission packages from source control.',
);

async function main() {
  const { buildStoreSubmissionPackage } = await import('./generate-store-submission-package');
  const result = buildStoreSubmissionPackage({
    APP_PUBLIC_BASE_URL: 'https://app.elevatelife.example',
    APP_SUPPORT_EMAIL: 'support@elevatelife.example',
    REVIEW_ACCOUNT_USERNAME: 'reviewer',
    REVIEW_ACCOUNT_PASSWORD: 'review-pass',
    STORE_SUBMISSION_OUTPUT_DIR: 'store-submission',
  });

  assert.equal(result.outputDir, 'store-submission');
  assert.deepEqual(
    result.files.map((file: { path: string }) => file.path).sort(),
    [
      'market-copy.md',
      'metadata.json',
      'privacy-data-safety-summary.md',
      'public-urls.md',
      'review-notes.md',
    ],
    'Submission package should include the expected files.',
  );

  const metadataFile = result.files.find((file: { path: string }) => file.path === 'metadata.json');
  assert(metadataFile, 'metadata.json should be generated.');
  const metadata = JSON.parse(metadataFile.content);
  assert.equal(metadata.appName, 'Elevate Life 家庭账本');
  assert.equal(metadata.publicUrls.privacyPolicy, 'https://app.elevatelife.example/privacy');
  assert.equal(metadata.publicUrls.terms, 'https://app.elevatelife.example/terms');
  assert.equal(metadata.publicUrls.support, 'https://app.elevatelife.example/support');
  assert.equal(metadata.publicUrls.accountDeletion, 'https://app.elevatelife.example/account-deletion');
  assert.equal(metadata.reviewAccount.username, 'reviewer');
  assert.equal(metadata.reviewAccount.password, 'review-pass');
  assert.deepEqual(metadata.markets, ['Google Play', 'Android 国内市场', 'iOS App Store']);
  assert(metadata.keywords.includes('家庭账本'));

  const reviewNotes = result.files.find((file: { path: string }) => file.path === 'review-notes.md')?.content || '';
  for (const phrase of [
    'reviewer',
    'review-pass',
    '首页查看家庭财务状态',
    '/privacy',
    '/terms',
    '/account-deletion',
    '不要填真实银行卡号',
  ]) {
    assert(reviewNotes.includes(phrase), `review-notes.md should include ${phrase}.`);
  }

  const publicUrls = result.files.find((file: { path: string }) => file.path === 'public-urls.md')?.content || '';
  for (const path of ['/privacy', '/terms', '/support', '/account-deletion', '/manifest.webmanifest']) {
    assert(publicUrls.includes(`https://app.elevatelife.example${path}`), `public-urls.md should include ${path}.`);
  }

  const privacySummary =
    result.files.find((file: { path: string }) => file.path === 'privacy-data-safety-summary.md')?.content || '';
  for (const phrase of ['账号信息', '财务信息', '用户内容', '诊断数据', '不用于第三方广告', '不出售家庭财务数据']) {
    assert(privacySummary.includes(phrase), `privacy-data-safety-summary.md should include ${phrase}.`);
  }

  const marketCopy = result.files.find((file: { path: string }) => file.path === 'market-copy.md')?.content || '';
  for (const phrase of ['一句话简介', '完整描述', '关键词', 'Google Play', 'Android 国内市场', 'iOS App Store']) {
    assert(marketCopy.includes(phrase), `market-copy.md should include ${phrase}.`);
  }

  const generatorSource = read('scripts/generate-store-submission-package.ts');
  for (const phrase of [
    'STORE_SUBMISSION_OUTPUT_DIR',
    'APP_PUBLIC_BASE_URL',
    'APP_SUPPORT_EMAIL',
    'REVIEW_ACCOUNT_USERNAME',
    'REVIEW_ACCOUNT_PASSWORD',
    'writeFileSync',
    'metadata.json',
    'review-notes.md',
  ]) {
    assert(generatorSource.includes(phrase), `Submission package generator should mention ${phrase}.`);
  }

  const packageGuide = read('docs/release/store-submission-package.md');
  assert(
    packageGuide.includes('npm run store:submission') &&
      packageGuide.includes('store-submission/') &&
      packageGuide.includes('metadata.json') &&
      packageGuide.includes('review-notes.md') &&
      packageGuide.includes('正式提交前') &&
      packageGuide.includes('不要提交到仓库'),
    'Submission package guide should document command usage, output files, and review caveats.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('docs/release/store-submission-package.md') &&
      checklist.includes('npm run store:submission'),
    'Publishing checklist should include store submission package generation.',
  );

  const preflightSource = read('scripts/store-preflight.ts');
  assert(
    preflightSource.includes('Store submission package readiness') &&
      preflightSource.includes('npx tsx scripts/check-store-submission-package-readiness.ts'),
    'Store preflight should include store submission package readiness.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-store-submission-package-readiness.ts') &&
      releaseReadiness.includes('scripts/generate-store-submission-package.ts') &&
      releaseReadiness.includes('store:submission'),
    'Overall store release readiness should include store submission package generation.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
