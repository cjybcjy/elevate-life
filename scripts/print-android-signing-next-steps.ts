import { loadEnvConfig } from '@next/env';
import { validateAndroidSigningConfig } from './validate-android-signing';

type EnvMap = Record<string, string | undefined>;

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function displayValue(env: EnvMap, key: string, fallback: string) {
  const value = envValue(env, key);
  return value || fallback;
}

export function buildAndroidSigningNextSteps(env: EnvMap = process.env) {
  const validation = validateAndroidSigningConfig(env);
  const keystorePath = displayValue(env, 'TWA_SIGNING_KEY_PATH', '/secure/path/elevate-life-upload.jks');
  const alias = displayValue(env, 'TWA_SIGNING_KEY_ALIAS', 'elevate-life');
  const lines = [
    '# Android signing next steps',
    '',
    validation.ok
      ? 'Android 签名环境已通过 android:signing:check；下一步生成 AAB/APK 后继续做产物签名校验。'
      : 'Android 签名材料还不能用于 Google Play TWA 或 Android 国内市场包；先处理下面缺失项。',
    '',
    'Private target: local shell exports, CI secret manager, or a private .env.production.local.',
    '不要提交 keystore、.jks、密码、填好后的 secret 文件或正式安装包。',
    '',
  ];

  if (!validation.ok) {
    lines.push('Missing or invalid values:');
    for (const error of validation.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  lines.push(
    'Generate or inspect upload keystore:',
    `keytool -genkeypair -v -keystore ${keystorePath} -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000`,
    `keytool -list -v -keystore ${keystorePath} -alias ${alias}`,
    '',
    'Private env starter:',
    `TWA_SIGNING_KEY_PATH=${keystorePath}`,
    `TWA_SIGNING_KEY_ALIAS=${alias}`,
    'ANDROID_KEYSTORE_STORE_PASSWORD=',
    'ANDROID_KEYSTORE_KEY_PASSWORD=',
    'ANDROID_SHA256_CERT_FINGERPRINTS=',
    '',
    'Recommended commands:',
    '1. Fill the private env values above and keep them out of git.',
    '2. npm run android:signing:check',
    '3. npm run android:aab:fingerprint after building the final AAB.',
    '4. Add both upload-key and Play App Signing SHA-256 fingerprints to ANDROID_SHA256_CERT_FINGERPRINTS.',
    '5. npm run android:aab:signature:check',
  );

  return `${lines.join('\n')}\n`;
}

function runCli() {
  loadEnvConfig(process.cwd());
  process.stdout.write(buildAndroidSigningNextSteps(process.env));
}

if (
  process.argv[1]?.endsWith('print-android-signing-next-steps.ts') ||
  process.argv[1]?.endsWith('print-android-signing-next-steps.js')
) {
  runCli();
}
