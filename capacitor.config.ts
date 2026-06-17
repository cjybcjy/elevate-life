import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/+$/, '');
const appId = process.env.CAPACITOR_APP_ID || 'com.elevatelife.app';

const config: CapacitorConfig = {
  appId,
  appName: 'Elevate Life',
  webDir: 'mobile-web',
  backgroundColor: '#0f172a',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),
  android: {
    path: 'android',
    backgroundColor: '#0f172a',
  },
  ios: {
    path: 'ios',
    backgroundColor: '#0f172a',
  },
};

export default config;
