import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Upload, DollarSign, Calendar, Truck, FileText, Menu, X, Map } from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Nahrát', icon: Upload },
  { path: '/route-plans', label: 'Plány', icon: Map },
  { path: '/contracts', label: 'Smlouvy', icon: FileText },
  { path: '/prices', label: 'Ceníky', icon: DollarSign },
  { path: '/history', label: 'Historie', icon: Calendar },
  { path: '/carriers', label: 'Dopravci', icon: Truck },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-alza-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-alza-dark/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-alza-orange to-alza-orange-light flex items-center justify-center font-bold text-black">
              🚚
            </div>
            <h1 className="text-lg font-semibold hidden sm:block">Transport Tycoon</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-alza-orange to-alza-orange-light text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden px-4 pb-4 space-y-1">
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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
