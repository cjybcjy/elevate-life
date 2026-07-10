'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BirdLogo from '@/components/common/BirdLogo';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  isMobileNavItemActive,
} from '@/lib/mobile-navigation';

type MobileNavigationViewProps = {
  pathname: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onLogout: () => void | Promise<void>;
};

export function MobileNavigationView({
  pathname,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onLogout,
}: MobileNavigationViewProps) {
  return (
    <>
      <header
        className="mobile-topbar"
        style={menuOpen ? { zIndex: 110, pointerEvents: 'none' } : undefined}
      >
        <Link href="/" className="mobile-brand min-h-11" aria-label="回到首页">
          <BirdLogo size={30} />
          <span>家庭账本</span>
        </Link>
        <button
          type="button"
          className="mobile-icon-button min-h-11 min-w-11"
          aria-label="更多功能"
          aria-expanded={menuOpen}
          aria-controls="mobile-more-menu"
          onClick={onMenuToggle}
          style={menuOpen ? { pointerEvents: 'auto' } : undefined}
        >
          ☰
        </button>
      </header>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] border-0 bg-black/40 md:hidden"
            aria-label="关闭更多功能"
            onClick={onMenuClose}
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="更多功能菜单"
            className="fixed right-3 left-3 z-[100] grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-container)] p-3 shadow-xl md:hidden"
            style={{ bottom: 'calc(78px + env(safe-area-inset-bottom))' }}
          >
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMenuClose}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] no-underline"
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="[&_button]:min-h-11 [&_button]:min-w-11">
              <ThemeToggle />
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-[var(--border-tertiary)] px-3 py-2 text-left text-sm text-[var(--color-danger)]"
              onClick={async () => {
                onMenuClose();
                await onLogout();
              }}
            >
              🚪 退出登录
            </button>
          </section>
        </>
      ) : null}

      <nav
        className="mobile-bottom-nav"
        aria-label="主要导航"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
          const active = isMobileNavItemActive(pathname, item.id);
          const primary = item.id === 'quick-entry';
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              data-mobile-primary-nav={item.id}
              aria-current={active ? 'page' : undefined}
              className={active
                ? 'mobile-bottom-nav__item mobile-bottom-nav__item--active'
                : 'mobile-bottom-nav__item'}
              style={primary ? {
                background: 'var(--color-accent)',
                color: 'var(--color-text-inverse)',
                transform: 'translateY(-8px)',
                boxShadow: 'var(--shadow-md)',
              } : undefined}
            >
              <span className="mobile-bottom-nav__icon" aria-hidden>{item.icon}</span>
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function MobileNavigation({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <MobileNavigationView
      pathname={pathname}
      menuOpen={menuOpen}
      onMenuToggle={() => setMenuOpen((current) => !current)}
      onMenuClose={() => setMenuOpen(false)}
      onLogout={onLogout}
    />
  );
}
