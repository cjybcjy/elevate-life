export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import PossessionManager from './PossessionManager';
import { auth } from '@/lib/auth';
import { getPossessions } from '@/lib/actions/possessions';

export default async function PossessionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const result = await getPossessions();

  return (
    <PossessionManager
      initialItems={result.success ? result.data : []}
      initialError={result.success ? null : (result.error ?? '物品加载失败')}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
