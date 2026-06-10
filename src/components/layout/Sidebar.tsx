'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/common/ThemeToggle';

const navItems = [
  { label: '仪表盘', href: '/', icon: '🏠' },
  { label: '资产管理', href: '/management/assets', icon: '💰' },
  { label: '负债管理', href: '/management/liabilities', icon: '📋' },
  { label: '流水管理', href: '/management/ledger', icon: '📝' },
  { label: '预算管理', href: '/management/budget', icon: '📊' },
  { label: '分类管理', href: '/management/categories', icon: '🏷️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <aside
      className="flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-sidebar-bg)',
        color: 'var(--color-sidebar-text)',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: '#ffffff' }}>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>📊 家庭账本</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
                color: isActive
                  ? 'var(--color-sidebar-active-text)'
                  : 'var(--color-sidebar-text)',
                background: isActive
                  ? 'var(--color-sidebar-active-bg)'
                  : 'transparent',
                transition: 'all var(--transition-fast)',
                marginBottom: '2px',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-sidebar-hover-bg)';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-sidebar-text)';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <ThemeToggle />
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-sidebar-text)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-sidebar-hover-bg)';
            e.currentTarget.style.color = 'var(--color-danger)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-sidebar-text)';
          }}
        >
          <span style={{ fontSize: '16px' }}>🚪</span>
          退出登录
        </button>
      </div>
    </aside>
  );
}
