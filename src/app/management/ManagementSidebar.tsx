'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { label: '资产管理', href: '/management/assets' },
  { label: '负债管理', href: '/management/liabilities' },
  { label: '流水管理', href: '/management/ledger' },
  { label: '预算管理', href: '/management/budget' },
  { label: '分类管理', href: '/management/categories' },
];

export default function ManagementSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 bg-ledger-surface border-r border-ledger-bg flex flex-col">
      <div className="px-6 py-5 border-b border-ledger-bg">
        <h2 className="text-lg font-bold text-white">管理后台</h2>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-ledger-accent/10 text-ledger-accent border border-ledger-accent/20'
                  : 'text-ledger-muted hover:bg-ledger-bg hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
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
  );
}
