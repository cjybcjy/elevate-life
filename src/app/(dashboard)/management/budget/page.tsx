export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BudgetManager from './BudgetManager';
import SWRDataProvider from '@/components/providers/SWRDataProvider';
import { getBudgetProgress, getBudgets } from '@/lib/actions/budget';
import { getCategories } from '@/lib/actions/categories';
import { getAssets } from '@/lib/actions/assets';
import { getTransactions } from '@/lib/actions/ledger';

export default async function BudgetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);
  const [progress, budgets, categories, assets, transactions] = await Promise.all([
    getBudgetProgress(currentDate),
    getBudgets(),
    getCategories(),
    getAssets(),
    getTransactions(),
  ]);

  const fallback = {
    [`budgets:${currentDate}`]: {
      data: progress.success ? (progress.data ?? []) : [],
    },
    'budgets-list': budgets.success ? (budgets.data ?? []) : [],
    categories: categories.success ? (categories.data ?? []) : [],
    assets: {
      data: assets.success ? (assets.data ?? []) : [],
      pricesStale: assets.success ? (assets.pricesStale ?? false) : false,
    },
    transactions: {
      data: transactions.success ? (transactions.data ?? []) : [],
    },
  };

  return (
    <SWRDataProvider fallback={fallback}>
      <BudgetManager currentDate={currentDate} />
    </SWRDataProvider>
  );
}
