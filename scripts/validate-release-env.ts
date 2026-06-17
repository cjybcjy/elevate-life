import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

export type ReleaseEnvValidationResult = {
  ok: boolean;
  errors: string[];
  urls: {
    privacyUrl?: string;
    supportUrl?: string;
    accountDeletionUrl?: string;
    manifestUrl?: string;
    assetLinksUrl?: string;
  };
};

const SHA256_FINGERPRINT = /^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i;
const PACKAGE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/;

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
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

function parseUrl(key: string, value: string, errors: string[]) {
  if (hasPlaceholder(value)) {
    errors.push(`${key} must be set to a real value, not a placeholder.`);
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return null;
  }

  if (url.protocol !== 'https:') {
    errors.push(`${key} must use https:// for store submission.`);
  }

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0') {
    errors.push(`${key} must point to a public HTTPS host, not localhost.`);
  }

  return url;
}

function originOf(url: URL | null) {
  return url ? url.origin : undefined;
}

function expectSameOrigin(key: string, actualRaw: string, expectedOrigin: string | undefined, errors: string[]) {
  const actualUrl = parseUrl(key, actualRaw, errors);
  if (!actualUrl || !expectedOrigin) return;

  if (actualUrl.origin !== expectedOrigin || actualUrl.pathname !== '/') {
    errors.push(`${key} must equal APP_PUBLIC_BASE_URL origin (${expectedOrigin}).`);
  }
}

function expectedUrl(baseOrigin: string | undefined, path: string) {
  return baseOrigin ? new URL(path, `${baseOrigin}/`).toString() : undefined;
}

function validatePackageId(key: string, value: string, errors: string[]) {
  if (hasPlaceholder(value) || value.toLowerCase().includes('.example.')) {
    errors.push(`${key} must use the final reverse-DNS package id, not com.example.*.`);
    return;
  }

  if (!PACKAGE_ID.test(value)) {
    errors.push(`${key} must be a stable reverse-DNS id such as com.company.elevatelife.`);
  }
}

export function validateReleaseEnv(env: EnvMap = process.env): ReleaseEnvValidationResult {
  const errors: string[] = [];

  const baseUrlRaw = envValue(env, 'APP_PUBLIC_BASE_URL');
  const baseUrl = parseUrl('APP_PUBLIC_BASE_URL', baseUrlRaw, errors);
  if (baseUrl && baseUrl.pathname !== '/') {
    errors.push('APP_PUBLIC_BASE_URL must be an origin only, without a path.');
  }

  const baseOrigin = originOf(baseUrl);
  const manifestUrl = expectedUrl(baseOrigin, '/manifest.webmanifest');
  const privacyUrl = expectedUrl(baseOrigin, '/privacy');
  const supportUrl = expectedUrl(baseOrigin, '/support');
  const accountDeletionUrl = expectedUrl(baseOrigin, '/account-deletion');
  const assetLinksUrl = expectedUrl(baseOrigin, '/.well-known/assetlinks.json');

  const supportEmail = envValue(env, 'APP_SUPPORT_EMAIL');
  if (hasPlaceholder(supportEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    errors.push('APP_SUPPORT_EMAIL must be a real support mailbox for store review.');
  }

  expectSameOrigin('CAPACITOR_SERVER_URL', envValue(env, 'CAPACITOR_SERVER_URL'), baseOrigin, errors);
  expectSameOrigin('STORE_SCREENSHOT_BASE_URL', envValue(env, 'STORE_SCREENSHOT_BASE_URL'), baseOrigin, errors);

  const twaManifestUrl = parseUrl('TWA_MANIFEST_URL', envValue(env, 'TWA_MANIFEST_URL'), errors);
  if (twaManifestUrl && manifestUrl && twaManifestUrl.toString() !== manifestUrl) {
    errors.push(`TWA_MANIFEST_URL must equal ${manifestUrl}.`);
  }

  const capacitorAppId = envValue(env, 'CAPACITOR_APP_ID');
  const androidPackageName = envValue(env, 'ANDROID_PACKAGE_NAME');
  validatePackageId('CAPACITOR_APP_ID', capacitorAppId, errors);
  validatePackageId('ANDROID_PACKAGE_NAME', androidPackageName, errors);
  if (capacitorAppId && androidPackageName && capacitorAppId !== androidPackageName) {
    errors.push('ANDROID_PACKAGE_NAME must match CAPACITOR_APP_ID for TWA, Digital Asset Links, and native builds.');
  }

  const fingerprints = envValue(env, 'ANDROID_SHA256_CERT_FINGERPRINTS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS must include at least one release/App Signing SHA-256 fingerprint.');
  } else if (fingerprints.some((fingerprint) => !SHA256_FINGERPRINT.test(fingerprint))) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS must be comma-separated SHA-256 fingerprints like AA:BB:...:99.');
  }

  return {
    ok: errors.length === 0,
    errors,
    urls: {
      privacyUrl,
      supportUrl,
      accountDeletionUrl,
      manifestUrl,
      assetLinksUrl,
    },
  };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateReleaseEnv(process.env);
  if (!result.ok) {
    console.error('Release environment is not ready for store submission:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Release environment looks ready for store packaging.');
  console.log(`Privacy URL: ${result.urls.privacyUrl}`);
  console.log(`Support URL: ${result.urls.supportUrl}`);
  console.log(`Account deletion URL: ${result.urls.accountDeletionUrl}`);
  console.log(`Manifest URL: ${result.urls.manifestUrl}`);
  console.log(`Digital Asset Links URL: ${result.urls.assetLinksUrl}`);
}

if (process.argv[1]?.endsWith('validate-release-env.ts') || process.argv[1]?.endsWith('validate-release-env.js')) {
  runCli();
}
