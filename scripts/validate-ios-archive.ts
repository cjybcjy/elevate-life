import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type FileSystemLike = {
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
};

type IosArchiveResult = {
  ok: boolean;
  errors: string[];
  archivePath: string;
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

function hasBundleIdentifier(source: string, expected: string) {
  const expectedPattern = escapeRegExp(expected);
  return new RegExp(`PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*["']?${expectedPattern}["']?\\s*;`).test(source);
}

function hasArchivedBundleIdentifier(source: string, expected: string) {
  const expectedPattern = escapeRegExp(expected);
  return new RegExp(`<key>\\s*CFBundleIdentifier\\s*</key>\\s*<string>\\s*${expectedPattern}\\s*</string>`).test(
    source,
  );
}

function allowsArbitraryLoads(source: string) {
  return /<key>\s*NSAllowsArbitraryLoads\s*<\/key>\s*<true\s*\/>/i.test(source);
}

export function validateIosArchive(env: EnvMap = process.env, fsLike: FileSystemLike = {}): IosArchiveResult {
  const exists = fsLike.exists ?? existsSync;
  const readText = fsLike.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const errors: string[] = [];

  const projectDir = envValue(env, 'IOS_NATIVE_PROJECT_DIR') || 'ios';
  const archivePath = envValue(env, 'IOS_ARCHIVE_PATH') || join(projectDir, 'build', 'ElevateLife.xcarchive');
  const archiveAppName = envValue(env, 'IOS_ARCHIVE_APP_NAME') || 'App.app';
  const expectedAppId = envValue(env, 'CAPACITOR_APP_ID');
  const expectedServerUrl = normalizeUrl(envValue(env, 'CAPACITOR_SERVER_URL'));

  if (!expectedAppId) {
    errors.push('CAPACITOR_APP_ID should be set before validating an iOS archive.');
  }
  if (!expectedServerUrl) {
    errors.push('CAPACITOR_SERVER_URL should be set before validating an iOS archive.');
  } else if (!expectedServerUrl.startsWith('https://')) {
    errors.push('CAPACITOR_SERVER_URL should be a production HTTPS URL.');
  }

  const pbxprojPath = join(projectDir, 'App', 'App.xcodeproj', 'project.pbxproj');
  if (!exists(pbxprojPath)) {
    errors.push(`Xcode project file should exist at ${pbxprojPath}.`);
  }

  const appInfoPath = join(projectDir, 'App', 'App', 'Info.plist');
  if (!exists(appInfoPath)) {
    errors.push(`Info.plist should exist at ${appInfoPath}.`);
  }

  const nativeConfigPath = join(projectDir, 'App', 'App', 'capacitor.config.json');
  if (!exists(nativeConfigPath)) {
    errors.push(`capacitor.config.json should exist at ${nativeConfigPath} after npm run mobile:sync.`);
  }

  if (!exists(archivePath)) {
    errors.push(`iOS archive should exist at ${archivePath} after Xcode Product > Archive.`);
  }

  const archiveInfoPath = join(archivePath, 'Info.plist');
  if (!exists(archiveInfoPath)) {
    errors.push(`.xcarchive Info.plist should exist at ${archiveInfoPath}.`);
  }

  const archivedAppInfoPath = join(archivePath, 'Products', 'Applications', archiveAppName, 'Info.plist');
  if (!exists(archivedAppInfoPath)) {
    errors.push(`archived App Info.plist should exist at ${archivedAppInfoPath}.`);
  }

  if (exists(pbxprojPath) && expectedAppId) {
    const pbxprojSource = readText(pbxprojPath);
    if (!hasBundleIdentifier(pbxprojSource, expectedAppId)) {
      errors.push(`Xcode PRODUCT_BUNDLE_IDENTIFIER should equal CAPACITOR_APP_ID (${expectedAppId}).`);
    }
  }

  if (exists(appInfoPath)) {
    const appInfoSource = readText(appInfoPath);
    if (allowsArbitraryLoads(appInfoSource)) {
      errors.push('Info.plist should not set NSAllowsArbitraryLoads=true for App Store release builds.');
    }
  }

  if (exists(archivedAppInfoPath) && expectedAppId) {
    const archivedAppInfoSource = readText(archivedAppInfoPath);
    if (!hasArchivedBundleIdentifier(archivedAppInfoSource, expectedAppId)) {
      errors.push(`archived App CFBundleIdentifier should equal CAPACITOR_APP_ID (${expectedAppId}).`);
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
        errors.push('capacitor.config.json server.cleartext should be false for App Store release builds.');
      }
    }
  }

  return { ok: errors.length === 0, errors, archivePath, projectDir };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateIosArchive(process.env);
  if (!result.ok) {
    console.error('iOS archive is not ready for App Store submission:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('iOS archive looks ready for App Store submission checks.');
  console.log(`Project: ${result.projectDir}`);
  console.log(`Archive: ${result.archivePath}`);
}

if (process.argv[1]?.endsWith('validate-ios-archive.ts') || process.argv[1]?.endsWith('validate-ios-archive.js')) {
  runCli();
}
