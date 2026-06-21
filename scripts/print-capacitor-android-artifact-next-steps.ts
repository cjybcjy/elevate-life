import { loadEnvConfig } from '@next/env';
import { validateCapacitorAndroidArtifact } from './validate-capacitor-android-artifact';

type EnvMap = Record<string, string | undefined>;
type FileSystemLike = Parameters<typeof validateCapacitorAndroidArtifact>[1];

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function serverUrl(env: EnvMap) {
  return envValue(env, 'CAPACITOR_SERVER_URL') || envValue(env, 'APP_PUBLIC_BASE_URL') || 'https://<your-production-host>';
}

function appId(env: EnvMap) {
  return envValue(env, 'CAPACITOR_APP_ID') || envValue(env, 'ANDROID_PACKAGE_NAME') || 'com.elevatelife.app';
}

export function buildCapacitorAndroidArtifactNextSteps(
  env: EnvMap = process.env,
  fsLike: FileSystemLike = {},
) {
  const validation = validateCapacitorAndroidArtifact(env, fsLike);
  const projectDir = envValue(env, 'ANDROID_NATIVE_PROJECT_DIR') || validation.projectDir || 'android';
  const nextServerUrl = serverUrl(env);
  const nextAppId = appId(env);
  const aabPath = `${projectDir}/app/build/outputs/bundle/release/app-release.aab`;
  const apkPath = `${projectDir}/app/build/outputs/apk/release/app-release.apk`;
  const lines = [
    '# Capacitor Android artifact next steps',
    '',
    validation.ok
      ? 'Capacitor Android release 产物已通过 android:artifact:check；下一步按目标市场校验 AAB 或 APK 签名。'
      : 'Capacitor Android release 产物还不能用于 Android 国内市场；先处理下面缺失项。',
    '',
    'Prerequisites: release:check, release:smoke, android:signing:check, mobile:check, and mobile:permissions:check should pass before final native build.',
    '',
  ];

  if (!validation.ok) {
    lines.push('Missing or invalid artifact state:');
    for (const error of validation.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  lines.push(
    'Environment starter:',
    `CAPACITOR_SERVER_URL=${nextServerUrl}`,
    `CAPACITOR_APP_ID=${nextAppId}`,
    `ANDROID_PACKAGE_NAME=${nextAppId}`,
    `ANDROID_NATIVE_PROJECT_DIR=${projectDir}`,
    '',
    'Recommended commands:',
    `1. CAPACITOR_SERVER_URL=${nextServerUrl} CAPACITOR_APP_ID=${nextAppId} npm run mobile:sync`,
    `2. cd ${projectDir} && ./gradlew bundleRelease`,
    `3. CAPACITOR_SERVER_URL=${nextServerUrl} CAPACITOR_APP_ID=${nextAppId} ANDROID_NATIVE_PROJECT_DIR=${projectDir} npm run android:artifact:check`,
    `4. ANDROID_RELEASE_BUNDLE_PATH=${aabPath} npm run android:aab:signature:check`,
    `5. If a market requires APK: cd ${projectDir} && ./gradlew assembleRelease`,
    `6. ANDROID_RELEASE_APK_PATH=${apkPath} npm run android:apk:signature:check`,
    '',
    `Expected AAB: ${aabPath}`,
    `Expected APK: ${apkPath}`,
  );

  return `${lines.join('\n')}\n`;
}

function runCli() {
  loadEnvConfig(process.cwd());
  process.stdout.write(buildCapacitorAndroidArtifactNextSteps(process.env));
}

if (
  process.argv[1]?.endsWith('print-capacitor-android-artifact-next-steps.ts') ||
  process.argv[1]?.endsWith('print-capacitor-android-artifact-next-steps.js')
) {
  runCli();
}
