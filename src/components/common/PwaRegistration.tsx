'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      let registration: ServiceWorkerRegistration | undefined;
      let lastCheckedAt = Date.now();
      let disposed = false;

      const checkForUpdate = () => {
        if (
          document.visibilityState !== 'visible'
          || !navigator.onLine
          || !registration
          || Date.now() - lastCheckedAt < 60_000
        ) return;

        lastCheckedAt = Date.now();
        // Check again when a long-running installed app comes back into use.
        // Do not reload here: the user may have an unfinished entry.
        void registration.update().catch(() => {});
      };

      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }).then((result) => {
        if (!disposed) registration = result;
      }).catch(() => {
        // PWA support is progressive enhancement; failed registration should not block the app.
      });

      document.addEventListener('visibilitychange', checkForUpdate);
      window.addEventListener('focus', checkForUpdate);
      window.addEventListener('online', checkForUpdate);
      return () => {
        disposed = true;
        document.removeEventListener('visibilitychange', checkForUpdate);
        window.removeEventListener('focus', checkForUpdate);
        window.removeEventListener('online', checkForUpdate);
      };
    }
  }, []);

  return null;
}
