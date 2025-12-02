import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Receipt, Upload, DollarSign, Calendar, Truck, FileText, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Fakturace', icon: Receipt },
  { path: '/upload', label: 'Dokumenty', icon: Upload },
  { path: '/contracts', label: 'Smlouvy', icon: FileText },
  { path: '/prices', label: 'Ceníky', icon: DollarSign },
  { path: '/history', label: 'Historie', icon: Calendar },
  { path: '/carriers', label: 'Dopravci', icon: Truck },
]

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
