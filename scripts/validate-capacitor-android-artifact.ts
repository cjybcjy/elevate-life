import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type FileSystemLike = {
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
  fileSize?: (path: string) => number;
  fileMtimeMs?: (path: string) => number;
};

type CapacitorAndroidArtifactResult = {
  ok: boolean;
  errors: string[];
  artifactPath?: string;
  projectDir: string;
};

type CapacitorNativeConfig = {
  appId?: unknown;
  server?: {
    url?: unknown;
    cleartext?: unknown;
  };
};

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasGradleStringValue(source: string, key: 'applicationId' | 'namespace', expected: string) {
  const expectedPattern = escapeRegExp(expected);
  return new RegExp(`\\b${key}\\b\\s*(?:=\\s*)?["']${expectedPattern}["']`).test(source);
}

function candidateGradlePaths(projectDir: string) {
  return [join(projectDir, 'app', 'build.gradle'), join(projectDir, 'app', 'build.gradle.kts')];
}

function candidateArtifactPaths(projectDir: string) {
  return [
    join(projectDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
    join(projectDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    join(projectDir, 'app', 'release', 'app-release.aab'),
    join(projectDir, 'app', 'release', 'app-release.apk'),
  ];
}

export function validateCapacitorAndroidArtifact(
  env: EnvMap = process.env,
  fsLike: FileSystemLike = {},
): CapacitorAndroidArtifactResult {
  const exists = fsLike.exists ?? existsSync;
  const readText = fsLike.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const fileSize = fsLike.fileSize ?? ((path: string) => statSync(path).size);
  const fileMtimeMs = fsLike.fileMtimeMs ?? ((path: string) => statSync(path).mtimeMs);
  const errors: string[] = [];

  const projectDir = envValue(env, 'ANDROID_NATIVE_PROJECT_DIR') || 'android';
  const expectedAppId = envValue(env, 'CAPACITOR_APP_ID') || envValue(env, 'ANDROID_PACKAGE_NAME');
  const expectedServerUrl = normalizeUrl(envValue(env, 'CAPACITOR_SERVER_URL'));

  if (!expectedAppId) {
    errors.push('CAPACITOR_APP_ID should be set before validating a Capacitor Android release artifact.');
  }
  if (!expectedServerUrl) {
    errors.push('CAPACITOR_SERVER_URL should be set before validating a Capacitor Android release artifact.');
  } else if (!expectedServerUrl.startsWith('https://')) {
    errors.push('CAPACITOR_SERVER_URL should be a production HTTPS URL.');
  }

  const gradlePath = candidateGradlePaths(projectDir).find((path) => exists(path));
  if (!gradlePath) {
    errors.push(`Android Gradle build file should exist at ${join(projectDir, 'app', 'build.gradle')}.`);
  }

  const manifestPath = join(projectDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!exists(manifestPath)) {
    errors.push(`AndroidManifest.xml should exist at ${manifestPath}.`);
  }

  const nativeConfigPath = join(projectDir, 'app', 'src', 'main', 'assets', 'capacitor.config.json');
  if (!exists(nativeConfigPath)) {
    errors.push(`capacitor.config.json should exist at ${nativeConfigPath} after npm run mobile:sync.`);
  }

  const artifactPath = candidateArtifactPaths(projectDir).find((path) => exists(path));
  if (!artifactPath) {
    errors.push(`release APK or AAB should exist under ${projectDir}/app/build/outputs after a release build.`);
  } else if (fileSize(artifactPath) <= 0) {
    errors.push(`release APK or AAB should be non-empty: ${artifactPath}.`);
  }

  if (gradlePath && expectedAppId) {
    const gradleSource = readText(gradlePath);
    if (!hasGradleStringValue(gradleSource, 'applicationId', expectedAppId)) {
      errors.push(`Android Gradle applicationId should equal CAPACITOR_APP_ID (${expectedAppId}).`);
    }
    if (!hasGradleStringValue(gradleSource, 'namespace', expectedAppId)) {
      errors.push(`Android Gradle namespace should equal CAPACITOR_APP_ID (${expectedAppId}).`);
    }
  }

  if (exists(nativeConfigPath)) {
    let nativeConfig: CapacitorNativeConfig | undefined;
    try {
      nativeConfig = JSON.parse(readText(nativeConfigPath)) as CapacitorNativeConfig;
    } catch {
      errors.push(`capacitor.config.json should be valid JSON at ${nativeConfigPath}.`);
    }

    if (nativeConfig && expectedAppId && nativeConfig.appId !== expectedAppId) {
      errors.push(`capacitor.config.json appId should equal CAPACITOR_APP_ID (${expectedAppId}).`);
    }

    if (nativeConfig && expectedServerUrl) {
      const actualServerUrl =
        typeof nativeConfig.server?.url === 'string' ? normalizeUrl(nativeConfig.server.url) : '';
      if (actualServerUrl !== expectedServerUrl) {
        errors.push(`capacitor.config.json server.url should equal CAPACITOR_SERVER_URL (${expectedServerUrl}).`);
      }
      if (nativeConfig.server?.cleartext !== false) {
        errors.push('capacitor.config.json server.cleartext should be false for store release builds.');
      }
    }
  }

  if (artifactPath && exists(nativeConfigPath)) {
    const artifactMtimeMs = fileMtimeMs(artifactPath);
    const nativeConfigMtimeMs = fileMtimeMs(nativeConfigPath);
    if (artifactMtimeMs < nativeConfigMtimeMs) {
      errors.push(
        `release artifact should be rebuilt after the latest native sync: ${artifactPath} is older than ${nativeConfigPath}.`,
      );
    }
  }

  return { ok: errors.length === 0, errors, artifactPath, projectDir };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateCapacitorAndroidArtifact(process.env);
  if (!result.ok) {
    console.error('Capacitor Android release artifact is not ready:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Capacitor Android release artifact looks ready.');
  console.log(`Project: ${result.projectDir}`);
  console.log(`Artifact: ${result.artifactPath}`);
}

if (
  process.argv[1]?.endsWith('validate-capacitor-android-artifact.ts') ||
  process.argv[1]?.endsWith('validate-capacitor-android-artifact.js')
) {
  runCli();
}
