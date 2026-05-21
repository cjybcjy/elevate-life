'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: '净资产', href: '/' },
  { label: '资产配置', href: '/assets' },
  { label: '负债', href: '/liabilities' },
  { label: '剪刀图', href: '/scissor' },
  { label: '预测', href: '/forecast' },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-ledger-surface border-b border-ledger-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-ledger-bg text-ledger-accent'
                      : 'text-ledger-muted hover:bg-ledger-bg hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <Link
            href="/management/assets"
            className="ml-4 rounded-md bg-ledger-bg px-3 py-2 text-sm font-medium text-ledger-muted hover:text-white transition-colors whitespace-nowrap"
          >
            管理
          </Link>
        </div>
      </div>
    </nav>
  );
}
