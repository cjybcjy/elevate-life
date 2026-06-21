import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type SubmissionFile = {
  path: string;
  content: string;
};

type StoreSubmissionPackage = {
  outputDir: string;
  files: SubmissionFile[];
};

type StoreSubmissionEnvValidationResult = {
  ok: boolean;
  errors: string[];
};

const APP_NAME = 'Elevate Life 家庭账本';
const TAGLINE = '10 秒看懂家庭财务是否安全，知道下一步该处理什么。';
const KEYWORDS = ['家庭账本', '家庭财务', '预算管理', '资产管理', '流水', '现金流', '记账', '财务安全', '资金账户', '负债管理'];
const MARKETS = ['Google Play', 'Android 国内市场', 'iOS App Store'];
const FULL_DESCRIPTION =
  'Elevate Life 家庭账本面向家庭财务管理场景，帮助用户集中查看资产、负债、预算、流水和现金流安全状态。首页优先回答“我家现在安不安全，接下来该做哪件事”，并支持按资金账户追踪银行卡、现金、投资账户等资金流动。';

function envValue(env: EnvMap, key: string, fallback = '') {
  return (env[key] || fallback).trim();
}

function hasPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    !value ||
    value.includes('<') ||
    value.includes('>') ||
    value.includes('你的域名') ||
    value.includes('your-domain') ||
    value.includes('待填写') ||
    normalized.includes('example.com')
  );
}

function validatePublicBaseUrl(value: string, errors: string[]) {
  if (hasPlaceholder(value)) {
    errors.push('APP_PUBLIC_BASE_URL must be a real public HTTPS origin, not a placeholder.');
    return;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push('APP_PUBLIC_BASE_URL must be a valid URL.');
    return;
  }

  if (url.protocol !== 'https:') {
    errors.push('APP_PUBLIC_BASE_URL must use https:// for store submission materials.');
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0') {
    errors.push('APP_PUBLIC_BASE_URL must point to a public host, not localhost.');
  }
  if (url.pathname !== '/') {
    errors.push('APP_PUBLIC_BASE_URL must be an origin only, without a path.');
  }
}

