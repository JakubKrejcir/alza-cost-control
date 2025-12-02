import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  DollarSign, 
  Truck, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  Building2,
  Calendar
} from 'lucide-react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useCarrier } from '../lib/CarrierContext'

const navItems = [
  { path: '/dashboard', label: 'Fakturace', icon: LayoutDashboard, needsCarrier: true, needsPeriod: true },
  { path: '/prices', label: 'Ceníky', icon: DollarSign, needsCarrier: true, needsPeriod: false },
  { path: '/upload', label: 'Dokumenty', icon: FileText, needsCarrier: true, needsPeriod: true },
  { path: '/carriers', label: 'Dopravci', icon: Truck, needsCarrier: false, needsPeriod: false },
]

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  const {
    selectedCarrierId,
    setSelectedCarrierId,
    carrierList,
    selectedPeriod,
    setSelectedPeriod,
    periodOptions
  } = useCarrier()

  const currentNav = navItems.find(item => location.pathname.startsWith(item.path))
  const showCarrierSelect = currentNav?.needsCarrier ?? false
  const showPeriodSelect = currentNav?.needsPeriod ?? false

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
        style={{ 
          backgroundColor: 'var(--color-card)', 
          borderRight: '1px solid var(--color-border)' 
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-semibold shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-cyan) 100%)' }}
            >
              🚚
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--color-text-dark)' }}>Transport</div>
                <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Tycoon</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 mt-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `nav-item mb-1 ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--color-border-light)' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="nav-item w-full"
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && <span>Sbalit menu</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header 
        className="md:hidden fixed top-0 left-0 right-0 z-50"
        style={{ 
          backgroundColor: 'var(--color-card)', 
          borderBottom: '1px solid var(--color-border)' 
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-cyan) 100%)' }}
            >
              🚚
            </div>
            <span className="font-bold" style={{ color: 'var(--color-text-dark)' }}>Transport Tycoon</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav 
            className="px-4 pb-4 space-y-1"
            style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}
          >
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'
      } mt-14 md:mt-0`}>
        
        {/* Top Bar with Carrier/Period Selection */}
        {(showCarrierSelect || showPeriodSelect) && (
          <div 
            className="sticky top-0 z-40 px-6 py-3"
            style={{ 
              backgroundColor: 'var(--color-card)', 
              borderBottom: '1px solid var(--color-border)' 
            }}
          >
            <div className="flex flex-wrap items-center gap-4">
              {showCarrierSelect && (
                <div className="flex items-center gap-2">
                  <Building2 size={18} style={{ color: 'var(--color-text-muted)' }} />
                  <select
                    value={selectedCarrierId}
                    onChange={(e) => setSelectedCarrierId(e.target.value)}
                    className="select"
                    style={{ minWidth: '200px' }}
                  >
                    <option value="">Vyberte dopravce...</option>
                    {carrierList.map(carrier => (
                      <option key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {showPeriodSelect && (
                <div className="flex items-center gap-2">
                  <Calendar size={18} style={{ color: 'var(--color-text-muted)' }} />
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="select"
                    style={{ minWidth: '160px' }}
                  >
                    {periodOptions.map(period => (
                      <option key={period} value={period}>
                        {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
