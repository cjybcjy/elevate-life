import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL?.replace(/\/+$/, '');
const appId = process.env.CAPACITOR_APP_ID || 'com.elevatelife.app';

const config: CapacitorConfig = {
  appId,
  appName: 'Elevate Life',
  webDir: 'mobile-web',
  backgroundColor: '#F7F7F7',
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
    backgroundColor: '#F7F7F7',
  },
  ios: {
    path: 'ios',
    backgroundColor: '#F7F7F7',
  },
};

export default config;
