import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagementSidebar from './ManagementSidebar';

export default async function ManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-full flex bg-ledger-bg">
      <ManagementSidebar />
      <main className="flex-1 overflow-auto px-6 py-6">{children}</main>
    </div>
  );
}
