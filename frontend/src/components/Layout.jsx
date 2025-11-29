import { NavLink, Outlet } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Upload, 
  DollarSign, 
  History, 
  Truck, 
  FileText,
  Settings,
  HelpCircle,
  LogOut
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Nahrát' },
  { to: '/carriers', icon: Truck, label: 'Dopravci' },
  { to: '/contracts', icon: FileText, label: 'Smlouvy' },
  { to: '/prices', icon: DollarSign, label: 'Ceníky' },
  { to: '/history', icon: History, label: 'Historie' },
]

const bottomItems = [
  { to: '/help', icon: HelpCircle, label: 'Nápověda' },
  { to: '/settings', icon: Settings, label: 'Nastavení' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">TransportBrain</h1>
              <p className="text-xs text-gray-400">Cost Control</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom items */}
        <div className="border-t border-gray-100 py-4">
          {bottomItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={20} />
            <span>Odhlásit</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
