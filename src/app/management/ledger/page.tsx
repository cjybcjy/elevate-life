import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTransactions } from '@/lib/actions/ledger';
import { getAssets } from '@/lib/actions/assets';
import { getCategories } from '@/lib/actions/categories';
import { getRecurringRules } from '@/lib/actions/recurring';
import LedgerManager from './LedgerManager';

export default async function LedgerManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [txRes, assetsRes, categoriesRes, recurringRes] = await Promise.all([
    getTransactions(),
    getAssets(),
    getCategories(),
    getRecurringRules(),
  ]);

  const transactions = (txRes.success ? txRes.data : []) ?? [];
  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];
  const categories = (categoriesRes.success ? categoriesRes.data : []) ?? [];
  const recurringRules = (recurringRes.success ? recurringRes.data : []) ?? [];

  return (
    <LedgerManager
      transactions={transactions}
      assets={assets}
      categories={categories}
      recurringRules={recurringRules}
    />
  );
}
