export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBudgets, getBudgetProgress } from '@/lib/actions/budget';
import { getCategories } from '@/lib/actions/categories';
import BudgetManager from './BudgetManager';

export default async function BudgetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);

  const [budgetsRes, progressRes, categoriesRes] = await Promise.all([
    getBudgets(currentDate),
    getBudgetProgress(currentDate),
    getCategories(),
  ]);

  const budgets = (budgetsRes.success ? budgetsRes.data : []) ?? [];
  const progress = (progressRes.success ? progressRes.data : []) ?? [];
  const categories = (categoriesRes.success ? categoriesRes.data : []) ?? [];

  return (
    <BudgetManager
      budgets={budgets}
      progress={progress}
      categories={categories}
      currentDate={currentDate}
    />
  );
}
