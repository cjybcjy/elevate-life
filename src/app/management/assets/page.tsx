import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AssetManager from './AssetManager';

export default async function AssetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <AssetManager />;
}
