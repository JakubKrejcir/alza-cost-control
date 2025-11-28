import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Prices from './pages/Prices'
import History from './pages/History'
import Carriers from './pages/Carriers'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="upload" element={<Upload />} />
        <Route path="prices" element={<Prices />} />
        <Route path="history" element={<History />} />
        <Route path="carriers" element={<Carriers />} />
      </Route>
    </Routes>
  )
}

export default App
