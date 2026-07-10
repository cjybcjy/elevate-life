export type MobilePrimaryNavId = 'home' | 'assets' | 'quick-entry' | 'ledger' | 'budget';

export type MobileNavItem = {
  id: MobilePrimaryNavId;
  label: string;
  href: string;
  icon: string;
};

export type MobileMoreNavItem = {
  label: string;
  href: string;
  icon: string;
};

export const MOBILE_PRIMARY_NAV_ITEMS: MobileNavItem[] = [
  { id: 'home', label: '首页', href: '/', icon: '🏠' },
  { id: 'assets', label: '资产', href: '/management/assets', icon: '💰' },
  { id: 'quick-entry', label: '记一笔', href: '/management/ledger?focus=create', icon: '＋' },
  { id: 'ledger', label: '流水', href: '/management/ledger', icon: '📝' },
  { id: 'budget', label: '预算', href: '/management/budget', icon: '📊' },
];

export const MOBILE_MORE_NAV_ITEMS: MobileMoreNavItem[] = [
  { label: '负债管理', href: '/management/liabilities', icon: '📋' },
  { label: '目标管理', href: '/management/goals', icon: '🎯' },
  { label: '分类管理', href: '/management/categories', icon: '🏷️' },
  { label: '修改密码', href: '/account/password', icon: '🔐' },
];

export function isMobileNavItemActive(pathname: string, id: MobilePrimaryNavId) {
  if (id === 'quick-entry') return false;
  if (id === 'home') return pathname === '/';
  if (id === 'assets') return pathname.startsWith('/management/assets');
  if (id === 'ledger') return pathname.startsWith('/management/ledger');
  return pathname.startsWith('/management/budget');
}
