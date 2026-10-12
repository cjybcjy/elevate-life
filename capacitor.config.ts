import type { CapacitorConfig } from '@capacitor/cli';
import { loadEnvConfig } from '@next/env';
import { getLocalMobileServerUrl, getMobileServerUrl } from './scripts/mobile-sync-config';

loadEnvConfig(process.cwd());

export function buildCapacitorConfig(env: NodeJS.ProcessEnv = process.env): CapacitorConfig {
  const local = env.CAPACITOR_SYNC_MODE === 'local';
  if (local && env.CAPACITOR_LOCAL_PLATFORM !== 'android' && env.CAPACITOR_LOCAL_PLATFORM !== 'ios') {
    throw new Error('Local native configuration requires an explicit Android or iOS platform. Use mobile:sync:local.');
  }
  const serverUrl = local
    ? getLocalMobileServerUrl(env, env.CAPACITOR_LOCAL_PLATFORM as 'android' | 'ios')
    : getMobileServerUrl(env);
  const appId = env.CAPACITOR_APP_ID || 'com.elevatelife.app';

  return {
    appId,
    appName: 'Elevate Life',
    webDir: 'mobile-web',
    backgroundColor: '#F7F7F7',
    ...(serverUrl
      ? {
          server: {
            url: serverUrl,
            cleartext: local,
          },
        }
      : {}),
    android: {
      path: 'android',
      backgroundColor: '#F7F7F7',
    },
    ios: {
      path: 'ios',
      backgroundColor: '#F7F7F7',
    },
  };
}

export default buildCapacitorConfig();
