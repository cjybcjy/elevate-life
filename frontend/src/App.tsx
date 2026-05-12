import { Routes, Route, Navigate } from 'react-router-dom'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { DockNavigation } from './components/layout/DockNavigation'
import NetWorthSlide from './components/slides/NetWorthSlide'
import AssetAllocationSlide from './components/slides/AssetAllocationSlide'
import DebtOverviewSlide from './components/slides/DebtOverviewSlide'
import ScissorChartSlide from './components/slides/ScissorChartSlide'
import ForecastSlide from './components/slides/ForecastSlide'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function ProtectedLayout() {
  useKeyboardNavigation()
  return (
    <div className="flex flex-col h-screen bg-ledger-bg">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/net-worth" replace />} />
          <Route path="/net-worth" element={<NetWorthSlide slideIndex={0} />} />
          <Route path="/asset-allocation" element={<AssetAllocationSlide />} />
          <Route path="/debt-overview" element={<DebtOverviewSlide />} />
          <Route path="/scissor-chart" element={<ScissorChartSlide />} />
          <Route path="/forecast" element={<ForecastSlide />} />
        </Routes>
      </main>
      <DockNavigation />
    </div>
  )
}

function App() {
  const isAuthenticated = !!localStorage.getItem('access_token')

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
