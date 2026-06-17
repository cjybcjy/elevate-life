import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';

type EnvMap = Record<string, string | undefined>;

type FileSystemLike = {
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
};

type MobilePermissionResult = {
  ok: boolean;
  errors: string[];
  androidManifestPath: string;
  iosInfoPlistPath: string;
  androidPermissions: string[];
  iosUsageKeys: string[];
};

export const DEFAULT_ALLOWED_ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
];

export const SENSITIVE_ANDROID_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.GET_ACCOUNTS',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.CALL_PHONE',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.POST_NOTIFICATIONS',
];

export const SENSITIVE_IOS_USAGE_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSContactsUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  'NSUserTrackingUsageDescription',
  'NSCalendarsUsageDescription',
  'NSRemindersUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSSpeechRecognitionUsageDescription',
  'NSMotionUsageDescription',
  'NSFaceIDUsageDescription',
];

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function envList(env: EnvMap, key: string) {
  return envValue(env, key)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function extractAndroidPermissions(source: string) {
  const matches = source.matchAll(/<uses-permission(?:-sdk-\d+)?\b[^>]*android:name=["']([^"']+)["'][^>]*>/g);
  return unique(Array.from(matches, (match) => match[1]));
}

function extractIosUsageKeys(source: string) {
  const matches = source.matchAll(/<key>\s*([^<]+UsageDescription|NSUserTrackingUsageDescription)\s*<\/key>/g);
  return unique(Array.from(matches, (match) => match[1]));
}

export function validateMobilePermissions(env: EnvMap = process.env, fsLike: FileSystemLike = {}): MobilePermissionResult {
  const exists = fsLike.exists ?? existsSync;
  const readText = fsLike.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const errors: string[] = [];

  const androidProjectDir = envValue(env, 'ANDROID_NATIVE_PROJECT_DIR') || 'android';
  const iosProjectDir = envValue(env, 'IOS_NATIVE_PROJECT_DIR') || 'ios';
  const androidManifestPath = join(androidProjectDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  const iosInfoPlistPath = join(iosProjectDir, 'App', 'App', 'Info.plist');
  const allowedAndroidPermissions = unique([
    ...DEFAULT_ALLOWED_ANDROID_PERMISSIONS,
    ...envList(env, 'MOBILE_ALLOWED_ANDROID_PERMISSIONS'),
  ]);
  const allowedIosUsageKeys = envList(env, 'MOBILE_ALLOWED_IOS_USAGE_KEYS');

  let androidPermissions: string[] = [];
  let iosUsageKeys: string[] = [];

  if (!exists(androidManifestPath)) {
    errors.push(`AndroidManifest.xml should exist at ${androidManifestPath} after generating the Android project.`);
  } else {
    androidPermissions = extractAndroidPermissions(readText(androidManifestPath));
    for (const permission of androidPermissions) {
      if (!allowedAndroidPermissions.includes(permission)) {
        const sensitivity = SENSITIVE_ANDROID_PERMISSIONS.includes(permission) ? ' sensitive' : '';
        errors.push(`Unexpected${sensitivity} Android permission found: ${permission}.`);
      }
    }
  }

  if (!exists(iosInfoPlistPath)) {
    errors.push(`Info.plist should exist at ${iosInfoPlistPath} after generating the iOS project.`);
  } else {
    iosUsageKeys = extractIosUsageKeys(readText(iosInfoPlistPath));
    for (const key of iosUsageKeys) {
      if (!allowedIosUsageKeys.includes(key)) {
        const sensitivity = SENSITIVE_IOS_USAGE_KEYS.includes(key) ? ' sensitive' : '';
        errors.push(`Unexpected${sensitivity} iOS usage description key found: ${key}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    androidManifestPath,
    iosInfoPlistPath,
    androidPermissions,
    iosUsageKeys,
  };
}

function runCli() {
  loadEnvConfig(process.cwd());
  const result = validateMobilePermissions(process.env);
  if (!result.ok) {
    console.error('Mobile native permissions are not ready for store review:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Mobile native permissions look store-safe.');
  console.log(`Android Manifest: ${result.androidManifestPath}`);
  console.log(`Android permissions: ${result.androidPermissions.join(', ') || '(none)'}`);
  console.log(`iOS Info.plist: ${result.iosInfoPlistPath}`);
  console.log(`iOS usage keys: ${result.iosUsageKeys.join(', ') || '(none)'}`);
}

if (
  process.argv[1]?.endsWith('validate-mobile-permissions.ts') ||
  process.argv[1]?.endsWith('validate-mobile-permissions.js')
) {
  runCli();
}
