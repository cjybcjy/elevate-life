export type MobilePrimaryNavId = 'home' | 'assets' | 'quick-entry' | 'budget' | 'me';

export type MobileNavigationIconName =
  | 'home'
  | 'assets'
  | 'plus'
  | 'budget'
  | 'user'
  | 'liability'
  | 'goal'
  | 'category'
  | 'recurring'
  | 'security';

export type MobileNavItem = {
  id: MobilePrimaryNavId;
  label: string;
  href: string;
  icon: MobileNavigationIconName;
};

export type MobileMoreNavItem = {
  label: string;
  href: string;
  icon: MobileNavigationIconName;
};

export const MOBILE_PRIMARY_NAV_ITEMS: MobileNavItem[] = [
  { id: 'home', label: '首页', href: '/', icon: 'home' },
  { id: 'assets', label: '资产', href: '/management/assets', icon: 'assets' },
  { id: 'quick-entry', label: '记一笔', href: '/management/ledger?focus=create', icon: 'plus' },
  { id: 'budget', label: '预算', href: '/management/budget', icon: 'budget' },
  { id: 'me', label: '我的', href: '/me', icon: 'user' },
];

export const MOBILE_MORE_NAV_ITEMS: MobileMoreNavItem[] = [
  { label: '周期交易', href: '/management/recurring', icon: 'recurring' },
  { label: '负债管理', href: '/management/liabilities', icon: 'liability' },
  { label: '目标管理', href: '/management/goals', icon: 'goal' },
  { label: '分类管理', href: '/management/categories', icon: 'category' },
  { label: '修改密码', href: '/account/password', icon: 'security' },
];

export function isMobileNavItemActive(
  pathname: string,
  id: MobilePrimaryNavId,
  focus: string | null = null,
) {
  const quickEntryFocused = pathname === '/management/ledger' && focus === 'create';
  if (id === 'quick-entry') return quickEntryFocused;
  if (id === 'home') return pathname === '/';
  if (id === 'assets') return pathname.startsWith('/management/assets');
  if (id === 'budget') return pathname.startsWith('/management/budget');
  return (
    pathname === '/me'
    || pathname.startsWith('/possessions')
    || (pathname.startsWith('/management/ledger') && !quickEntryFocused)
    || pathname.startsWith('/management/recurring')
    || pathname.startsWith('/management/liabilities')
    || pathname.startsWith('/management/goals')
    || pathname.startsWith('/management/categories')
    || pathname.startsWith('/account/password')
    || pathname.startsWith('/support')
    || pathname.startsWith('/privacy')
    || pathname.startsWith('/terms')
  );
}
