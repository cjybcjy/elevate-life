export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LiabilityManager from './LiabilityManager';

export default async function LiabilityManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <LiabilityManager />;
}
