import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Prices from './pages/Prices'
import History from './pages/History'
import Carriers from './pages/Carriers'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="upload" element={<Documents />} />
        <Route path="prices" element={<Prices />} />
        <Route path="history" element={<History />} />
        <Route path="carriers" element={<Carriers />} />
        {/* Redirecty pro staré URL */}
        <Route path="route-plans" element={<Navigate to="/upload" replace />} />
        <Route path="contracts" element={<Navigate to="/upload" replace />} />
      </Route>
    </Routes>
  )
}

export default App
