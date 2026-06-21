import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import GoalManager from './GoalManager';

export default async function GoalManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <GoalManager />;
}
