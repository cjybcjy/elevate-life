import { Routes, Route, Navigate } from 'react-router-dom'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { DockNavigation } from './components/layout/DockNavigation'
import { NetWorthSlide } from './pages/NetWorthSlide'
import { AssetAllocationSlide } from './pages/AssetAllocationSlide'
import { DebtOverviewSlide } from './pages/DebtOverviewSlide'
import { ScissorChartSlide } from './pages/ScissorChartSlide'
import { ForecastSlide } from './pages/ForecastSlide'

function App() {
  useKeyboardNavigation()

  return (
    <div className="flex flex-col h-screen bg-ledger-bg">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/net-worth" replace />} />
          <Route path="/net-worth" element={<NetWorthSlide />} />
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

export default App
