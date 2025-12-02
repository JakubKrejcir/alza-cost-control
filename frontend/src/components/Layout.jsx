import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Receipt, Upload, DollarSign, Calendar, Truck, Menu, X, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { useCarrier } from '../lib/CarrierContext'

const navItems = [
  { path: '/dashboard', label: 'Fakturace', icon: Receipt, needsCarrier: true, needsPeriod: true },
  { path: '/upload', label: 'Dokumenty', icon: Upload, needsCarrier: true, needsPeriod: true },
  { path: '/prices', label: 'Ceníky', icon: DollarSign, needsCarrier: true, needsPeriod: false },
  { path: '/history', label: 'Historie', icon: Calendar, needsCarrier: true, needsPeriod: false },
  { path: '/carriers', label: 'Dopravci', icon: Truck, needsCarrier: false, needsPeriod: false },
]

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  const {
    selectedCarrierId,
    setSelectedCarrierId,
    selectedCarrier,
    carrierList,
    selectedPeriod,
    setSelectedPeriod,
    periodOptions
  } = useCarrier()

  // Determine what selectors to show based on current route
  const currentNav = navItems.find(item => location.pathname.startsWith(item.path))
  const showCarrierSelect = currentNav?.needsCarrier ?? false
  const showPeriodSelect = currentNav?.needsPeriod ?? false

  return (
    <div className="min-h-screen bg-alza-dark text-white flex">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-full bg-alza-dark border-r border-white/10 z-50 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      }`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-alza-orange to-alza-orange-light flex items-center justify-center font-bold text-black shrink-0">
              🚚
            </div>
            {!sidebarCollapsed && (
              <h1 className="text-lg font-semibold whitespace-nowrap">Transport Tycoon</h1>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-alza-orange to-alza-orange-light text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && <span className="text-sm">Sbalit menu</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-alza-dark/95 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-alza-orange to-alza-orange-light flex items-center justify-center font-bold text-black">
              🚚
            </div>
            <h1 className="text-lg font-semibold">Transport Tycoon</h1>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="px-4 pb-4 space-y-1 bg-alza-dark border-b border-white/10">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-alza-orange to-alza-orange-light text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
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
        sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'
      } mt-14 md:mt-0`}>
        
        {/* Global Carrier/Period Selector Bar */}
        {(showCarrierSelect || showPeriodSelect) && (
          <div className="sticky top-0 z-40 bg-alza-dark/95 backdrop-blur border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex flex-wrap items-center gap-4">
                {showCarrierSelect && (
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-gray-500" />
                    <select
                      value={selectedCarrierId}
                      onChange={(e) => setSelectedCarrierId(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-alza-orange min-w-[180px]"
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
                    <Calendar size={18} className="text-gray-500" />
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-alza-orange min-w-[150px]"
                    >
                      {periodOptions.map(period => (
                        <option key={period} value={period}>
                          {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedCarrier && (
                  <div className="ml-auto text-sm text-gray-400">
                    <span className="text-alza-orange font-medium">{selectedCarrier.name}</span>
                    {selectedCarrier.ico && <span className="ml-2">IČO: {selectedCarrier.ico}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
