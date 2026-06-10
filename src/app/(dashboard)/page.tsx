export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);

  return <DashboardClient currentDate={currentDate} />;
}
