import { loadEnvConfig } from '@next/env';
import { validateTwaBuildArtifact } from './validate-twa-build-artifact';

type EnvMap = Record<string, string | undefined>;
type FileSystemLike = Parameters<typeof validateTwaBuildArtifact>[1];

function envValue(env: EnvMap, key: string) {
  return (env[key] || '').trim();
}

function publicManifestUrl(env: EnvMap) {
  const explicit = envValue(env, 'TWA_MANIFEST_URL');
  if (explicit) return explicit;
  const baseUrl = envValue(env, 'APP_PUBLIC_BASE_URL');
  if (!baseUrl) return 'https://<your-production-host>/manifest.webmanifest';
  try {
    return new URL('/manifest.webmanifest', baseUrl).toString();
  } catch {
    return 'https://<your-production-host>/manifest.webmanifest';
  }
}

export function buildTwaArtifactNextSteps(env: EnvMap = process.env, fsLike: FileSystemLike = {}) {
  const validation = validateTwaBuildArtifact(env, fsLike);
  const outputDir = envValue(env, 'TWA_OUTPUT_DIR') || 'android-twa';
  const manifestUrl = publicManifestUrl(env);
  const aabPath = `${outputDir}/app-release-bundle.aab`;
  const lines = [
    '# Google Play TWA artifact next steps',
    '',
    validation.ok
      ? 'Google Play TWA 产物已通过 twa:artifact:check；下一步校验准备上传的 AAB 签名。'
      : 'Google Play TWA 产物还不能上传 Play Console；先处理下面缺失项。',
    '',
    'Prerequisites: release:check, release:smoke, twa:check, and android:signing:check should pass before final Bubblewrap build.',
    '',
  ];

  if (!validation.ok) {
    lines.push('Missing or invalid artifacts:');
    for (const error of validation.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  lines.push(
    'Environment starter:',
    `TWA_MANIFEST_URL=${manifestUrl}`,
    `TWA_OUTPUT_DIR=${outputDir}`,
    '',
    'Recommended commands:',
    `1. TWA_MANIFEST_URL=${manifestUrl} TWA_OUTPUT_DIR=${outputDir} npm run twa:init`,
    `2. TWA_MANIFEST_URL=${manifestUrl} TWA_OUTPUT_DIR=${outputDir} npm run twa:update`,
    `3. TWA_MANIFEST_URL=${manifestUrl} TWA_OUTPUT_DIR=${outputDir} npm run twa:build`,
    `4. TWA_OUTPUT_DIR=${outputDir} npm run twa:artifact:check`,
    `5. ANDROID_RELEASE_BUNDLE_PATH=${aabPath} npm run android:aab:signature:check`,
    '',
    `Expected outputs: ${outputDir}/twa-manifest.json and ${aabPath}`,
  );

  return `${lines.join('\n')}\n`;
}

function runCli() {
  loadEnvConfig(process.cwd());
  process.stdout.write(buildTwaArtifactNextSteps(process.env));
}

if (
  process.argv[1]?.endsWith('print-twa-artifact-next-steps.ts') ||
  process.argv[1]?.endsWith('print-twa-artifact-next-steps.js')
) {
  runCli();
}
