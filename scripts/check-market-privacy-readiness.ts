import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function readJson(path: string) {
  return JSON.parse(read(path));
}

const privacyMatrixPath = 'docs/release/privacy-data-safety.md';
assert(
  existsSync(resolve(process.cwd(), privacyMatrixPath)),
  `${privacyMatrixPath} should exist as the source of truth for store privacy declarations.`,
);

const packageJson = readJson('package.json');
assert.equal(
  packageJson.scripts?.['privacy:check'],
  'npx tsx scripts/check-market-privacy-readiness.ts',
  'package.json should expose privacy:check for release verification.',
);

const privacyMatrix = read(privacyMatrixPath);
for (const phrase of [
  'Google Play Data safety',
  'App Store App Privacy',
  'Android 国内市场隐私合规',
  '账号信息',
  '财务信息',
  '用户内容',
  '应用活动',
  '诊断数据',
  '本地设备数据',
  '不用于第三方广告',
  '不用于跨 App 跟踪',
  '不出售',
  '传输加密',
  '用户可删除数据',
  '第三方 SDK/服务',
  'Data safety 表单建议',
  'App Privacy 填写建议',
  '审核前复核',
]) {
  assert(privacyMatrix.includes(phrase), `${privacyMatrixPath} should mention "${phrase}".`);
}

const privacyPage = read('src/app/privacy/page.tsx');
for (const phrase of [
  '本地设备数据',
  '第三方服务',
  '不会用于第三方广告',
  '不会用于跨 App 跟踪',
  '不会出售',
  '传输加密',
  '数据保留',
]) {
  assert(privacyPage.includes(phrase), `/privacy should mention "${phrase}" for store review consistency.`);
}

const checklist = read('docs/release/store-publishing-checklist.md');
assert(
  checklist.includes('docs/release/privacy-data-safety.md') &&
    checklist.includes('npm run privacy:check') &&
    checklist.includes('Data safety') &&
    checklist.includes('App Privacy'),
  'Main publishing checklist should link privacy declarations and the privacy check command.',
);

const storeReadiness = read('scripts/check-store-release-readiness.ts');
assert(
  storeReadiness.includes('scripts/check-market-privacy-readiness.ts') &&
    storeReadiness.includes('docs/release/privacy-data-safety.md'),
  'Overall store readiness check should include market privacy readiness artifacts.',
);
