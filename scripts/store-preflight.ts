import { spawnSync } from 'node:child_process';

type RunnerResult = {
  status: number | null;
};

type PreflightCheck = {
  label: string;
  command: string;
};

type PreflightFailure = {
  label: string;
  command: string;
  status: number | null;
};

type PreflightOptions = {
  includeBuild?: boolean;
  runner?: (command: string) => RunnerResult;
  log?: (message: string) => void;
};

type PreflightResult = {
  ok: boolean;
  failures: PreflightFailure[];
};

export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  {
    label: 'Store release structure',
    command: 'npx tsx scripts/check-store-release-readiness.ts',
  },
  {
    label: 'Public compliance pages',
    command: 'npx tsx scripts/check-public-compliance-pages.ts',
  },
  {
    label: 'Legal consent gate',
    command: 'npx tsx scripts/check-legal-consent-gate.ts',
  },
  {
    label: 'Privacy and data safety materials',
    command: 'npx tsx scripts/check-market-privacy-readiness.ts',
  },
  {
    label: 'Review account materials',
    command: 'npx tsx scripts/check-review-account-readiness.ts',
  },
  {
    label: 'Store screenshot workflow',
    command: 'npx tsx scripts/check-store-screenshot-readiness.ts',
  },
  {
    label: 'Store submission package readiness',
    command: 'npx tsx scripts/check-store-submission-package-readiness.ts',
  },
  {
    label: 'Release environment validator',
    command: 'npx tsx scripts/check-release-environment-readiness.ts',
  },
  {
    label: 'Release environment template',
    command: 'npx tsx scripts/check-store-release-env-template-readiness.ts',
  },
  {
    label: 'Deployed smoke-test validator',
    command: 'npx tsx scripts/check-deployed-store-smoke-readiness.ts',
  },
  {
    label: 'Digital Asset Links route',
    command: 'npx tsx scripts/check-digital-asset-links-route.ts',
  },
  {
    label: 'Android signing validator',
    command: 'npx tsx scripts/check-android-signing-readiness.ts',
  },
  {
    label: 'Android APK signature validator',
    command: 'npx tsx scripts/check-android-release-apk-signature-readiness.ts',
  },
  {
    label: 'Google Play TWA setup',
    command: 'npx tsx scripts/check-google-play-twa-readiness.ts',
  },
  {
    label: 'Google Play TWA artifact validator',
    command: 'npx tsx scripts/check-google-play-twa-artifact-readiness.ts',
  },
  {
    label: 'Native mobile wrapper',
    command: 'npx tsx scripts/check-mobile-wrapper-readiness.ts',
  },
  {
    label: 'Mobile permission readiness',
    command: 'npx tsx scripts/check-mobile-permissions-readiness.ts',
  },
  {
    label: 'Capacitor Android artifact validator',
    command: 'npx tsx scripts/check-capacitor-android-artifact-readiness.ts',
  },
  {
    label: 'iOS App Store archive validator',
    command: 'npx tsx scripts/check-ios-app-store-readiness.ts',
  },
];

const BUILD_CHECK: PreflightCheck = {
  label: 'Production build',
  command: 'npm run build',
};

function defaultRunner(command: string): RunnerResult {
  return spawnSync(command, {
    shell: true,
    stdio: 'inherit',
  });
}

export function runStorePreflight(options: PreflightOptions = {}): PreflightResult {
  const runner = options.runner ?? defaultRunner;
  const log = options.log ?? console.log;
  const checks = options.includeBuild ? [...PREFLIGHT_CHECKS, BUILD_CHECK] : PREFLIGHT_CHECKS;
  const failures: PreflightFailure[] = [];

  for (const [index, check] of checks.entries()) {
    log(`[${index + 1}/${checks.length}] ${check.label}`);
    log(`$ ${check.command}`);
    const result = runner(check.command);
    if (result.status !== 0) {
      failures.push({
        label: check.label,
        command: check.command,
        status: result.status,
      });
      log(`Failed: ${check.label}`);
      break;
    }
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  log('Store preflight checks passed.');
  return { ok: true, failures };
}

function runCli() {
  const includeBuild = process.env.STORE_PREFLIGHT_SKIP_BUILD !== '1';
  const result = runStorePreflight({ includeBuild });
  if (!result.ok) {
    console.error('Store preflight failed:');
    for (const failure of result.failures) {
      console.error(`- ${failure.label}: ${failure.command} exited with ${failure.status ?? 'no status'}`);
    }
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('store-preflight.ts') || process.argv[1]?.endsWith('store-preflight.js')) {
  runCli();
}
