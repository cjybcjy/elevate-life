import { redirect } from 'next/navigation';
import LedgerManager from './LedgerManager';

export default async function LedgerManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  if (requestedTab === 'recurring') redirect('/management/recurring');

  return <LedgerManager />;
}
