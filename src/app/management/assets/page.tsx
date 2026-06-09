export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets } from '@/lib/actions/assets';
import AssetManager from './AssetManager';

export default async function AssetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getAssets();
  if (!res.success) redirect('/login');

  const assets = (res.data ?? []) as any[];
  const pricesStale = (res as any).pricesStale ?? false;

  return <AssetManager assets={assets} pricesStale={pricesStale} />;
}
