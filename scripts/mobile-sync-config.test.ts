import assert from 'node:assert/strict';
import test from 'node:test';
import type { CapacitorConfig } from '@capacitor/cli';
import { checkMobileSync, getLocalMobileServerUrl, getMobileServerUrl, mobileTargets } from './mobile-sync-config';

const origin = 'https://finance.household.app';
const config: CapacitorConfig = {
  appId: 'com.elevatelife.app',
  appName: 'Elevate Life',
  webDir: 'mobile-web',
  backgroundColor: '#F7F7F7',
  server: { url: origin, cleartext: false },
  android: { backgroundColor: '#F7F7F7' },
  ios: { backgroundColor: '#F7F7F7' },
};

function nativeFiles() {
  const files: Record<string, string> = { 'mobile-web/index.html': '<html>current fallback</html>' };
  for (const target of mobileTargets) {
    files[target.config] = JSON.stringify(config);
    files[target.page] = files['mobile-web/index.html'];
  }
  return files;
}

test('sync requires the shared service while config inspection may use a local fallback', () => {
  assert.equal(getMobileServerUrl({}), undefined);
  assert.throws(() => getMobileServerUrl({}, true), /Set CAPACITOR_SERVER_URL/);
  assert.throws(() => getMobileServerUrl({ CAPACITOR_SERVER_URL: '  ' }, true), /Set CAPACITOR_SERVER_URL/);
});

test('service addresses normalize and must agree across Web and native configuration', () => {
  assert.equal(getMobileServerUrl({ CAPACITOR_SERVER_URL: ` ${origin}/ `, APP_PUBLIC_BASE_URL: origin }), origin);
  assert.throws(() => getMobileServerUrl({
    CAPACITOR_SERVER_URL: origin,
    APP_PUBLIC_BASE_URL: 'https://another.household.app',
  }), /must match APP_PUBLIC_BASE_URL/);
});

test('placeholder, local, malformed, and non-HTTPS addresses cannot be synchronized', () => {
  for (const value of [
    'https://app.example.com', 'https://EXAMPLE.COM.', 'https://example.net',
    'https://app.example', 'https://app.invalid', 'https://app.local', 'https://app.test', 'https://localhost',
    'https://127.0.0.1', 'https://[::1]', 'http://finance.household.app', 'not-a-url',
  ]) {
    assert.throws(() => getMobileServerUrl({ CAPACITOR_SERVER_URL: value }, true), /HTTPS/);
  }
});

test('service URL rejects credentials and routing suffixes without disclosing their values', () => {
  for (const value of [`https://private:secret@finance.household.app`, `${origin}/login`, `${origin}?token=secret`, `${origin}#secret`]) {
    assert.throws(() => getMobileServerUrl({ CAPACITOR_SERVER_URL: value }, true), (error: unknown) => {
      assert(error instanceof Error);
      assert(!error.message.includes('secret'));
      assert(!error.message.includes('private'));
      return /only the service origin/.test(error.message);
    });
  }
});

test('sync verification accepts matching Android/iOS service, identity, theme, and fallback', () => {
  const files = nativeFiles();
  assert.deepEqual(checkMobileSync(config, (path) => files[path]), []);
});

test('sync verification catches one platform still loading a placeholder or stale theme', () => {
  const files = nativeFiles();
  files[mobileTargets[1].config] = JSON.stringify({
    ...config,
    server: { url: 'https://app.example.com', cleartext: false },
    backgroundColor: '#0f172a',
  });
  const errors = checkMobileSync(config, (path) => files[path]);
  assert(errors.some((error) => error.includes('iOS: shared Web service URL')));
  assert(errors.some((error) => error.includes('iOS: backgroundColor')));
  assert(errors.every((error) => error.startsWith('iOS:')));
});

test('sync verification catches stale fallback pages and unreadable generated configuration', () => {
  const files = nativeFiles();
  files[mobileTargets[0].page] = '<html>old fallback</html>';
  files[mobileTargets[1].config] = '{';
  const errors = checkMobileSync(config, (path) => files[path]);
  assert(errors.some((error) => error.includes('Android: local fallback page')));
  assert(errors.some((error) => error.includes('iOS: generated configuration')));
});

test('fallback-only native configuration cannot pass as synchronized functionality', () => {
  const files = nativeFiles();
  assert(checkMobileSync({ ...config, server: undefined }, (path) => files[path]).length > 0);
});

test('local defaults reach the host from Android emulator and iOS simulator separately', () => {
  assert.equal(getLocalMobileServerUrl({}, 'android'), 'http://10.0.2.2:3000');
  assert.equal(getLocalMobileServerUrl({}, 'ios'), 'http://localhost:3000');
  assert.equal(getLocalMobileServerUrl({ CAPACITOR_SERVER_URL: origin }, 'android'), 'http://10.0.2.2:3000');
});

test('explicit local override accepts private LAN addresses on port 3000 only', () => {
  for (const address of ['192.168.1.20:3000', 'http://10.1.1.2:3000', 'http://172.16.0.1:3000']) {
    assert.equal(getLocalMobileServerUrl({ CAPACITOR_LOCAL_SERVER_URL: address }, 'ios'),
      address.startsWith('http:') ? address : `http://${address}`);
  }
  for (const address of ['https://finance.household.app', 'http://8.8.8.8:3000', 'http://localhost:4000',
    'http://192.168.1.2:3000/login', 'http://user:secret@192.168.1.2:3000', 'http://0.0.0.0:3000']) {
    assert.throws(() => getLocalMobileServerUrl({ CAPACITOR_LOCAL_SERVER_URL: address }, 'android'), /local|LAN/);
  }
});

test('local verification checks platform-specific service URLs and rejects release configuration', () => {
  const files = nativeFiles();
  for (const target of mobileTargets) {
    const local = { ...config, server: { url: getLocalMobileServerUrl({}, target.platform), cleartext: true } };
    files[target.config] = JSON.stringify(local);
    assert.deepEqual(checkMobileSync(local, (path) => files[path], target.platform), []);
  }
  assert.equal(checkMobileSync(config, (path) => files[path]).length, 2);
  const android = { ...config, server: { url: getLocalMobileServerUrl({}, 'android'), cleartext: true } };
  assert(checkMobileSync(android, (path) => files[path], 'ios').some((error) => error.includes('iOS: shared Web service')));
});
