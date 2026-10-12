import { loadEnvConfig } from '@next/env';
import { checkMobileSync, getMobileServerUrl } from './mobile-sync-config';

async function main() {
  loadEnvConfig(process.cwd());
  process.env.CAPACITOR_SYNC_MODE = 'production';
  getMobileServerUrl(process.env, true);
  const { default: config } = await import('../capacitor.config');
  const errors = checkMobileSync(config);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Android and iOS use the same Web service, theme, and fallback page.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Mobile sync check failed.');
  process.exitCode = 1;
});
