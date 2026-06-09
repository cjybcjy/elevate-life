'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function DashboardNav() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-ledger-bg/90 backdrop-blur-md border-b border-ledger-surface">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">家庭账本</span>
          <span className="text-xs text-ledger-muted bg-ledger-surface px-2 py-0.5 rounded">Pro</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/management/assets" className="text-sm text-ledger-muted hover:text-white transition-colors">资产管理</Link>
          <Link href="/management/liabilities" className="text-sm text-ledger-muted hover:text-white transition-colors">负债管理</Link>
          <Link href="/management/ledger" className="text-sm text-ledger-muted hover:text-white transition-colors">流水管理</Link>
          <Link href="/management/budget" className="text-sm text-ledger-muted hover:text-white transition-colors">预算管理</Link>
          <span className="text-ledger-muted/30">|</span>
          <button onClick={handleLogout} className="text-sm text-ledger-muted hover:text-ledger-danger transition-colors">退出</button>
        </div>
      </div>
    </nav>
  );
}
