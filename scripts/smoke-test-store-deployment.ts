import { loadEnvConfig } from '@next/env';
import { validateReleaseEnv } from './validate-release-env';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type SmokeOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
};

type SmokeResult = {
  ok: boolean;
  errors: string[];
  checkedUrls: string[];
};

type WebManifest = {
  display?: unknown;
  scope?: unknown;
  start_url?: unknown;
  icons?: unknown;
  categories?: unknown;
};

type AssetLinkStatement = {
  relation?: unknown;
  target?: {
    namespace?: unknown;
    package_name?: unknown;
    sha256_cert_fingerprints?: unknown;
  };
};

const REQUIRED_HTML: Array<{ path: string; phrases: string[] }> = [
  { path: '/privacy', phrases: ['隐私政策', '家庭财务数据', '账号信息', '数据删除'] },
  { path: '/support', phrases: ['支持与帮助', '审核测试账号', '隐私政策', '账号与数据删除'] },
  { path: '/account-deletion', phrases: ['账号与数据删除', '删除范围', '处理时限', '审核备注'] },
];

function urlFor(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

async function fetchText(fetchImpl: FetchLike, url: string, errors: string[]) {
  let response: Response;
  try {
    response = await fetchImpl(url, { redirect: 'manual' });
  } catch (error) {
    errors.push(`${new URL(url).pathname} failed to fetch: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  if (response.status >= 300 && response.status < 400) {
    errors.push(`${new URL(url).pathname} should not redirect during store review smoke testing.`);
    return null;
  }

  if (!response.ok) {
    errors.push(`${new URL(url).pathname} returned HTTP ${response.status}.`);
    return null;
  }

  return response.text();
}

function includesLoginScreen(text: string) {
  const normalized = text.toLowerCase();
  return normalized.includes('sign in') || normalized.includes('/login') || normalized.includes('login failed');
}

async function checkHtml(fetchImpl: FetchLike, baseUrl: string, path: string, phrases: string[], errors: string[]) {
  const text = await fetchText(fetchImpl, urlFor(baseUrl, path), errors);
  if (!text) return;

  if (includesLoginScreen(text)) {
    errors.push(`${path} should be publicly accessible and must not render the login screen.`);
  }

  for (const phrase of phrases) {
    if (!text.includes(phrase)) {
      errors.push(`${path} should include "${phrase}" for store review.`);
    }
  }
}

async function checkManifest(fetchImpl: FetchLike, baseUrl: string, errors: string[]) {
  const path = '/manifest.webmanifest';
  const text = await fetchText(fetchImpl, urlFor(baseUrl, path), errors);
  if (!text) return;

  let manifest: WebManifest;
  try {
    manifest = JSON.parse(text) as WebManifest;
  } catch {
    errors.push(`${path} should return valid JSON.`);
    return;
  }

  if (manifest.display !== 'standalone') {
    errors.push(`${path} should set display to standalone.`);
  }
  if (manifest.scope !== '/' || manifest.start_url !== '/') {
    errors.push(`${path} should use root scope and start_url.`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
    errors.push(`${path} should include store-ready icons.`);
  }
  if (!Array.isArray(manifest.categories) || !manifest.categories.includes('finance')) {
    errors.push(`${path} categories should include finance.`);
  }
}

async function checkAssetLinks(fetchImpl: FetchLike, baseUrl: string, errors: string[]) {
  const path = '/.well-known/assetlinks.json';
  const text = await fetchText(fetchImpl, urlFor(baseUrl, path), errors);
  if (!text) return;

  let assetLinks: unknown;
  try {
    assetLinks = JSON.parse(text);
  } catch {
    errors.push(`${path} should return valid JSON.`);
    return;
  }

  if (!Array.isArray(assetLinks) || assetLinks.length === 0) {
    errors.push(`${path} should include at least one Digital Asset Links statement.`);
    return;
  }

  const statements = assetLinks as AssetLinkStatement[];
  const statement = statements.find((item) =>
    Array.isArray(item.relation) && item.relation.includes('delegate_permission/common.handle_all_urls'),
  );
  if (!statement) {
    errors.push(`${path} should include delegate_permission/common.handle_all_urls.`);
    return;
  }

  if (statement.target?.namespace !== 'android_app') {
    errors.push(`${path} target.namespace should be android_app.`);
  }
  if (!statement.target?.package_name) {
    errors.push(`${path} target.package_name should be configured.`);
  }
  if (!Array.isArray(statement.target?.sha256_cert_fingerprints) || statement.target.sha256_cert_fingerprints.length === 0) {
    errors.push(`${path} should include SHA-256 certificate fingerprints.`);
  }
}

export async function smokeTestStoreDeployment({ baseUrl, fetchImpl = fetch }: SmokeOptions): Promise<SmokeResult> {
  const errors: string[] = [];
  const checkedUrls = [
    ...REQUIRED_HTML.map(({ path }) => urlFor(baseUrl, path)),
    urlFor(baseUrl, '/manifest.webmanifest'),
    urlFor(baseUrl, '/.well-known/assetlinks.json'),
  ];

  for (const page of REQUIRED_HTML) {
    await checkHtml(fetchImpl, baseUrl, page.path, page.phrases, errors);
  }
  await checkManifest(fetchImpl, baseUrl, errors);
  await checkAssetLinks(fetchImpl, baseUrl, errors);

  return { ok: errors.length === 0, errors, checkedUrls };
}

async function runCli() {
  loadEnvConfig(process.cwd());
  const releaseEnv = validateReleaseEnv(process.env);
  if (!releaseEnv.ok) {
    console.error('Release environment is not ready; run npm run release:check first.');
    for (const error of releaseEnv.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const baseUrl = process.env.APP_PUBLIC_BASE_URL || '';
  const result = await smokeTestStoreDeployment({ baseUrl });
  if (!result.ok) {
    console.error('Deployed store URL smoke test failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Deployed store URL smoke test passed.');
  for (const url of result.checkedUrls) console.log(`- ${url}`);
}

if (process.argv[1]?.endsWith('smoke-test-store-deployment.ts') || process.argv[1]?.endsWith('smoke-test-store-deployment.js')) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
