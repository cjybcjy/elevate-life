import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type AndroidSigningOptions = {
  fileExists?: (path: string) => boolean;
  runKeytool?: (keystorePath: string, alias: string, storePassword: string) => string;
};

type AndroidSigningValidationResult = {
  ok: boolean;
  errors: string[];
  uploadKeyFingerprint?: string;
};

const SHA256_FINGERPRINT = /^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i;

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function hasPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return !value || value.includes('<') || value.includes('>') || value.includes('/secure/path/') || normalized.includes('example');
}

function normalizeFingerprint(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, ':')
    .toUpperCase();
}

export function parseSha256Fingerprint(keytoolOutput: string) {
  const match = keytoolOutput.match(/SHA256:\s*([0-9a-fA-F:\-\s]{95,})/);
  if (!match) return undefined;
  const candidate = normalizeFingerprint(match[1]);
  return SHA256_FINGERPRINT.test(candidate) ? candidate : undefined;
}

function defaultRunKeytool(keystorePath: string, alias: string, storePassword: string) {
  return execFileSync(
    'keytool',
    ['-list', '-v', '-keystore', keystorePath, '-alias', alias, '-storepass', storePassword],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

export function validateAndroidSigningConfig(
  env: EnvMap = process.env,
  options: AndroidSigningOptions = {},
): AndroidSigningValidationResult {
  const errors: string[] = [];
  const fileExists = options.fileExists ?? existsSync;
  const runKeytool = options.runKeytool ?? defaultRunKeytool;

  const keystorePath = envValue(env, 'TWA_SIGNING_KEY_PATH');
  const alias = envValue(env, 'TWA_SIGNING_KEY_ALIAS');
  const storePassword = envValue(env, 'ANDROID_KEYSTORE_STORE_PASSWORD');
  const configuredFingerprints = envValue(env, 'ANDROID_SHA256_CERT_FINGERPRINTS')
    .split(',')
    .map(normalizeFingerprint)
    .filter(Boolean);

  if (hasPlaceholder(keystorePath)) {
    errors.push('TWA_SIGNING_KEY_PATH must point to the final Android upload keystore, not a placeholder.');
  } else if (!fileExists(keystorePath)) {
    errors.push(`TWA_SIGNING_KEY_PATH does not exist: ${keystorePath}.`);
  }

  if (hasPlaceholder(alias)) {
    errors.push('TWA_SIGNING_KEY_ALIAS must be set to the release key alias.');
  }

  if (!storePassword) {
    errors.push('ANDROID_KEYSTORE_STORE_PASSWORD must be set so keytool can read the release keystore non-interactively.');
  }

  if (configuredFingerprints.length === 0) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS must include the release/App Signing SHA-256 fingerprint.');
  } else if (configuredFingerprints.some((fingerprint) => !SHA256_FINGERPRINT.test(fingerprint))) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS must contain comma-separated SHA-256 fingerprints like AA:BB:...:99.');
  }

  let uploadKeyFingerprint: string | undefined;
  if (errors.length === 0) {
    try {
      uploadKeyFingerprint = parseSha256Fingerprint(runKeytool(keystorePath, alias, storePassword));
      if (!uploadKeyFingerprint) {
        errors.push('keytool output did not include a valid SHA256 fingerprint for TWA_SIGNING_KEY_ALIAS.');
      } else if (!configuredFingerprints.includes(uploadKeyFingerprint)) {
        errors.push(`ANDROID_SHA256_CERT_FINGERPRINTS must include upload key fingerprint ${uploadKeyFingerprint}.`);
      }
    } catch (error) {
      errors.push(`keytool failed to read TWA_SIGNING_KEY_PATH: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: errors.length === 0, errors, uploadKeyFingerprint };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateAndroidSigningConfig(process.env);
  if (!result.ok) {
    console.error('Android signing is not ready:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Android signing looks ready.');
  console.log(`Upload key SHA-256: ${result.uploadKeyFingerprint}`);
  console.log('Confirm Play App Signing SHA-256 is also included in ANDROID_SHA256_CERT_FINGERPRINTS after Play Console creates it.');
}

if (process.argv[1]?.endsWith('validate-android-signing.ts') || process.argv[1]?.endsWith('validate-android-signing.js')) {
  runCli();
}
