import type { getAssets } from '@/lib/actions/assets';
import type { getLiabilities } from '@/lib/actions/liabilities';
import type { getTransactions } from '@/lib/actions/ledger';
import type { getForecastSnapshot } from '@/lib/actions/forecast';
import type { getBudgets, getBudgetProgress, getBudgetsForCategory } from '@/lib/actions/budget';
import type { getCategories } from '@/lib/actions/categories';
import type { getGoals } from '@/lib/actions/goals';
import type { getRecurringRules } from '@/lib/actions/recurring';
import type { getCurrentGoldPrice } from '@/lib/actions/gold';
import type { ForexRates } from '@/lib/services/price/sources/forex';

type Readers = {
  assets: typeof getAssets;
  liabilities: typeof getLiabilities;
  transactions: typeof getTransactions;
  forecast: typeof getForecastSnapshot;
  budgets: typeof getBudgetProgress;
  'budgets-list': typeof getBudgets;
  'budgets-for-category': typeof getBudgetsForCategory;
  categories: typeof getCategories;
  goals: typeof getGoals;
  'recurring-rules': typeof getRecurringRules;
  'gold-price': typeof getCurrentGoldPrice;
  'forex-rates': () => Promise<{ success: boolean; data?: ForexRates; error?: string }>;
};

type JsonValue<T> = T extends Date ? string : T extends Array<infer U> ? JsonValue<U>[] : T extends object ? { [K in keyof T]: JsonValue<T[K]> } : T;

// GET reads run independently; Server Actions remain reserved for mutations.
export async function readData<K extends keyof Readers>(resource: K, query?: Record<string, string | number>): Promise<JsonValue<Awaited<ReturnType<Readers[K]>>>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) params.set(key, String(value));
  const response = await fetch(`/api/data/${resource}${params.size ? `?${params}` : ''}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '读取数据失败，请重试');
  return result;
}
