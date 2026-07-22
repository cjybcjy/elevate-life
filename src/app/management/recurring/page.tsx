import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LedgerManager from '../ledger/LedgerManager';

export const dynamic = 'force-dynamic';

export default async function RecurringManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <LedgerManager view="recurring" />;
}
