import 'server-only';

import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { getBudgets, getBudgetProgress } from '@/lib/actions/budget';
import { getCategories } from '@/lib/actions/categories';
import { getGoals } from '@/lib/actions/goals';
import { getRecurringRules } from '@/lib/actions/recurring';
import { getCurrentGoldPrice } from '@/lib/actions/gold';
import { getCachedForexRates } from '@/lib/services/price/sources/forex';
import { initialSnapshot } from '@/lib/initial-snapshot';

// Only full document requests supply a pathname. Resolve that page's reads in
// parallel so its first HTML already contains the data, without a hydration or
// streaming-placeholder round trip. Soft navigation keeps using the shared cache.
export async function getInitialDashboardData(pathname: string | null, date: string): Promise<Record<string, unknown>> {
  const fallback: Record<string, unknown> = {
    'forex-rates': getCachedForexRates().rates,
  };
  const assets = () => initialSnapshot(getAssets(), result => ({
    data: result.data ?? [], pricesStale: result.pricesStale ?? false,
  }));
  const liabilities = () => initialSnapshot(getLiabilities(), result => ({ data: result.data ?? [] }));
  const transactions = () => initialSnapshot(getTransactions(), result => ({ data: result.data ?? [] }));
  const categories = () => initialSnapshot(getCategories(), result => result.data ?? []);
  const budgets = () => initialSnapshot(getBudgetProgress(date), result => ({ data: result.data ?? [] }));

  switch (pathname) {
    case '/':
      fallback.assets = assets();
      fallback.liabilities = liabilities();
      fallback.transactions = transactions();
      fallback[`budgets:${date}`] = budgets();
      fallback.categories = categories();
      fallback['gold-price'] = initialSnapshot(getCurrentGoldPrice(), result => result.data ?? null);
      break;
    case '/management/assets':
      fallback.assets = assets();
      fallback.transactions = transactions();
      break;
    case '/management/liabilities':
      fallback.assets = assets();
      fallback.liabilities = liabilities();
      fallback.transactions = transactions();
      break;
    case '/management/ledger':
      fallback.assets = assets();
      fallback.transactions = transactions();
      fallback.categories = categories();
      break;
    case '/management/budget':
      fallback.assets = assets();
      fallback.transactions = transactions();
      fallback.categories = categories();
      fallback[`budgets:${date}`] = budgets();
      fallback['budgets-list'] = initialSnapshot(getBudgets(), result => result.data ?? []);
      break;
    case '/management/goals':
      fallback.assets = assets();
      fallback.goals = initialSnapshot(getGoals(), result => result.data ?? []);
      break;
    case '/management/recurring':
      fallback.assets = assets();
      fallback.categories = categories();
      fallback['recurring-rules'] = initialSnapshot(getRecurringRules(), result => result.data ?? []);
      break;
  }

  return Object.fromEntries(await Promise.all(
    Object.entries(fallback).map(async ([key, value]) => [key, await value] as const),
  ));
}
