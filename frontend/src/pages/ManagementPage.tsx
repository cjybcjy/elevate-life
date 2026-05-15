import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/management/assets', label: '资产管理', icon: '💰' },
  { path: '/management/liabilities', label: '负债管理', icon: '📋' },
  { path: '/management/transactions', label: '交易管理', icon: '📝' },
  { path: '/management/categories', label: '分类管理', icon: '🏷️' },
];

export default function ManagementPage() {
  const location = useLocation();

  return (
    <div className="bg-ledger-bg min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ledger-bg/90 backdrop-blur-md border-b border-ledger-surface">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-ledger-muted hover:text-ledger-text transition-colors">
              ← 返回仪表板
            </Link>
            <span className="text-ledger-muted">|</span>
            <span className="text-xl font-bold text-ledger-text">家庭账本</span>
            <span className="text-xs text-ledger-muted bg-ledger-surface px-2 py-0.5 rounded">Pro</span>
          </div>
        </div>
      </nav>

      <div className="pt-16 flex min-h-screen">
        <aside className="w-56 bg-ledger-surface/50 border-r border-ledger-primary/10 p-4 fixed top-16 bottom-0 left-0 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  location.pathname === item.path
                    ? 'bg-ledger-primary/10 text-ledger-primary font-medium'
                    : 'text-ledger-muted hover:text-ledger-text hover:bg-ledger-surface'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-6 ml-56">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
