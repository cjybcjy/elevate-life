import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { DockNavigation } from './components/layout/DockNavigation'
import { ErrorBoundary } from './components/ErrorBoundary'
import NetWorthSlide from './components/slides/NetWorthSlide'
import AssetAllocationSlide from './components/slides/AssetAllocationSlide'
import DebtOverviewSlide from './components/slides/DebtOverviewSlide'
import ScissorChartSlide from './components/slides/ScissorChartSlide'
import ForecastSlide from './components/slides/ForecastSlide'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

const ManagementPage = lazy(() => import('./pages/ManagementPage'))
const AssetManagement = lazy(() => import('./pages/management/AssetManagement'))
const LiabilityManagement = lazy(() => import('./pages/management/LiabilityManagement'))
const TransactionManagement = lazy(() => import('./pages/management/TransactionManagement'))
const CategoryManagement = lazy(() => import('./pages/management/CategoryManagement'))

function DashboardPage() {
  return (
    <div className="bg-ledger-bg min-h-screen">
      <ErrorBoundary name="DockNavigation">
        <DockNavigation />
      </ErrorBoundary>
      <main className="pt-16">
        <section id="net-worth" className="dashboard-section">
          <ErrorBoundary name="NetWorthSlide">
            <NetWorthSlide />
          </ErrorBoundary>
        </section>
        <section id="asset-allocation" className="dashboard-section">
          <ErrorBoundary name="AssetAllocationSlide">
            <AssetAllocationSlide />
          </ErrorBoundary>
        </section>
        <section id="debt-overview" className="dashboard-section">
          <ErrorBoundary name="DebtOverviewSlide">
            <DebtOverviewSlide />
          </ErrorBoundary>
        </section>
        <section id="scissor-chart" className="dashboard-section">
          <ErrorBoundary name="ScissorChartSlide">
            <ScissorChartSlide />
          </ErrorBoundary>
        </section>
        <section id="forecast" className="dashboard-section">
          <ErrorBoundary name="ForecastSlide">
            <ForecastSlide />
          </ErrorBoundary>
        </section>
      </main>
    </div>
  )
}

function App() {
  const isAuthenticated = !!localStorage.getItem('access_token')

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/management" element={isAuthenticated ? (
        <Suspense fallback={<div className="bg-ledger-bg min-h-screen flex items-center justify-center text-ledger-muted">加载中...</div>}>
          <ManagementPage />
        </Suspense>
      ) : <Navigate to="/login" replace />}>
        <Route path="assets" element={<AssetManagement />} />
        <Route path="liabilities" element={<LiabilityManagement />} />
        <Route path="transactions" element={<TransactionManagement />} />
        <Route path="categories" element={<CategoryManagement />} />
      </Route>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default App
