// Loading the module does not mount the page or run its data hooks.
// Keep each page out of the shared shell so refreshing one page does not need
// to download and execute all the other forms before it can become interactive.
const pageModules: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/app/(dashboard)/DashboardClient'),
  '/management/assets': () => import('@/app/(dashboard)/management/assets/AssetManager'),
  '/management/liabilities': () => import('@/app/(dashboard)/management/liabilities/LiabilityManager'),
  '/management/ledger': () => import('@/app/(dashboard)/management/ledger/LedgerManager'),
  '/management/budget': () => import('@/app/(dashboard)/management/budget/BudgetManager'),
  '/management/goals': () => import('@/app/(dashboard)/management/goals/GoalManager'),
  '/management/recurring': () => import('@/app/(dashboard)/management/recurring/RecurringManager'),
  '/possessions': () => import('@/app/(dashboard)/possessions/PossessionManager'),
  '/investment-cost': () => import('@/components/widgets/InvestmentCostCalculator'),
};

const pendingModules = new Map<string, Promise<unknown>>();

export function warmNavigationModule(pathname: string): Promise<unknown> {
  if (typeof window === 'undefined' || !Object.hasOwn(pageModules, pathname)) return Promise.resolve();
  const existing = pendingModules.get(pathname);
  if (existing) return existing;
  const request = pageModules[pathname]().catch(() => {
    // Prefetch is optional. Let a later navigation retry failed downloads.
    pendingModules.delete(pathname);
  });
  pendingModules.set(pathname, request);
  return request;
}

export function hasNavigationModule(pathname: string) {
  return Object.hasOwn(pageModules, pathname);
}
