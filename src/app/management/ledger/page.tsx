import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LedgerManager from './LedgerManager';

export default async function LedgerManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <LedgerManager />;
}
