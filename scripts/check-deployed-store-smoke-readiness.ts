import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'scripts/smoke-test-store-deployment.ts',
  'docs/release/production-environment.md',
  'docs/release/store-publishing-checklist.md',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for deployed store smoke readiness.`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['release:smoke'],
  'npx tsx scripts/smoke-test-store-deployment.ts',
  'package.json should expose release:smoke for deployed store URL verification.',
);

const smokeSource = read('scripts/smoke-test-store-deployment.ts');
for (const phrase of [
  'APP_PUBLIC_BASE_URL',
  '/privacy',
  '/support',
  '/account-deletion',
  '/manifest.webmanifest',
  '/.well-known/assetlinks.json',
  'delegate_permission/common.handle_all_urls',
  "manifest.display !== 'standalone'",
  "categories.includes('finance')",
]) {
  assert(smokeSource.includes(phrase), `smoke-test-store-deployment.ts should mention ${phrase}.`);
}

async function main() {
  const { smokeTestStoreDeployment } = await import('./smoke-test-store-deployment');
  const baseUrl = 'https://app.elevatelife.example';

  const okFetch = async (input: string | URL) => {
    const url = new URL(String(input));
    const bodyByPath: Record<string, string> = {
      '/privacy': '<html><title>隐私政策</title><body>家庭财务数据 账号信息 数据删除</body></html>',
      '/support': '<html><title>支持与帮助</title><body>审核测试账号 隐私政策 账号与数据删除</body></html>',
      '/account-deletion': '<html><title>账号与数据删除</title><body>删除范围 处理时限 审核备注</body></html>',
      '/manifest.webmanifest': JSON.stringify({
        name: 'Elevate Life 家庭账本',
        short_name: '家庭账本',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', purpose: 'maskable' },
        ],
        categories: ['finance', 'productivity'],
      }),
      '/.well-known/assetlinks.json': JSON.stringify([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.elevatelife.app',
            sha256_cert_fingerprints: [
              'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
            ],
          },
        },
      ]),
    };
    return new Response(bodyByPath[url.pathname] ?? '', {
      status: 200,
      headers: { 'content-type': url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest') ? 'application/json' : 'text/html' },
    });
  };

  const okResult = await smokeTestStoreDeployment({ baseUrl, fetchImpl: okFetch });
  assert.deepEqual(okResult.errors, [], `valid deployed URL responses should pass: ${okResult.errors.join(', ')}`);

  const badFetch = async () => new Response('<html><title>Login</title><form>Sign In</form></html>', { status: 200 });
  const badResult = await smokeTestStoreDeployment({ baseUrl, fetchImpl: badFetch });
  assert(!badResult.ok, 'login/invalid deployed responses should fail smoke testing.');
  for (const phrase of ['/privacy', '/support', '/account-deletion', '/manifest.webmanifest', '/.well-known/assetlinks.json']) {
    assert(
      badResult.errors.some((error: string) => error.includes(phrase)),
      `bad deployed responses should report ${phrase}.`,
    );
  }

  const guide = read('docs/release/production-environment.md');
  assert(
    guide.includes('npm run release:smoke') &&
      guide.includes('public URL smoke') &&
      guide.includes('/manifest.webmanifest') &&
      guide.includes('/.well-known/assetlinks.json'),
    'production environment guide should document release:smoke after deployment.',
  );

  const checklist = read('docs/release/store-publishing-checklist.md');
  assert(
    checklist.includes('npm run release:smoke') &&
      checklist.includes('线上公开页面') &&
      checklist.includes('/.well-known/assetlinks.json'),
    'store publishing checklist should include deployed public URL smoke testing.',
  );

  const releaseReadiness = read('scripts/check-store-release-readiness.ts');
  assert(
    releaseReadiness.includes('scripts/check-deployed-store-smoke-readiness.ts') &&
      releaseReadiness.includes('scripts/smoke-test-store-deployment.ts') &&
      releaseReadiness.includes('release:smoke'),
    'overall store release readiness should include deployed URL smoke test artifacts.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
