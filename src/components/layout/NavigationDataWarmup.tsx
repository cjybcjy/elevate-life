'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useAssets } from '@/hooks/useAssets';
import { useLiabilities } from '@/hooks/useLiabilities';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { useForecast } from '@/hooks/useForecast';
import { readData } from '@/lib/read-data';
import { hasNavigationModule, warmNavigationModule } from '@/lib/navigation-modules';
import {
  canWarmNavigationInBackground,
  getNavigationResources,
  scheduleNavigationIdle,
  useNavigationReadiness,
} from '@/components/layout/NavigationReadinessProvider';

// Form data is useful across more routes than the home page's forecast/quotes.
const resourcePriority = [
  'assets', 'transactions', 'categories', 'budgets-list', 'budgets',
  'liabilities', 'goals', 'recurring-rules', 'forecast', 'gold-price',
];

// These subscriptions use the same keys and provider as the destination pages.
// SWR deduplicates in-flight reads and coordinates them with later mutations.
export default function NavigationDataWarmup() {
  const pathname = usePathname();
  const { ready, markReady, intent } = useNavigationReadiness();
  const [visibleResources, setVisibleResources] = useState<string[]>([]);
  const [backgroundResources, setBackgroundResources] = useState<string[]>([]);
  const resources = [
    ...getNavigationResources(pathname),
    ...backgroundResources,
    ...(intent?.from === pathname ? getNavigationResources(intent.to) : []),
  ];
  const needs = (resource: string) => resources.includes(resource);
  const date = new Date().toISOString().slice(0, 10);

  const assets = useAssets(needs('assets'));
  const liabilities = useLiabilities(needs('liabilities'));
  const transactions = useTransactions(undefined, needs('transactions'));
  const budgets = useBudgets(date, needs('budgets'));
  const forecast = useForecast(12, needs('forecast'));
  const categories = useSWR(needs('categories') ? 'categories' : null, () => readData('categories').then(r => {
    if (!r.success) throw new Error(r.error);
    return r.data ?? [];
  }));
  const goals = useSWR(needs('goals') ? 'goals' : null, () => readData('goals').then(r => {
    if (!r.success) throw new Error(r.error);
    return r.data ?? [];
  }));
  const budgetList = useSWR(needs('budgets-list') ? 'budgets-list' : null, () => readData('budgets-list').then(r => {
    if (!r.success) throw new Error(r.error);
    return r.data ?? [];
  }));
  const recurringRules = useSWR(needs('recurring-rules') ? 'recurring-rules' : null, () => readData('recurring-rules').then(r => {
    if (!r.success) throw new Error(r.error);
    return r.data ?? [];
  }));
  const goldPrice = useSWR(needs('gold-price') ? 'gold-price' : null, () => readData('gold-price').then(r => {
    if (!r.success) throw new Error(r.error);
    return r.data ?? null;
  }));

  const reads = {
    assets, liabilities, transactions, budgets, forecast, categories, goals,
    'budgets-list': budgetList, 'recurring-rules': recurringRules, 'gold-price': goldPrice,
  };
  const loading = Object.values(reads).some(read => read.isLoading);
  const currentLoading = getNavigationResources(pathname).some(resource => reads[resource].isLoading);

  useEffect(() => {
    if (currentLoading || ready) return;
    let cancelIdle = () => {};
    const prepare = () => {
      cancelIdle();
      // The shell can hydrate before a streamed server page or its own JS has
      // finished loading, including routes without client resource subscriptions.
      if (document.readyState !== 'complete' || !canWarmNavigationInBackground()) return;
      cancelIdle = scheduleNavigationIdle(() => {
        if (canWarmNavigationInBackground()) markReady(pathname);
      });
    };
    prepare();
    document.addEventListener('visibilitychange', prepare);
    window.addEventListener('load', prepare);
    window.addEventListener('online', prepare);
    return () => {
      cancelIdle();
      document.removeEventListener('visibilitychange', prepare);
      window.removeEventListener('load', prepare);
      window.removeEventListener('online', prepare);
    };
  }, [currentLoading, ready, markReady, pathname]);

  // Prepare visible destinations without requiring a hover first. Start at most
  // two additional reads per batch, after the current screen's reads finish.
  useEffect(() => {
    if (!ready || loading || !canWarmNavigationInBackground()) return;
    const pending = visibleResources.filter(resource => !backgroundResources.includes(resource)
      && !getNavigationResources(pathname).some(current => current === resource)).slice(0, 2);
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      setBackgroundResources(current => [...new Set([...current, ...pending])]);
    }, 250);
    return () => clearTimeout(timer);
  }, [visibleResources, backgroundResources, loading, pathname, ready]);

  useEffect(() => {
    if (!ready || currentLoading || !('IntersectionObserver' in window)) return;
    const anchors = new Set<HTMLAnchorElement>();
    const moduleQueue: string[] = [];
    const queuedModules = new Set<string>();
    let moduleLoads = 0;
    let disposed = false;
    const warmVisibleModules = () => {
      while (!disposed && canWarmNavigationInBackground() && moduleLoads < 2 && moduleQueue.length > 0) {
        const path = moduleQueue.shift()!;
        moduleLoads += 1;
        void warmNavigationModule(path).finally(() => {
          moduleLoads -= 1;
          warmVisibleModules();
        });
      }
    };
    const visible = new Set<HTMLAnchorElement>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const anchor = entry.target as HTMLAnchorElement;
        if (entry.isIntersecting) visible.add(anchor);
        else visible.delete(anchor);
      }
      const wanted = new Set<string>();
      for (const anchor of visible) {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) continue;
        for (const resource of getNavigationResources(url.pathname)) wanted.add(resource);
        if (canWarmNavigationInBackground()
          && url.pathname !== pathname && hasNavigationModule(url.pathname) && !queuedModules.has(url.pathname)) {
          queuedModules.add(url.pathname);
          moduleQueue.push(url.pathname);
        }
      }
      warmVisibleModules();
      const next = resourcePriority.filter(resource => wanted.has(resource));
      setVisibleResources(current => current.join('|') === next.join('|') ? current : next);
    });
    const observeLinks = () => {
      for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        if (anchors.has(anchor) || anchor.target === '_blank' || anchor.hasAttribute('download')) continue;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin || (getNavigationResources(url.pathname).length === 0 && !hasNavigationModule(url.pathname))) continue;
        anchors.add(anchor);
        observer.observe(anchor);
      }
      for (const anchor of anchors) {
        if (anchor.isConnected) continue;
        observer.unobserve(anchor);
        anchors.delete(anchor);
        visible.delete(anchor);
      }
    };
    observeLinks();
    const mutations = new MutationObserver(observeLinks);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      disposed = true;
      observer.disconnect();
      mutations.disconnect();
    };
  }, [pathname, ready, currentLoading]);

  return null;
}
