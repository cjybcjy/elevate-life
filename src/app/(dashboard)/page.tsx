export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets } from '@/lib/actions/assets';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { simulateCashflow, getAutoForecast } from '@/lib/actions/forecast';
import { getBudgetProgress } from '@/lib/actions/budget';
import { getGoals } from '@/lib/actions/goals';
import { fetchForexRates } from '@/lib/services/price/sources/forex';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);

  const [assetsRes, liabilitiesRes, transactionsRes, autoForecastRes, budgetProgressRes, goalsRes, forexRates] = await Promise.all([
    getAssets(), getLiabilities(), getTransactions(),
    getAutoForecast(12), getBudgetProgress(currentDate), getGoals(),
    fetchForexRates(),
  ]);

  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];
  const liabilities = (liabilitiesRes.success ? liabilitiesRes.data : []) ?? [];
  const transactions = (transactionsRes.success ? transactionsRes.data : []) ?? [];
  const autoForecastData = autoForecastRes.success ? autoForecastRes.data! : { monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [] };
  const budgetProgress = (budgetProgressRes.success ? budgetProgressRes.data : []) ?? [];
  const goals = (goalsRes.success ? goalsRes.data : []) ?? [];
  const pricesStale = (assetsRes as any).pricesStale ?? false;

  const forecastRes2 = await simulateCashflow({
    monthlyIncome: autoForecastData.monthlyIncome,
    monthlyExpense: autoForecastData.monthlyExpense,
    months: 12,
  });
  const forecast = forecastRes2.success ? forecastRes2.data! : { months: [], warningLevel: 'green' };

  return (
    <DashboardClient
      assets={assets}
      liabilities={liabilities}
      transactions={transactions}
      forecast={forecast}
      forexRates={forexRates}
      budgetProgress={budgetProgress}
      goals={goals}
      pricesStale={pricesStale}
    />
  );
}
