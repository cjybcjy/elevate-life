'use client';

import { useMemo, type ReactNode } from 'react';
import { SWRConfig } from 'swr';

export default function SWRDataProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: Record<string, unknown>;
}) {
  const config = useMemo(() => ({
    fallback,
    // Missing keys still fetch on first use, while populated keys survive
    // route remounts until an explicit mutation refreshes them.
    revalidateIfStale: false,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  }), [fallback]);

  return <SWRConfig value={config}>{children}</SWRConfig>;
}
