import { loadEnvConfig } from '@next/env';
import { buildStoreReleaseEnvDraft } from './print-store-release-env-draft';
import { validateReleaseEnv } from './validate-release-env';

type EnvMap = Record<string, string | undefined>;

export function buildReleaseEnvNextSteps(env: EnvMap = process.env) {
  const validation = validateReleaseEnv(env);
  const draft = buildStoreReleaseEnvDraft(env);
  const lines = [
    '# Release environment next steps',
    '',
    validation.ok
      ? '当前发布环境变量已通过 release:check；下一步部署后运行 npm run release:smoke。'
      : '当前发布环境变量还不能用于商店打包；先把下面缺失项填到私有环境里。',
    '',
    'Private target: .env.production.local, local shell exports, or CI secret manager.',
    '不要提交填好后的文件；真实域名、邮箱、keystore 密码和审核账号密码都按 secret 处理。',
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
    'Recommended commands:',
    '1. npm run release:env:draft > /tmp/elevate-life-release.env',
    '2. Copy the draft into .env.production.local or your CI secret manager, then replace placeholders.',
    '3. npm run release:check',
    '4. npm run release:smoke',
    '',
    '# Draft starter',
    draft.content.trimEnd(),
  );

  if (draft.warnings.length > 0) {
    lines.push('', '# Draft warnings');
    for (const warning of draft.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function runCli() {
  loadEnvConfig(process.cwd());
  process.stdout.write(buildReleaseEnvNextSteps(process.env));
}

if (
  process.argv[1]?.endsWith('print-release-env-next-steps.ts') ||
  process.argv[1]?.endsWith('print-release-env-next-steps.js')
) {
  runCli();
}
