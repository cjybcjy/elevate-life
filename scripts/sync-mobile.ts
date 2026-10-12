import { loadEnvConfig } from '@next/env';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { checkMobileSync, getMobileServerUrl } from './mobile-sync-config';

async function main() {
  loadEnvConfig(process.cwd());
  process.env.CAPACITOR_SYNC_MODE = 'production';
  // Fail before Capacitor can replace an existing working native configuration.
  getMobileServerUrl(process.env, true);
  const { default: config } = await import('../capacitor.config');
  const result = spawnSync(process.execPath, [resolve('node_modules/@capacitor/cli/bin/capacitor'), 'sync'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Capacitor sync did not finish. Resolve the reported platform error and run mobile:sync again.');
  }
  const errors = checkMobileSync(config);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Android and iOS configurations and fallback pages are synchronized with the shared Web service.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Mobile sync failed.');
  process.exitCode = 1;
});
