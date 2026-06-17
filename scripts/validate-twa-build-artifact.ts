import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type FileSystemLike = {
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
  fileSize?: (path: string) => number;
};

type TwaBuildArtifactResult = {
  ok: boolean;
  errors: string[];
  aabPath?: string;
  manifestPath?: string;
};

type TwaManifest = {
  packageId?: unknown;
  host?: unknown;
  webManifestUrl?: unknown;
  startUrl?: unknown;
  display?: unknown;
  signingKey?: {
    path?: unknown;
    alias?: unknown;
  };
  fingerprints?: unknown;
};

const SHA256_FINGERPRINT = /^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i;

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function normalizeFingerprint(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, ':')
    .toUpperCase();
}

function expectedHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
  }
}

function expectedManifestUrl(env: EnvMap) {
  const explicit = envValue(env, 'TWA_MANIFEST_URL');
  if (explicit) return explicit;
  const baseUrl = envValue(env, 'APP_PUBLIC_BASE_URL');
  return baseUrl ? new URL('/manifest.webmanifest', baseUrl).toString() : '';
}

function candidateAabPaths(outputDir: string) {
  return [
    join(outputDir, 'app-release-bundle.aab'),
    join(outputDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
    join(outputDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release-bundle.aab'),
  ];
}

export function validateTwaBuildArtifact(
  env: EnvMap = process.env,
  fsLike: FileSystemLike = {},
): TwaBuildArtifactResult {
  const exists = fsLike.exists ?? existsSync;
  const readText = fsLike.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const fileSize = fsLike.fileSize ?? ((path: string) => statSync(path).size);
  const errors: string[] = [];

  const outputDir = envValue(env, 'TWA_OUTPUT_DIR') || 'android-twa';
  const manifestPath = join(outputDir, 'twa-manifest.json');
  if (!exists(manifestPath)) {
    errors.push(`twa-manifest.json should exist at ${manifestPath}.`);
  }

  let manifest: TwaManifest | undefined;
  if (exists(manifestPath)) {
    try {
      manifest = JSON.parse(readText(manifestPath)) as TwaManifest;
    } catch {
      errors.push(`twa-manifest.json should be valid JSON at ${manifestPath}.`);
    }
  }

  const aabPath = candidateAabPaths(outputDir).find((path) => exists(path));
  if (!aabPath) {
    errors.push(`app-release-bundle.aab should exist in ${outputDir} after bubblewrap build.`);
  } else if (fileSize(aabPath) <= 0) {
    errors.push(`app-release-bundle.aab should be non-empty: ${aabPath}.`);
  }

  if (manifest) {
    const expectedPackage = envValue(env, 'ANDROID_PACKAGE_NAME');
    if (manifest.packageId !== expectedPackage) {
      errors.push(`twa-manifest.json packageId should equal ANDROID_PACKAGE_NAME (${expectedPackage}).`);
    }

    const host = expectedHost(envValue(env, 'APP_PUBLIC_BASE_URL'));
    if (host && manifest.host !== host) {
      errors.push(`twa-manifest.json host should equal APP_PUBLIC_BASE_URL host (${host}).`);
    }

    const manifestUrl = expectedManifestUrl(env);
    if (manifest.webManifestUrl !== manifestUrl) {
      errors.push(`twa-manifest.json webManifestUrl should equal TWA_MANIFEST_URL (${manifestUrl}).`);
    }

    if (manifest.startUrl !== '/') {
      errors.push('twa-manifest.json startUrl should be /.');
    }

    if (manifest.display !== 'standalone') {
      errors.push('twa-manifest.json display should be standalone.');
    }

    const expectedKeyPath = envValue(env, 'TWA_SIGNING_KEY_PATH');
    const expectedKeyAlias = envValue(env, 'TWA_SIGNING_KEY_ALIAS');
    if (manifest.signingKey?.path !== expectedKeyPath) {
      errors.push('twa-manifest.json signingKey.path should equal TWA_SIGNING_KEY_PATH.');
    }
    if (manifest.signingKey?.alias !== expectedKeyAlias) {
      errors.push('twa-manifest.json signingKey.alias should equal TWA_SIGNING_KEY_ALIAS.');
    }

    const expectedFingerprints = envValue(env, 'ANDROID_SHA256_CERT_FINGERPRINTS')
      .split(',')
      .map(normalizeFingerprint)
      .filter(Boolean);
    const manifestFingerprints = Array.isArray(manifest.fingerprints)
      ? manifest.fingerprints.map((item) => normalizeFingerprint(String(item)))
      : [];
    if (manifestFingerprints.length === 0) {
      errors.push('twa-manifest.json fingerprints should include ANDROID_SHA256_CERT_FINGERPRINTS.');
    }
    for (const fingerprint of expectedFingerprints) {
      if (!SHA256_FINGERPRINT.test(fingerprint) || !manifestFingerprints.includes(fingerprint)) {
        errors.push(`twa-manifest.json fingerprints should include ${fingerprint}.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, aabPath, manifestPath };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateTwaBuildArtifact(process.env);
  if (!result.ok) {
    console.error('Google Play TWA build artifact is not ready:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Google Play TWA build artifact looks ready.');
  console.log(`AAB: ${result.aabPath}`);
  console.log(`TWA manifest: ${result.manifestPath}`);
}

if (process.argv[1]?.endsWith('validate-twa-build-artifact.ts') || process.argv[1]?.endsWith('validate-twa-build-artifact.js')) {
  runCli();
}
