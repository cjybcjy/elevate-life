'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import BirdLogo from '@/components/common/BirdLogo';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  isMobileNavItemActive,
} from '@/lib/mobile-navigation';

type MobileNavigationViewProps = {
  pathname: string;
  focus: string | null;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onLogout: () => void | Promise<void>;
};

type MobileNavigationShellProps = Omit<MobileNavigationViewProps, 'focus'>;

export function MobileNavigationView({
  pathname,
  focus,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onLogout,
}: MobileNavigationViewProps) {
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreDialogRef = useRef<HTMLElement>(null);
  const restoreTriggerFocusRef = useRef(false);

  useEffect(() => {
    if (!menuOpen) {
      if (restoreTriggerFocusRef.current) {
        moreTriggerRef.current?.focus();
        restoreTriggerFocusRef.current = false;
      }
      return;
    }

    restoreTriggerFocusRef.current = true;
    const focusFrame = window.requestAnimationFrame(() => moreDialogRef.current?.focus());
    const containKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMenuClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = moreDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', containKeyboardFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', containKeyboardFocus);
    };
  }, [menuOpen, onMenuClose]);

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
          ref={moreTriggerRef}
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
            ref={moreDialogRef}
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="更多功能菜单"
            tabIndex={-1}
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
          const active = isMobileNavItemActive(pathname, item.id, focus);
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

export function MobileNavigationSearchBoundary({
  children,
  ...viewProps
}: MobileNavigationShellProps & { children: ReactNode }) {
  return (
    <Suspense fallback={<MobileNavigationView {...viewProps} focus={null} />}>
      {children}
    </Suspense>
  );
}

function MobileNavigationSearchParamsView(viewProps: MobileNavigationShellProps) {
  const searchParams = useSearchParams();
  return <MobileNavigationView {...viewProps} focus={searchParams.get('focus')} />;
}

export default function MobileNavigation({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationProps: MobileNavigationShellProps = {
    pathname,
    menuOpen,
    onMenuToggle: () => setMenuOpen((current) => !current),
    onMenuClose: () => setMenuOpen(false),
    onLogout,
  };

  return (
    <MobileNavigationSearchBoundary {...navigationProps}>
      <MobileNavigationSearchParamsView {...navigationProps} />
    </MobileNavigationSearchBoundary>
  );
}
