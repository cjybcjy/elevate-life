import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type AndroidReleaseApkSignatureOptions = {
  exists?: (path: string) => boolean;
  fileSize?: (path: string) => number;
  runApkSignerVerify?: (path: string) => string;
};

type ApkSignerPathOptions = {
  exists?: (path: string) => boolean;
  readDir?: (path: string) => string[];
};

type AndroidReleaseApkSignatureResult = {
  ok: boolean;
  errors: string[];
  apkPath?: string;
  signerFingerprint?: string;
};

const SHA256_FINGERPRINT = /^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i;
const HOME_ANDROID_SDK_PATH = 'Android/Sdk';

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function normalizeFingerprint(value: string) {
  const hex = value.trim().replace(/[\s:-]+/g, '').toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return value.trim().toUpperCase();
  return hex.match(/.{2}/g)?.join(':') ?? hex;
}

function candidateApkPaths(env: EnvMap) {
  const explicitPath = envValue(env, 'ANDROID_RELEASE_APK_PATH');
  if (explicitPath) return [explicitPath];

  const projectDir = envValue(env, 'ANDROID_NATIVE_PROJECT_DIR') || 'android';
  return [
    join(projectDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    join(projectDir, 'app', 'release', 'app-release.apk'),
  ];
}

export function candidateApkSignerPaths(env: EnvMap, options: ApkSignerPathOptions = {}) {
  const exists = options.exists ?? existsSync;
  const readDir = options.readDir ?? readdirSync;
  const explicitPath = envValue(env, 'ANDROID_APKSIGNER_PATH');
  if (explicitPath) return [explicitPath];

  const sdkRoots = [
    envValue(env, 'ANDROID_HOME'),
    envValue(env, 'ANDROID_SDK_ROOT'),
    envValue(env, 'HOME') ? join(envValue(env, 'HOME'), ...HOME_ANDROID_SDK_PATH.split('/')) : '',
    '/opt/android-sdk',
    '/usr/lib/android-sdk',
  ].filter(Boolean);

  const sdkCandidates: string[] = [];
  for (const sdkRoot of [...new Set(sdkRoots)]) {
    const buildToolsDir = join(sdkRoot, 'build-tools');
    try {
      const buildToolVersions = readDir(buildToolsDir)
        .filter((entry) => exists(join(buildToolsDir, entry, 'apksigner')))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      sdkCandidates.push(...buildToolVersions.map((version) => join(buildToolsDir, version, 'apksigner')));
    } catch {
      // Continue through other conventional SDK locations, then fall back to PATH.
    }
  }

  return [
    ...sdkCandidates,
    'apksigner',
  ];
}

function defaultRunApkSignerVerify(apkPath: string, env: EnvMap) {
  const candidates = candidateApkSignerPaths(env);
  let lastError: unknown;

  for (const apksigner of candidates) {
    try {
      return execFileSync(apksigner, ['verify', '--print-certs', apkPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function configuredFingerprints(env: EnvMap) {
  return envValue(env, 'ANDROID_SHA256_CERT_FINGERPRINTS')
    .split(',')
    .map(normalizeFingerprint)
    .filter(Boolean);
}

function outputFromError(error: unknown) {
  if (error && typeof error === 'object') {
    const candidate = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = candidate.stdout ? String(candidate.stdout) : '';
    const stderr = candidate.stderr ? String(candidate.stderr) : '';
    return [stdout, stderr, candidate.message || ''].filter(Boolean).join('\n');
  }

  return String(error);
}

export function parseAndroidApkCertificateFingerprint(apksignerOutput: string) {
  const match =
    apksignerOutput.match(/SHA-256 digest:\s*([0-9a-fA-F:\-\s]{64,95})/i) ??
    apksignerOutput.match(/SHA256:\s*([0-9a-fA-F:\-\s]{64,95})/i);
  if (!match) return undefined;
  const fingerprint = normalizeFingerprint(match[1]);
  return SHA256_FINGERPRINT.test(fingerprint) ? fingerprint : undefined;
}

export function validateAndroidReleaseApkSignature(
  env: EnvMap = process.env,
  options: AndroidReleaseApkSignatureOptions = {},
): AndroidReleaseApkSignatureResult {
  const exists = options.exists ?? existsSync;
  const fileSize = options.fileSize ?? ((path: string) => statSync(path).size);
  const runApkSignerVerify = options.runApkSignerVerify ?? ((path: string) => defaultRunApkSignerVerify(path, env));
  const errors: string[] = [];

  const apkPath = candidateApkPaths(env).find((path) => exists(path));
  if (!apkPath) {
    errors.push('ANDROID_RELEASE_APK_PATH or the default app-release.apk path should point to an existing APK.');
    return { ok: false, errors };
  }

  if (!apkPath.endsWith('.apk')) {
    errors.push(`ANDROID_RELEASE_APK_PATH should point to an .apk file: ${apkPath}.`);
  }

  if (fileSize(apkPath) <= 0) {
    errors.push(`Android release APK should be non-empty: ${apkPath}.`);
  }

  const expectedFingerprints = configuredFingerprints(env);
  if (expectedFingerprints.length === 0) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS should include the expected release/upload SHA-256 fingerprint.');
  } else if (expectedFingerprints.some((fingerprint) => !SHA256_FINGERPRINT.test(fingerprint))) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINTS should contain comma-separated SHA-256 fingerprints like AA:BB:...:99.');
  }

  let signerFingerprint: string | undefined;
  try {
    signerFingerprint = parseAndroidApkCertificateFingerprint(runApkSignerVerify(apkPath));
    if (!signerFingerprint) {
      errors.push('apksigner did not report a SHA-256 digest for Android release APK.');
    } else if (expectedFingerprints.length > 0 && !expectedFingerprints.includes(signerFingerprint)) {
      errors.push(`ANDROID_SHA256_CERT_FINGERPRINTS should include signed APK fingerprint ${signerFingerprint}.`);
    }
  } catch (error) {
    errors.push(`apksigner failed to verify Android release APK: ${outputFromError(error)}`);
  }

  return { ok: errors.length === 0, errors, apkPath, signerFingerprint };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateAndroidReleaseApkSignature(process.env);
  if (!result.ok) {
    console.error('Android release APK signature is not ready:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Android release APK signature looks ready.');
  console.log(`APK: ${result.apkPath}`);
  console.log(`Signer SHA-256: ${result.signerFingerprint}`);
}

if (
  process.argv[1]?.endsWith('validate-android-release-apk-signature.ts') ||
  process.argv[1]?.endsWith('validate-android-release-apk-signature.js')
) {
  runCli();
}
