'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { preload, useSWRConfig } from 'swr';
import { warmNavigationModule } from '@/lib/navigation-modules';
import { readData } from '@/lib/read-data';

export const navigationRouteResources = {
  '/': ['assets', 'liabilities', 'transactions', 'forecast', 'budgets', 'categories', 'goals', 'gold-price'],
  '/management/assets': ['assets', 'transactions'],
  '/management/liabilities': ['assets', 'liabilities', 'transactions'],
  '/management/ledger': ['assets', 'transactions', 'categories'],
  '/management/budget': ['assets', 'transactions', 'categories', 'budgets', 'budgets-list'],
  '/management/goals': ['assets', 'goals'],
  '/management/recurring': ['assets', 'categories', 'recurring-rules'],
} as const;

type NavigationResource = (typeof navigationRouteResources)[keyof typeof navigationRouteResources][number];
type NavigationIntent = { from: string; to: string } | null;

export function getNavigationResources(pathname: string): readonly NavigationResource[] {
  return navigationRouteResources[pathname as keyof typeof navigationRouteResources] ?? [];
}

export function canWarmNavigationInBackground() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return document.visibilityState === 'visible' && navigator.onLine
    && !connection?.saveData && connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
}

// Give the current page a paint before sharing network/CPU time with other pages.
export function scheduleNavigationIdle(callback: () => void) {
  let idle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) {
      idle = window.requestIdleCallback(callback, { timeout: 1_000 });
    } else {
      timer = setTimeout(callback, 100);
    }
  });
  return () => {
    cancelAnimationFrame(frame);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) clearTimeout(timer);
  };
}

function resourceKey(resource: NavigationResource, date: string) {
  if (resource === 'budgets') return `budgets:${date}`;
  if (resource === 'forecast') return 'forecast:12';
  return resource;
}

async function readNavigationResource(resource: NavigationResource, date: string) {
  const query: Record<string, string | number> | undefined = resource === 'budgets' ? { date } : resource === 'forecast' ? { months: 12 } : undefined;
  const result = await readData(resource, query);
  if (!result.success) throw new Error(result.error || '读取数据失败，请重试');
  if (resource === 'assets') {
    return { data: result.data ?? [], pricesStale: 'pricesStale' in result ? result.pricesStale : false };
  }
  if (resource === 'liabilities' || resource === 'transactions' || resource === 'budgets') {
    return { data: result.data ?? [] };
  }
  if (resource === 'forecast') {
    if (!result.data) throw new Error('读取预测失败，请重试');
    return result.data;
  }
  return result.data ?? (resource === 'gold-price' ? null : []);
}

const NavigationReadinessContext = createContext<{
  ready: boolean;
  markReady: (pathname: string) => void;
  intent: NavigationIntent;
}>({ ready: false, markReady: () => {}, intent: null });

export function useNavigationReadiness() {
  return useContext(NavigationReadinessContext);
}

export default function NavigationReadinessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { cache, fallback } = useSWRConfig();
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [intent, setIntent] = useState<NavigationIntent>(null);
  const markReady = useCallback((path: string) => setReadyPath(path), []);

  // This listener stays outside the data warmup's Suspense boundary. A user can
  // prepare a destination immediately even while the current server data streams.
  useEffect(() => {
    const handleIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (event.type === 'pointerover' && (event as PointerEvent).pointerType !== 'mouse') return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === pathname) return;

      router.prefetch(`${url.pathname}${url.search}`);
      void warmNavigationModule(url.pathname);
      const date = new Date().toISOString().slice(0, 10);
      for (const resource of getNavigationResources(url.pathname)) {
        const key = resourceKey(resource, date);
        const existing = cache.get(key);
        if (existing?.data !== undefined || existing?.isValidating || Object.hasOwn(fallback ?? {}, key)) continue;
        // SWR consumes the same promise when the destination (or warmup) mounts.
        // Existing cached/in-flight reads keep their normal mutation ordering.
        void Promise.resolve(preload(key, () => readNavigationResource(resource, date))).catch(() => {});
      }
      setIntent(current => current?.from === pathname && current.to === url.pathname
        ? current
        : { from: pathname, to: url.pathname });
    };
    document.addEventListener('pointerover', handleIntent, { passive: true });
    document.addEventListener('pointerdown', handleIntent, { passive: true });
    document.addEventListener('focusin', handleIntent);
    return () => {
      document.removeEventListener('pointerover', handleIntent);
      document.removeEventListener('pointerdown', handleIntent);
      document.removeEventListener('focusin', handleIntent);
    };
  }, [cache, fallback, pathname, router]);

  const value = useMemo(() => ({ ready: readyPath === pathname, markReady, intent }), [readyPath, pathname, markReady, intent]);
  return <NavigationReadinessContext.Provider value={value}>{children}</NavigationReadinessContext.Provider>;
}
