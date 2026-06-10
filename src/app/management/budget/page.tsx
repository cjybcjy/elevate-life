export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BudgetManager from './BudgetManager';

export default async function BudgetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);

  return <BudgetManager currentDate={currentDate} />;
}
