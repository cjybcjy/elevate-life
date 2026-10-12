import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';

type EnvMap = Record<string, string | undefined>;
export type MobilePlatform = 'android' | 'ios';

export function getLocalMobileServerUrl(env: EnvMap, platform: MobilePlatform): string {
  const raw = env.CAPACITOR_LOCAL_SERVER_URL?.trim() ||
    (platform === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `http://${raw}`);
  } catch {
    throw new Error('CAPACITOR_LOCAL_SERVER_URL must be a local HTTP address on port 3000.');
  }
  const host = url.hostname;
  const octets = host.split('.').map(Number);
  const privateIp = octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 || octets[0] === 127 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (url.protocol !== 'http:' || url.port !== '3000' ||
      (!privateIp && host !== 'localhost' && host !== '[::1]') ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CAPACITOR_LOCAL_SERVER_URL must be a loopback or private LAN HTTP origin on port 3000.');
  }
  return url.origin;
}

function serviceOrigin(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a real HTTPS service origin.`);
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    !hostname.includes('.') ||
    /(^|\.)(example\.(com|org|net)|example|localhost|test|invalid|local)$/.test(hostname) ||
    /^[\d.]+$/.test(hostname) ||
    hostname.startsWith('[')
  ) {
    throw new Error(`${name} must use a real HTTPS hostname, not an example or local address.`);
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must contain only the service origin, without credentials, a path, query, or fragment.`);
  }
  return url.origin;
}

export function getMobileServerUrl(env: EnvMap, required = false): string | undefined {
  const raw = env.CAPACITOR_SERVER_URL?.trim();
  if (!raw) {
    if (required) {
      throw new Error('Set CAPACITOR_SERVER_URL to the shared Web service HTTPS origin before syncing Android/iOS.');
    }
    return undefined;
  }
  const origin = serviceOrigin(raw, 'CAPACITOR_SERVER_URL');
  if (env.APP_PUBLIC_BASE_URL?.trim()) {
    const publicOrigin = serviceOrigin(env.APP_PUBLIC_BASE_URL.trim(), 'APP_PUBLIC_BASE_URL');
    if (origin !== publicOrigin) {
      throw new Error('CAPACITOR_SERVER_URL must match APP_PUBLIC_BASE_URL so every platform uses the same Web service.');
    }
  }
  return origin;
}

export const mobileTargets = [
  { platform: 'android', name: 'Android', config: 'android/app/src/main/assets/capacitor.config.json', page: 'android/app/src/main/assets/public/index.html' },
  { platform: 'ios', name: 'iOS', config: 'ios/App/App/capacitor.config.json', page: 'ios/App/App/public/index.html' },
] as const;

export function checkMobileSync(
  expected: CapacitorConfig,
  readText: (path: string) => string = (path) => readFileSync(path, 'utf8'),
  platform?: MobilePlatform,
): string[] {
  const errors: string[] = [];
  if (!expected.server?.url) {
    return ['CAPACITOR_SERVER_URL is missing; the local fallback is not the shared application.'];
  }
  for (const target of mobileTargets) {
    if (platform && target.platform !== platform) continue;
    try {
      const actual = JSON.parse(readText(target.config)) as CapacitorConfig;
      for (const key of ['appId', 'appName', 'webDir', 'backgroundColor'] as const) {
        if (actual[key] !== expected[key]) errors.push(`${target.name}: ${key} is out of sync.`);
      }
      if (actual.server?.url !== expected.server.url || actual.server?.cleartext !== expected.server.cleartext) {
        errors.push(`${target.name}: shared Web service URL is out of sync.`);
      }
      for (const platform of ['android', 'ios'] as const) {
        if (actual[platform]?.backgroundColor !== expected[platform]?.backgroundColor) {
          errors.push(`${target.name}: ${platform} background is out of sync.`);
        }
      }
      if (readText(target.page) !== readText('mobile-web/index.html')) {
        errors.push(`${target.name}: local fallback page is out of sync.`);
      }
    } catch {
      errors.push(`${target.name}: generated configuration or fallback page is missing or unreadable; run mobile:sync.`);
    }
  }
  return errors;
}
