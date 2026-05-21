import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardNav from '@/components/layout/DashboardNav';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-full flex flex-col bg-ledger-bg">
      <DashboardNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
