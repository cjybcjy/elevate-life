'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import BirdLogo from '@/components/common/BirdLogo';
import ThemeToggle from '@/components/common/ThemeToggle';

const navItems = [
  { label: '仪表盘', href: '/', icon: '🏠' },
  { label: '资产管理', href: '/management/assets', icon: '💰' },
  { label: '负债管理', href: '/management/liabilities', icon: '📋' },
  { label: '流水管理', href: '/management/ledger', icon: '📝' },
  { label: '预算管理', href: '/management/budget', icon: '📊' },
  { label: '分类管理', href: '/management/categories', icon: '🏷️' },
];

function isNavActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <>
      <aside
        className="app-sidebar flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden"
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
            borderBottom: '1px solid var(--color-sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <BirdLogo size={34} />
            <span style={{ fontSize: '18px', fontWeight: 700 }}>家庭账本</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = isNavActive(pathname, item.href);
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
                    e.currentTarget.style.color = 'var(--color-text-primary)';
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
            borderTop: '1px solid var(--color-sidebar-border)',
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

      <header className="mobile-topbar">
        <Link href="/" className="mobile-brand" aria-label="回到仪表盘">
          <BirdLogo size={30} />
          <span>家庭账本</span>
        </Link>
        <div className="mobile-topbar__actions">
          <ThemeToggle />
          <button
            type="button"
            className="mobile-icon-button"
            onClick={handleLogout}
            aria-label="退出登录"
            title="退出登录"
          >
            🚪
          </button>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="主要导航">
        {navItems.map(item => {
          const isActive = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={
                isActive
                  ? 'mobile-bottom-nav__item mobile-bottom-nav__item--active'
                  : 'mobile-bottom-nav__item'
              }
            >
              <span className="mobile-bottom-nav__icon">{item.icon}</span>
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
