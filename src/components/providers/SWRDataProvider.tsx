'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';

function RetainInitialSnapshot({ fallback }: { fallback: Record<string, unknown> }) {
  const { cache, mutate } = useSWRConfig();
  useEffect(() => {
    let disposed = false;
    for (const [key, snapshot] of Object.entries(fallback)) {
      void Promise.resolve(snapshot).then(value => {
        const current = cache.get(key);
        if (disposed || value === undefined || current?.data !== undefined || current?.isValidating) return;
        // Fallback alone is not cache.data. Preserve it across route refreshes,
        // without replacing existing data or a read already in progress.
        return mutate(key, value, { revalidate: false });
      }).catch(() => {});
    }
    return () => { disposed = true; };
  }, [fallback, cache, mutate]);
  return null;
}

export default function SWRDataProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: Record<string, unknown>;
}) {
  const config = useMemo(() => ({
    fallback,
    // Keep the server snapshot on mount, then refresh when returning from
    // another device or reconnecting without resetting an open form.
    revalidateIfStale: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2_000,
  }), [fallback]);

  return (
    <SWRConfig value={config}>
      <RetainInitialSnapshot fallback={fallback} />
      {children}
    </SWRConfig>
  );
}
