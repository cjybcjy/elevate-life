import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import AppShell from '@/components/layout/AppShell';
import { getInitialDashboardData } from '@/lib/initial-dashboard-data';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) redirect('/login');

  const pathname = (await headers()).get('x-elevate-initial-path');
  const fallback = await getInitialDashboardData(pathname, new Date().toISOString().slice(0, 10));
  return <AppShell fallback={fallback}>{children}</AppShell>;
}
