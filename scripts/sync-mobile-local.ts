import { loadEnvConfig } from '@next/env';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { checkMobileSync, getLocalMobileServerUrl, mobileTargets } from './mobile-sync-config';

async function main() {
  loadEnvConfig(process.cwd());
  const checkOnly = process.argv.includes('--check');
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Only --check is supported.');
  // Set local mode only in this process and its children; do not rewrite .env files.
  process.env.CAPACITOR_SYNC_MODE = 'local';
  process.env.CAPACITOR_LOCAL_PLATFORM = 'android';
  const { buildCapacitorConfig } = await import('../capacitor.config');
  // Validate both destinations before mutating either native project.
  for (const target of mobileTargets) getLocalMobileServerUrl(process.env, target.platform);
  for (const target of mobileTargets) {
    const env = { ...process.env, CAPACITOR_LOCAL_PLATFORM: target.platform };
    const expected = buildCapacitorConfig(env);
    if (!checkOnly) {
      // Dependencies are unchanged. Copy is sufficient and works without Xcode or Android Studio.
      const result = spawnSync(process.execPath,
        [resolve('node_modules/@capacitor/cli/bin/capacitor'), 'copy', target.platform],
        { stdio: 'inherit', env });
      if (result.error || result.status !== 0) throw new Error(`${target.name} local copy failed.`);
    }
    const errors = checkMobileSync(expected, undefined, target.platform);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`${target.name} local configuration: ${expected.server?.url}`);
  }
  console.log('Local native sources are synchronized. Run the Web service on port 3000 and use Debug builds for device testing.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Local mobile sync failed.');
  process.exitCode = 1;
});
