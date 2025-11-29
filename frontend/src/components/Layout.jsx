import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Upload, 
  DollarSign, 
  Calendar, 
  Truck, 
  FileText, 
  Menu, 
  X,
  Bell,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  HelpCircle,
  ChevronDown
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Nahrát', icon: Upload },
  { path: '/contracts', label: 'Smlouvy', icon: FileText },
  { path: '/prices', label: 'Ceníky', icon: DollarSign },
  { path: '/history', label: 'Historie', icon: Calendar },
  { path: '/carriers', label: 'Dopravci', icon: Truck },
]

const bottomNavItems = [
  { path: '/help', label: 'Nápověda', icon: HelpCircle },
  { path: '/settings', label: 'Nastavení', icon: Settings },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-100 fixed h-full z-40">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Alza</h1>
            <p className="text-xs text-gray-500">Cost Control</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-1">
          {bottomNavItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button className="nav-item w-full text-left text-red-600 hover:bg-red-50 hover:text-red-700">
            <LogOut size={20} />
            <span>Odhlásit</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Alza</h1>
              <p className="text-xs text-gray-500">Cost Control</p>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
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
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-1">
          <button className="nav-item w-full text-left text-red-600 hover:bg-red-50 hover:text-red-700">
            <LogOut size={20} />
            <span>Odhlásit</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
          {/* Left Side */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu size={20} className="text-gray-600" />
            </button>

            {/* Search */}
            <div className="hidden sm:block relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat dopravce, faktury..."
                className="w-64 lg:w-80 pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm 
                         placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 
                         focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors relative"
              >
                <Bell size={20} className="text-gray-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-lg z-50 overflow-hidden animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Notifikace</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <div>
                            <p className="text-sm text-gray-900">Nová faktura nahrána</p>
                            <p className="text-xs text-gray-500 mt-0.5">Drivecool - FIX 11/2024</p>
                            <p className="text-xs text-gray-400 mt-1">před 2 hodinami</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                          <div>
                            <p className="text-sm text-gray-900">Chybí faktury</p>
                            <p className="text-xs text-gray-500 mt-0.5">KM a Linehaul za 10/2024</p>
                            <p className="text-xs text-gray-400 mt-1">před 1 dnem</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>
                          <div>
                            <p className="text-sm text-gray-900">Proof ověřen</p>
                            <p className="text-xs text-gray-500 mt-0.5">Vše sedí s ceníkem</p>
                            <p className="text-xs text-gray-400 mt-1">před 3 dny</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                        Zobrazit všechny
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <button className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
              <MessageSquare size={20} className="text-gray-600" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 mx-2"></div>

            {/* User Menu */}
            <button className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
                JN
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">Jan Novák</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 hidden md:block" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
