import { useNavigate, useLocation } from 'react-router-dom';

const slides = [
  { path: '/net-worth', label: '净值' },
  { path: '/asset-allocation', label: '资产' },
  { path: '/debt-overview', label: '负债' },
  { path: '/scissor-chart', label: '剪刀图' },
  { path: '/forecast', label: '预测' },
];

export function DockNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="flex justify-center gap-3 p-4 bg-ledger-surface border-t border-ledger-bg">
      {slides.map((slide) => {
        const isActive = location.pathname === slide.path;
        return (
          <button
            key={slide.path}
            onClick={() => navigate(slide.path)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-ledger-primary text-white shadow-lg shadow-ledger-primary/30'
                : 'text-ledger-muted hover:text-ledger-text hover:bg-ledger-bg'
              }
            `}
          >
            {slide.label}
          </button>
        );
      })}
    </nav>
  );
}