export function validateStoreSubmissionEnv(env: EnvMap = process.env): StoreSubmissionEnvValidationResult {
  const errors: string[] = [];
  const baseUrl = envValue(env, 'APP_PUBLIC_BASE_URL');
  const supportEmail = envValue(env, 'APP_SUPPORT_EMAIL');

  validatePublicBaseUrl(baseUrl, errors);

  if (hasPlaceholder(supportEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    errors.push('APP_SUPPORT_EMAIL must be a real support mailbox for store submission materials.');
  }

  return { ok: errors.length === 0, errors };
}

function requireStoreSubmissionEnv(env: EnvMap) {
  const validation = validateStoreSubmissionEnv(env);
  if (!validation.ok) {
    throw new Error(`Store submission package requires real release metadata:\n- ${validation.errors.join('\n- ')}`);
  }
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function urlFor(baseUrl: string, path: string) {
  return `${baseUrl}${path}`;
}

function jsonFile(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildStoreSubmissionPackage(env: EnvMap = process.env): StoreSubmissionPackage {
  requireStoreSubmissionEnv(env);

  const baseUrl = normalizeBaseUrl(envValue(env, 'APP_PUBLIC_BASE_URL'));
  const supportEmail = envValue(env, 'APP_SUPPORT_EMAIL');
  const reviewUsername = envValue(env, 'REVIEW_ACCOUNT_USERNAME', 'demo');
  const reviewPassword = envValue(env, 'REVIEW_ACCOUNT_PASSWORD', 'demo123');
  const outputDir = envValue(env, 'STORE_SUBMISSION_OUTPUT_DIR', 'store-submission');

  const publicUrls = {
    privacyPolicy: urlFor(baseUrl, '/privacy'),
    terms: urlFor(baseUrl, '/terms'),
    support: urlFor(baseUrl, '/support'),
    accountDeletion: urlFor(baseUrl, '/account-deletion'),
    manifest: urlFor(baseUrl, '/manifest.webmanifest'),
    digitalAssetLinks: urlFor(baseUrl, '/.well-known/assetlinks.json'),
  };

  const metadata = {
    appName: APP_NAME,
    tagline: TAGLINE,
    categories: ['财务', '效率'],
    ageRatingNote: '不含用户生成公开内容、不含成人内容，按各市场问卷填写。',
    supportEmail,
    publicUrls,
    reviewAccount: {
      username: reviewUsername,
      password: reviewPassword,
    },
    keywords: KEYWORDS,
    markets: MARKETS,
    description: FULL_DESCRIPTION,
    screenshotOutputDir: 'store-screenshots/',
  };

  const files: SubmissionFile[] = [
    {
      path: 'metadata.json',
      content: jsonFile(metadata),
    },
    {
      path: 'review-notes.md',
      content: [
        '# 审核备注',
        '',
        `测试账号：${reviewUsername}`,
        `测试密码：${reviewPassword}`,
        '',
        '审核路径：',
        '1. 登录后在首页查看家庭财务状态和下一步行动。',
        '2. 进入资产管理查看资金账户和资产配置。',
        '3. 进入流水管理新增或编辑支出，并选择来源资金账户。',
        '4. 进入预算管理记录预算支出。',
        '',
        '公开合规 URL：',
        `- 隐私政策：${publicUrls.privacyPolicy}`,
        `- 用户协议：${publicUrls.terms}`,
        `- 支持页：${publicUrls.support}`,
        `- 账号与数据删除：${publicUrls.accountDeletion}`,
        '',
        '数据说明：应用存储家庭财务数据，提交审核时请使用测试数据，不要填真实银行卡号或个人敏感材料。',
        '首次进入登录、注册或业务页面前，会展示用户协议和隐私政策确认。',
        '',
      ].join('\n'),
    },
    {
      path: 'public-urls.md',
      content: [
        '# 公开 URL',
        '',
        `- 隐私政策：${publicUrls.privacyPolicy}`,
        `- 用户协议：${publicUrls.terms}`,
        `- 支持页：${publicUrls.support}`,
        `- 账号与数据删除：${publicUrls.accountDeletion}`,
        `- PWA Manifest：${publicUrls.manifest}`,
        `- Digital Asset Links：${publicUrls.digitalAssetLinks}`,
        '',
        '正式提交前请确认这些 URL 均为真实 HTTPS 域名，且无需登录即可访问。',
        '',
      ].join('\n'),
    },
    {
      path: 'privacy-data-safety-summary.md',
      content: [
        '# 隐私与数据安全摘要',
        '',
        '- 是否收集用户数据：是。',
        '- 是否分享用户数据：否，除非正式部署时引入云服务、监控、客服或统计 SDK；一旦引入必须更新申报。',
        '- 是否加密传输：是，线上必须使用 HTTPS。',
        '- 用户可删除数据：是，公开页面 `/account-deletion` 说明删除方式。',
        '- 是否用于广告或营销：否，不用于第三方广告。',
        '- 是否出售数据：否，不出售家庭财务数据。',
        '- 需要申报的数据类型：账号信息、财务信息、用户内容、应用活动、诊断数据。',
        '- 跟踪：否，当前应用不用于跨 App 跟踪，也不接入广告标识符。',
        '',
      ].join('\n'),
    },
    {
      path: 'market-copy.md',
      content: [
        '# 商店文案',
        '',
        `应用名称：${APP_NAME}`,
        `一句话简介：${TAGLINE}`,
        '类别建议：财务 / 效率',
        `关键词：${KEYWORDS.join('、')}`,
        '',
        '完整描述：',
        FULL_DESCRIPTION,
        '',
        '市场：',
        ...MARKETS.map((market) => `- ${market}`),
        '',
        `支持邮箱：${supportEmail}`,
        '',
      ].join('\n'),
    },
  ];

  return { outputDir, files };
}

export function writeStoreSubmissionPackage(env: EnvMap = process.env) {
  const submissionPackage = buildStoreSubmissionPackage(env);
  mkdirSync(submissionPackage.outputDir, { recursive: true });
  for (const file of submissionPackage.files) {
    writeFileSync(join(submissionPackage.outputDir, file.path), file.content, 'utf8');
  }
  return submissionPackage;
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = writeStoreSubmissionPackage(process.env);
  console.log(`Store submission package generated at ${result.outputDir}/`);
  for (const file of result.files) {
    console.log(`- ${join(result.outputDir, file.path)}`);
  }
}

if (
  process.argv[1]?.endsWith('generate-store-submission-package.ts') ||
  process.argv[1]?.endsWith('generate-store-submission-package.js')
) {
  runCli();
}
