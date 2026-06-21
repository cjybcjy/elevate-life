import { spawnSync } from 'node:child_process';

type RunnerResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
};

type StoreReleaseStatusCheck = {
  stage: string;
  label: string;
  command: string;
};

type StoreReleaseStatusOptions = {
  runner?: (command: string) => RunnerResult;
  log?: (message: string) => void;
};

type StoreReleaseStatusResultItem = StoreReleaseStatusCheck & {
  status: number | null;
  ok: boolean;
  summary: string[];
};

export type StoreReleaseStatusResult = {
  ok: boolean;
  firstFailedStage?: string;
  firstFailedCheck?: StoreReleaseStatusResultItem;
  results: StoreReleaseStatusResultItem[];
};

export const STORE_RELEASE_STATUS_CHECKS: StoreReleaseStatusCheck[] = [
  { stage: '基础资料和仓库链路', label: '发布资料结构', command: 'npm run store:preflight:check' },
  { stage: '基础资料和仓库链路', label: '提交材料脚本', command: 'npm run store:submission:check' },
  { stage: '基础资料和仓库链路', label: '隐私申报底稿', command: 'npm run privacy:check' },
  { stage: '基础资料和仓库链路', label: '审核账号材料', command: 'npm run review:check' },
  { stage: '基础资料和仓库链路', label: '截图工具链', command: 'npm run screenshots:check' },
  { stage: '公网发布环境', label: '发布环境下一步指引', command: 'npm run release:env:next' },
  { stage: '公网发布环境', label: '发布环境草稿', command: 'npm run release:env:draft' },
  { stage: '公网发布环境', label: '发布环境模板', command: 'npm run release:env:template:check' },
  { stage: '公网发布环境', label: '真实发布环境变量', command: 'npm run release:check' },
  { stage: '公网发布环境', label: '线上公开 URL smoke', command: 'npm run release:smoke' },
  { stage: 'Google Play TWA', label: 'TWA 配置', command: 'npm run twa:check' },
  { stage: 'Google Play TWA', label: 'Android 签名下一步指引', command: 'npm run android:signing:next' },
  { stage: 'Google Play TWA', label: 'Android 签名材料', command: 'npm run android:signing:check' },
  { stage: 'Google Play TWA', label: 'Bubblewrap AAB 下一步指引', command: 'npm run twa:artifact:next' },
  { stage: 'Google Play TWA', label: 'Bubblewrap AAB 产物', command: 'npm run twa:artifact:check' },
  { stage: 'Android 国内市场', label: 'Capacitor 基础配置', command: 'npm run mobile:check' },
  { stage: 'Android 国内市场', label: '移动权限审计', command: 'npm run mobile:permissions:check' },
  { stage: 'Android 国内市场', label: 'Capacitor Android release 下一步指引', command: 'npm run android:artifact:next' },
  { stage: 'Android 国内市场', label: 'Capacitor Android release 产物', command: 'npm run android:artifact:check' },
  { stage: 'Android 国内市场', label: 'Android AAB 签名', command: 'npm run android:aab:signature:check' },
  { stage: 'Android 国内市场', label: 'Android APK 签名', command: 'npm run android:apk:signature:check' },
  { stage: 'iOS App Store', label: 'iOS Archive 产物', command: 'npm run ios:archive:check' },
];

function defaultRunner(command: string): RunnerResult {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function summarizeOutput(output: string | undefined) {
  if (!output) return [];

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('> '))
    .filter((line) => !line.startsWith('$ '))
    .map((line) => line.replace(/^-\s+/, ''))
    .slice(0, 6);
}

function summarizeRunResult(runResult: RunnerResult) {
  return [
    ...summarizeOutput(runResult.stderr),
    ...summarizeOutput(runResult.stdout),
  ].slice(0, 6);
}

export function runStoreReleaseStatus(options: StoreReleaseStatusOptions = {}): StoreReleaseStatusResult {
  const runner = options.runner ?? defaultRunner;
  const log = options.log ?? (() => {});
  const results: StoreReleaseStatusResultItem[] = [];

  for (const check of STORE_RELEASE_STATUS_CHECKS) {
    log(`$ ${check.command}`);
    const runResult = runner(check.command);
    results.push({
      ...check,
      status: runResult.status,
      ok: runResult.status === 0,
      summary: runResult.status === 0 ? [] : summarizeRunResult(runResult),
    });
  }

  const firstFailed = results.find((result) => !result.ok);
  return {
    ok: !firstFailed,
    firstFailedStage: firstFailed?.stage,
    firstFailedCheck: firstFailed,
    results,
  };
}

export function formatStoreReleaseStatusReport(result: StoreReleaseStatusResult) {
  const stages = [...new Set(result.results.map((item) => item.stage))];
  const lines = ['# 从易到难上架状态', ''];

  for (const stage of stages) {
    const stageResults = result.results.filter((item) => item.stage === stage);
    const stageOk = stageResults.every((item) => item.ok);
    lines.push(`${stageOk ? 'PASS' : 'FAIL'} ${stage}`);
    for (const item of stageResults) {
      lines.push(`  ${item.ok ? 'PASS' : 'FAIL'} ${item.label} - ${item.command}`);
      for (const line of item.summary) {
        lines.push(`    - ${line}`);
      }
    }
    lines.push('');
  }

  if (result.ok) {
    lines.push('下一步：所有本地状态检查通过，可以按目标市场进入正式后台提交。');
  } else if (result.firstFailedCheck) {
    lines.push(
      `下一步：优先处理「${result.firstFailedCheck.stage}」的「${result.firstFailedCheck.label}」：${result.firstFailedCheck.command}。`,
    );
    if (result.firstFailedCheck.command === 'npm run release:check') {
      lines.push('辅助指引：先运行 npm run release:env:next 查看缺失项和私有 env 草稿。');
    }
  } else {
    lines.push(`下一步：优先处理「${result.firstFailedStage}」。`);
  }

  return lines.join('\n');
}

function runCli() {
  const result = runStoreReleaseStatus({ log: console.log });
  console.log(formatStoreReleaseStatusReport(result));
  if (!result.ok && process.env.STORE_RELEASE_STATUS_STRICT === '1') {
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('store-release-status.ts') || process.argv[1]?.endsWith('store-release-status.js')) {
  runCli();
}
