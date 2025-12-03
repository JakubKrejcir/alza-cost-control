import { Routes, Route, Navigate } from 'react-router-dom'
import { CarrierProvider } from './lib/CarrierContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Prices from './pages/Prices'
import Carriers from './pages/Carriers'
import AlzaBoxBI from './pages/AlzaBoxBI'
import LoginGate from './components/LoginGate'

function App() {
  return (
    <LoginGate>
      <CarrierProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="upload" element={<Documents />} />
            <Route path="prices" element={<Prices />} />
            <Route path="alzabox" element={<AlzaBoxBI />} />
            <Route path="carriers" element={<Carriers />} />
            {/* Redirecty pro staré URL */}
            <Route path="route-plans" element={<Navigate to="/upload" replace />} />
            <Route path="contracts" element={<Navigate to="/upload" replace />} />
            <Route path="history" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </CarrierProvider>
    </LoginGate>
  )
}

export default App
