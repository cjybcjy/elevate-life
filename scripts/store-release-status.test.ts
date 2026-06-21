import assert from 'node:assert/strict';
import test from 'node:test';

type StoreReleaseStatusModule = {
  runStoreReleaseStatus?: (options: {
    runner: (command: string) => { status: number | null; stdout?: string; stderr?: string };
    log?: (message: string) => void;
  }) => {
    ok: boolean;
    firstFailedStage?: string;
    firstFailedCheck?: {
      stage: string;
      label: string;
      command: string;
      status: number | null;
      ok: boolean;
      summary: string[];
    };
    results: Array<{
      stage: string;
      label: string;
      command: string;
      status: number | null;
      ok: boolean;
      summary: string[];
    }>;
  };
  formatStoreReleaseStatusReport?: (result: {
    ok: boolean;
    firstFailedStage?: string;
    results: Array<{
      stage: string;
      label: string;
      command: string;
      status: number | null;
      ok: boolean;
      summary: string[];
    }>;
  }) => string;
};

async function loadSubject(): Promise<StoreReleaseStatusModule> {
  try {
    return await import('./store-release-status');
  } catch {
    return {};
  }
}

test('runStoreReleaseStatus runs every check from easy to hard and reports the first blocking stage', async () => {
  const { runStoreReleaseStatus, formatStoreReleaseStatusReport } = await loadSubject();
  assert.equal(typeof runStoreReleaseStatus, 'function');
  assert.equal(typeof formatStoreReleaseStatusReport, 'function');
  const runStatus = runStoreReleaseStatus as NonNullable<StoreReleaseStatusModule['runStoreReleaseStatus']>;
  const formatReport = formatStoreReleaseStatusReport as NonNullable<
    StoreReleaseStatusModule['formatStoreReleaseStatusReport']
  >;

  const calls: string[] = [];
  const result = runStatus({
    runner(command) {
      calls.push(command);
      return {
        status: command.includes('release:check') || command.includes('twa:artifact:check') ? 1 : 0,
        stderr: command.includes('release:check') ? 'APP_PUBLIC_BASE_URL missing' : '',
      };
    },
    log: () => {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.firstFailedStage, '公网发布环境');
  assert.equal(result.firstFailedCheck?.label, '真实发布环境变量');
  assert.equal(result.firstFailedCheck?.command, 'npm run release:check');
  assert(calls.length > 8, 'status should keep running later market checks after the first failure');
  assert(calls.includes('npm run release:env:next'), 'status should print release env next steps before strict checks');
  assert(calls.includes('npm run release:env:draft'), 'status should generate a release env draft before strict checks');
  assert(calls.includes('npm run release:env:template:check'), 'status should verify release env template readiness');
  assert(
    calls.indexOf('npm run release:env:next') < calls.indexOf('npm run release:check') &&
      calls.indexOf('npm run release:env:draft') < calls.indexOf('npm run release:check') &&
      calls.indexOf('npm run release:env:template:check') < calls.indexOf('npm run release:check'),
    'release env next/draft/template checks should run before strict release:check',
  );
  assert(calls.some((command) => command.includes('twa:artifact:check')));
  assert(calls.some((command) => command.includes('ios:archive:check')));
  assert(calls.includes('npm run twa:artifact:next'), 'status should print TWA artifact next steps before artifact checks');
  assert(
    calls.indexOf('npm run twa:artifact:next') < calls.indexOf('npm run twa:artifact:check'),
    'TWA artifact next steps should run before strict TWA artifact check',
  );
  assert(calls.includes('npm run android:artifact:next'), 'status should print Capacitor Android artifact next steps before artifact checks');
  assert(
    calls.indexOf('npm run android:artifact:next') < calls.indexOf('npm run android:artifact:check'),
    'Capacitor Android artifact next steps should run before strict artifact check',
  );
  assert(calls.includes('npm run android:signing:next'), 'status should print Android signing next steps before signing checks');
  assert(
    calls.indexOf('npm run android:signing:next') < calls.indexOf('npm run android:signing:check'),
    'Android signing next steps should run before strict signing check',
  );

  const report = formatReport(result);
  assert(report.includes('从易到难上架状态'));
  assert(report.includes('PASS 基础资料和仓库链路'));
  assert(report.includes('FAIL 公网发布环境'));
  assert(report.includes('发布环境下一步指引'));
  assert(report.includes('发布环境草稿'));
  assert(report.includes('发布环境模板'));
  assert(report.includes('Android 签名下一步指引'));
  assert(report.includes('Bubblewrap AAB 下一步指引'));
  assert(report.includes('Capacitor Android release 下一步指引'));
  assert(report.includes('APP_PUBLIC_BASE_URL missing'));
  assert(
    report.includes('下一步：优先处理「公网发布环境」的「真实发布环境变量」：npm run release:check。'),
  );
  assert(report.includes('辅助指引：先运行 npm run release:env:next 查看缺失项和私有 env 草稿。'));
});
