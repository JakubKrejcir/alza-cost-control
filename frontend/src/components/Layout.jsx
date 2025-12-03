import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  Truck, 
  Tag,
  ChevronLeft,
  ChevronRight,
  Package
} from 'lucide-react'

const navigation = [
  { name: 'Fakturace', href: '/', icon: LayoutDashboard },
  { name: 'Ceníky', href: '/prices', icon: Tag },
  { name: 'Dokumenty', href: '/documents', icon: FileText },
  { name: 'AlzaBox BI', href: '/alzabox', icon: Package },
  { name: 'Dopravci', href: '/carriers', icon: Truck },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${collapsed ? 'w-16' : 'w-64'} bg-white shadow-lg transition-all duration-300`}>
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Transport Tycoon" 
                className="w-10 h-10 rounded-lg"
              />
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm leading-tight">Transport</span>
                <span className="text-xs text-gray-500 leading-tight">Tycoon</span>
              </div>
            </div>
          )}
          {collapsed && (
            <img 
              src="/logo.png" 
              alt="Transport Tycoon" 
              className="w-8 h-8 rounded-lg mx-auto"
            />
          )}
        </div>
        
        <nav className="mt-6 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-4 left-0 right-0 mx-auto w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        
        {!collapsed && (
          <div className="absolute bottom-14 left-0 right-0 px-4">
            <button
              onClick={() => setCollapsed(true)}
              className="w-full text-xs text-gray-400 hover:text-gray-600"
            >
              Sbalit menu
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className={`${collapsed ? 'pl-16' : 'pl-64'} transition-all duration-300`}>
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
