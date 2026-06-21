import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { parseAndroidBundleCertificateFingerprint } from './validate-android-release-bundle-signature';

type EnvMap = Record<string, string | undefined>;

type AndroidAabFingerprintOptions = {
  exists?: (path: string) => boolean;
  runKeytoolPrintCert?: (path: string) => string;
};

type AndroidAabFingerprintReport = {
  ok: boolean;
  errors: string[];
  bundlePath?: string;
  signerFingerprint?: string;
  envLine?: string;
};

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function candidateBundlePaths(env: EnvMap) {
  const explicitPath = envValue(env, 'ANDROID_RELEASE_BUNDLE_PATH');
  if (explicitPath) return [explicitPath];

  const projectDir = envValue(env, 'ANDROID_NATIVE_PROJECT_DIR') || 'android';
  return [
    join(projectDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
    join(projectDir, 'app', 'release', 'app-release.aab'),
  ];
}

function defaultRunKeytoolPrintCert(bundlePath: string) {
  return execFileSync('keytool', ['-printcert', '-jarfile', bundlePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

export function buildAndroidAabFingerprintReport(
  env: EnvMap = process.env,
  options: AndroidAabFingerprintOptions = {},
): AndroidAabFingerprintReport {
  const exists = options.exists ?? existsSync;
  const runKeytoolPrintCert = options.runKeytoolPrintCert ?? defaultRunKeytoolPrintCert;
  const errors: string[] = [];
  const bundlePath = candidateBundlePaths(env).find((path) => exists(path));

  if (!bundlePath) {
    errors.push('ANDROID_RELEASE_BUNDLE_PATH or the default app-release.aab path should point to an existing AAB.');
    return { ok: false, errors };
  }

  if (!bundlePath.endsWith('.aab')) {
    errors.push(`ANDROID_RELEASE_BUNDLE_PATH should point to an .aab file: ${bundlePath}.`);
  }

  let signerFingerprint: string | undefined;
  try {
    signerFingerprint = parseAndroidBundleCertificateFingerprint(runKeytoolPrintCert(bundlePath));
  } catch (error) {
    errors.push(`keytool failed to inspect Android release AAB certificate: ${outputFromError(error)}`);
  }

  if (!signerFingerprint) {
    errors.push('keytool did not report a SHA256 certificate fingerprint for Android release AAB.');
  }

  return {
    ok: errors.length === 0,
    errors,
    bundlePath,
    signerFingerprint,
    envLine: signerFingerprint ? `ANDROID_SHA256_CERT_FINGERPRINTS=${signerFingerprint}` : undefined,
  };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const report = buildAndroidAabFingerprintReport(process.env);
  if (!report.ok) {
    console.error('Android release AAB fingerprint could not be exported:');
    for (const error of report.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`AAB: ${report.bundlePath}`);
  console.log(`Signer SHA-256: ${report.signerFingerprint}`);
  console.log(report.envLine);
  console.log('Copy this env line into your release environment, alongside any Play App Signing SHA-256 fingerprint.');
}

if (
  process.argv[1]?.endsWith('print-android-aab-fingerprint.ts') ||
  process.argv[1]?.endsWith('print-android-aab-fingerprint.js')
) {
  runCli();
}
