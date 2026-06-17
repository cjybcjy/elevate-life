import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = 'src/app/.well-known/assetlinks.json/route.ts';
const routeAbs = resolve(process.cwd(), routePath);

assert(existsSync(routeAbs), `${routePath} should expose Digital Asset Links at /.well-known/assetlinks.json.`);

const routeSource = readFileSync(routeAbs, 'utf8');
assert(
  routeSource.includes('ANDROID_PACKAGE_NAME') &&
    routeSource.includes('ANDROID_SHA256_CERT_FINGERPRINTS') &&
    routeSource.includes('delegate_permission/common.handle_all_urls') &&
    routeSource.includes('sha256_cert_fingerprints') &&
    routeSource.includes('Cache-Control') &&
    routeSource.includes('application/json'),
  'Digital Asset Links route should be env-driven, TWA-compatible, and served as JSON.',
);

async function main() {
  process.env.ANDROID_PACKAGE_NAME = 'com.example.elevatelife';
  process.env.ANDROID_SHA256_CERT_FINGERPRINTS = [
    'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
    '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
  ].join(',');

  const { GET } = await import('../src/app/.well-known/assetlinks.json/route');

  const configuredResponse = await GET();
  assert.equal(configuredResponse.status, 200);
  assert.match(configuredResponse.headers.get('content-type') || '', /application\/json/);
  assert.match(configuredResponse.headers.get('cache-control') || '', /max-age=300/);

  const configuredBody = await configuredResponse.json();
  assert.deepEqual(configuredBody, [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.example.elevatelife',
        sha256_cert_fingerprints: [
          'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
          '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
        ],
      },
    },
  ]);

  delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  const unconfiguredResponse = await GET();
  assert.equal(unconfiguredResponse.status, 200);
  assert.equal(unconfiguredResponse.headers.get('x-assetlinks-status'), 'unconfigured');
  assert.deepEqual(await unconfiguredResponse.json(), []);
}

const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
assert(
  envExample.includes('ANDROID_PACKAGE_NAME=') &&
    envExample.includes('ANDROID_SHA256_CERT_FINGERPRINTS='),
  '.env.example should document the Digital Asset Links environment variables.',
);

const checklist = readFileSync(resolve(process.cwd(), 'docs/release/store-publishing-checklist.md'), 'utf8');
assert(
  checklist.includes('/.well-known/assetlinks.json') &&
    checklist.includes('ANDROID_SHA256_CERT_FINGERPRINTS') &&
    checklist.includes('scripts/check-digital-asset-links-route.ts'),
  'Store publishing checklist should document the live Digital Asset Links endpoint and validation script.',
);

main();
