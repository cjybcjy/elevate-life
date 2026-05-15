import { useLocation, Link } from 'react-router-dom';

const sections = [
  { path: '/net-worth', label: '净资产', hash: 'net-worth' },
  { path: '/asset-allocation', label: '资产配置', hash: 'asset-allocation' },
  { path: '/debt-overview', label: '负债总览', hash: 'debt-overview' },
  { path: '/scissor-chart', label: '收支剪刀图', hash: 'scissor-chart' },
  { path: '/forecast', label: '现金流预测', hash: 'forecast' },
];

export function DockNavigation() {
  const location = useLocation();

  const handleScrollTo = (hash: string) => {
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ledger-bg/90 backdrop-blur-md border-b border-ledger-surface">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-ledger-text">家庭账本</span>
          <span className="text-xs text-ledger-muted bg-ledger-surface px-2 py-0.5 rounded">Pro</span>
        </div>

        <div className="flex items-center gap-1">
          {sections.map((section) => {
            const isActive = location.pathname === section.path || location.pathname === '/dashboard';
            return (
              <button
                key={section.hash}
                onClick={() => handleScrollTo(section.hash)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'text-ledger-primary hover:bg-ledger-surface'
                    : 'text-ledger-muted hover:text-ledger-text hover:bg-ledger-surface'
                  }
                `}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/management/transactions"
            className="text-sm text-ledger-muted hover:text-ledger-primary transition-colors"
          >
            管理
          </Link>
          <span className="text-ledger-muted/30">|</span>
          <Link
            to="/login"
            onClick={handleLogout}
            className="text-sm text-ledger-muted hover:text-ledger-danger transition-colors"
          >
            退出登录
          </Link>
        </div>
      </div>
    </nav>
  );
}
