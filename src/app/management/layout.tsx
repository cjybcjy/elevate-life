import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { label: '资产管理', href: '/management/assets' },
  { label: '负债管理', href: '/management/liabilities' },
  { label: '流水管理', href: '/management/ledger' },
  { label: '分类管理', href: '/management/categories' },
];

export default async function ManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-full flex bg-ledger-bg">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-ledger-surface border-r border-ledger-bg flex flex-col">
        <div className="px-6 py-5 border-b border-ledger-bg">
          <h2 className="text-lg font-bold text-white">管理后台</h2>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-ledger-muted hover:bg-ledger-bg hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-ledger-bg">
          <Link
            href="/"
            className="block rounded-md px-3 py-2 text-sm font-medium text-ledger-accent hover:bg-ledger-bg transition-colors"
          >
            返回大盘
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-6 py-6">{children}</main>
    </div>
  );
}
