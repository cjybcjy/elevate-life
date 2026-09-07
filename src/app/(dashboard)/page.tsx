export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import SWRDataProvider from '@/components/providers/SWRDataProvider';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { getForecastSnapshot } from '@/lib/actions/forecast';
import { getBudgetProgress } from '@/lib/actions/budget';
import { getCategories } from '@/lib/actions/categories';
import { getGoals } from '@/lib/actions/goals';
import { getRecurringRules } from '@/lib/actions/recurring';
import { getCurrentGoldPrice } from '@/lib/actions/gold';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);
  const [
    assets,
    liabilities,
    transactions,
    forecast,
    budgets,
    categories,
    goals,
    recurringRules,
    goldPrice,
  ] = await Promise.all([
    getAssets(),
    getLiabilities(),
    getTransactions(),
    getForecastSnapshot(),
    getBudgetProgress(currentDate),
    getCategories(),
    getGoals(),
    getRecurringRules(),
    getCurrentGoldPrice(),
  ]);

  const fallback = {
    assets: {
      data: assets.success ? (assets.data ?? []) : [],
      pricesStale: assets.success ? (assets.pricesStale ?? false) : false,
    },
    liabilities: { data: liabilities.success ? (liabilities.data ?? []) : [] },
    transactions: { data: transactions.success ? (transactions.data ?? []) : [] },
    'forecast:12': forecast.success && forecast.data
      ? forecast.data
      : {
          autoForecast: {
            monthlyIncome: '20000',
            monthlyExpense: '15000',
            activeMonths: 0,
            recurringExpenses: [],
          },
          forecast: { months: [], warningLevel: 'green' },
          forexRates: { usdToCny: 7.2, hkdToCny: 0.92, jpyToCny: 0.048 },
        },
    [`budgets:${currentDate}`]: { data: budgets.success ? (budgets.data ?? []) : [] },
    categories: categories.success ? (categories.data ?? []) : [],
    goals: goals.success ? (goals.data ?? []) : [],
    'recurring-rules': recurringRules.success ? (recurringRules.data ?? []) : [],
    'gold-price': goldPrice.success ? goldPrice.data : null,
  };

  return (
    <SWRDataProvider fallback={fallback}>
      <DashboardClient currentDate={currentDate} />
    </SWRDataProvider>
  );
}
