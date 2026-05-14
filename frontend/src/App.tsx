import { Routes, Route, Navigate } from 'react-router-dom'
import { DockNavigation } from './components/layout/DockNavigation'
import NetWorthSlide from './components/slides/NetWorthSlide'
import AssetAllocationSlide from './components/slides/AssetAllocationSlide'
import DebtOverviewSlide from './components/slides/DebtOverviewSlide'
import ScissorChartSlide from './components/slides/ScissorChartSlide'
import ForecastSlide from './components/slides/ForecastSlide'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function DashboardPage() {
  return (
    <div className="bg-ledger-bg min-h-screen">
      <DockNavigation />
      <main className="pt-16">
        <section id="net-worth" className="dashboard-section">
          <NetWorthSlide />
        </section>
        <section id="asset-allocation" className="dashboard-section">
          <AssetAllocationSlide />
        </section>
        <section id="debt-overview" className="dashboard-section">
          <DebtOverviewSlide />
        </section>
        <section id="scissor-chart" className="dashboard-section">
          <ScissorChartSlide />
        </section>
        <section id="forecast" className="dashboard-section">
          <ForecastSlide />
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
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default App
