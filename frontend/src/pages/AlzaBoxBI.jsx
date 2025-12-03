import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Package, Clock, TrendingUp, MapPin, AlertTriangle,
  CheckCircle, XCircle, BarChart3, Calendar, Filter,
  ChevronDown, ChevronUp
} from 'lucide-react'

// API client - přidat do lib/api.js
const alzaboxApi = {
  getSummary: (params) => fetch(`/api/alzabox/stats/summary?${new URLSearchParams(params)}`).then(r => r.json()),
  getByRoute: (params) => fetch(`/api/alzabox/stats/by-route?${new URLSearchParams(params)}`).then(r => r.json()),
  getByDay: (params) => fetch(`/api/alzabox/stats/by-day?${new URLSearchParams(params)}`).then(r => r.json()),
  getHeatmap: (params) => fetch(`/api/alzabox/stats/heatmap?${new URLSearchParams(params)}`).then(r => r.json()),
  getBoxes: (params) => fetch(`/api/alzabox/boxes?${new URLSearchParams(params)}`).then(r => r.json()),
  getCountries: () => fetch('/api/alzabox/countries').then(r => r.json()),
  getRoutes: (params) => fetch(`/api/alzabox/routes?${new URLSearchParams(params)}`).then(r => r.json()),
}

function StatCard({ icon: Icon, label, value, subtext, color = 'primary', trend }) {
  const colorMap = {
    primary: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' },
    green: { bg: 'var(--color-green-light)', fg: 'var(--color-green)' },
    orange: { bg: 'var(--color-orange-light)', fg: '#e67e22' },
    red: { bg: 'var(--color-red-light)', fg: 'var(--color-red)' },
    purple: { bg: 'var(--color-purple-light)', fg: 'var(--color-purple)' },
  }
  const colors = colorMap[color] || colorMap.primary

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: colors.bg, color: colors.fg }}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="stat-card-value" style={{ color: 'var(--color-text-dark)' }}>{value}</div>
      {subtext && (
        <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{subtext}</div>
      )}
    </div>
  )
}

function OnTimeBar({ percentage }) {
  const getColor = (pct) => {
    if (pct >= 95) return 'var(--color-green)'
    if (pct >= 90) return 'var(--color-orange)'
    return 'var(--color-red)'
  }
  
  return (
    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
      <div 
        className="h-full rounded-full transition-all duration-300"
        style={{ 
          width: `${percentage}%`, 
          backgroundColor: getColor(percentage) 
        }}
      />
    </div>
  )
}

function RouteTable({ routes }) {
  const [sortBy, setSortBy] = useState('onTimePct')
  const [sortDir, setSortDir] = useState('asc')
  
  const sorted = [...(routes || [])].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  })
  
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Trasa
            </th>
            <th 
              className="text-center p-3 font-medium cursor-pointer hover:text-black"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={() => toggleSort('totalDeliveries')}
            >
              Doručení {sortBy === 'totalDeliveries' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              className="text-center p-3 font-medium cursor-pointer hover:text-black"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={() => toggleSort('onTimePct')}
            >
              Včas {sortBy === 'onTimePct' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th className="p-3 font-medium w-32" style={{ color: 'var(--color-text-muted)' }}>
              &nbsp;
            </th>
            <th 
              className="text-right p-3 font-medium cursor-pointer hover:text-black"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={() => toggleSort('avgDelayMinutes')}
            >
              Ø Zpoždění {sortBy === 'avgDelayMinutes' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((route, idx) => (
            <tr 
              key={route.routeName}
              style={{ 
                borderBottom: '1px solid var(--color-border-light)',
                backgroundColor: route.onTimePct < 90 ? 'var(--color-red-light)' : 'transparent'
              }}
            >
              <td className="p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                {route.routeName}
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
                {route.totalDeliveries}
              </td>
              <td className="text-center p-3">
                <span 
                  className="font-semibold"
                  style={{ 
                    color: route.onTimePct >= 95 ? 'var(--color-green)' : 
                           route.onTimePct >= 90 ? '#e67e22' : 'var(--color-red)' 
                  }}
                >
                  {route.onTimePct.toFixed(1)}%
                </span>
              </td>
              <td className="p-3">
                <OnTimeBar percentage={route.onTimePct} />
              </td>
              <td className="text-right p-3" style={{ color: 'var(--color-text-dark)' }}>
                {route.avgDelayMinutes > 0 ? '+' : ''}{route.avgDelayMinutes.toFixed(0)} min
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return null
  
  const maxDeliveries = Math.max(...data.map(d => d.totalDeliveries))
  
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-40">
        {data.map((day, idx) => {
          const height = (day.totalDeliveries / maxDeliveries) * 100
          const onTimeHeight = (day.onTimeDeliveries / maxDeliveries) * 100
          
          return (
            <div 
              key={day.date}
              className="flex-1 flex flex-col items-center group relative"
            >
              <div 
                className="w-full rounded-t relative"
                style={{ 
                  height: `${height}%`,
                  backgroundColor: 'var(--color-border)',
                  minHeight: '4px'
                }}
              >
                <div 
                  className="absolute bottom-0 left-0 right-0 rounded-t"
                  style={{ 
                    height: `${(day.onTimeDeliveries / day.totalDeliveries) * 100}%`,
                    backgroundColor: day.onTimePct >= 95 ? 'var(--color-green)' : 
                                     day.onTimePct >= 90 ? 'var(--color-orange)' : 'var(--color-red)'
                  }}
                />
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div>{format(new Date(day.date), 'd.M.', { locale: cs })}</div>
                  <div>{day.totalDeliveries} doručení</div>
                  <div>{day.onTimePct.toFixed(1)}% včas</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* X axis labels */}
      <div className="flex gap-1 text-xs" style={{ color: 'var(--color-text-light)' }}>
        {data.map((day, idx) => (
          <div key={day.date} className="flex-1 text-center">
            {idx % 3 === 0 ? format(new Date(day.date), 'd.M.', { locale: cs }) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AlzaBoxBI() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [deliveryType, setDeliveryType] = useState('DPO')
  const [showFilters, setShowFilters] = useState(false)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['alzabox-summary', dateRange],
    queryFn: () => alzaboxApi.getSummary({
      start_date: dateRange.start,
      end_date: dateRange.end
    })
  })

  const { data: routeStats } = useQuery({
    queryKey: ['alzabox-routes', dateRange, deliveryType],
    queryFn: () => alzaboxApi.getByRoute({
      start_date: dateRange.start,
      end_date: dateRange.end,
      delivery_type: deliveryType
    })
  })

  const { data: dailyStats } = useQuery({
    queryKey: ['alzabox-daily', dateRange, deliveryType],
    queryFn: () => alzaboxApi.getByDay({
      start_date: dateRange.start,
      end_date: dateRange.end,
      delivery_type: deliveryType
    })
  })

  const { data: countries } = useQuery({
    queryKey: ['alzabox-countries'],
    queryFn: () => alzaboxApi.getCountries()
  })

  // Výpočet problémových tras
  const problemRoutes = routeStats?.filter(r => r.onTimePct < 90) || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            AlzaBox BI
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Analýza dojezdů a kvality doručení
          </p>
        </div>
        
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Filter size={18} />
          Filtry
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Od
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="select"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Do
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="select"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Typ závozu
              </label>
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
                className="select"
              >
                <option value="DPO">DPO (ranní)</option>
                <option value="SD">SD (odpolední)</option>
                <option value="THIRD">3. závoz</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Celkem doručení"
          value={summary?.totalDeliveries?.toLocaleString('cs-CZ') || '—'}
          subtext={`za ${Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000*60*60*24))} dní`}
          color="primary"
        />
        <StatCard
          icon={CheckCircle}
          label="Včas nebo dříve"
          value={`${summary?.onTimePct || 0}%`}
          subtext={`${summary?.onTimeDeliveries?.toLocaleString('cs-CZ') || 0} doručení`}
          color={summary?.onTimePct >= 95 ? 'green' : summary?.onTimePct >= 90 ? 'orange' : 'red'}
        />
        <StatCard
          icon={Clock}
          label="Průměrné zpoždění"
          value={`${summary?.avgDelayMinutes || 0} min`}
          subtext={summary?.avgDelayMinutes < 0 ? 'v průměru dříve' : 'v průměru později'}
          color={summary?.avgDelayMinutes <= 0 ? 'green' : 'orange'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Problémové trasy"
          value={problemRoutes.length}
          subtext="< 90% včas"
          color={problemRoutes.length === 0 ? 'green' : 'red'}
        />
      </div>

      {/* Countries Overview */}
      {countries && countries.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-dark)' }}>
            Alzaboxy podle země
          </h3>
          <div className="flex flex-wrap gap-4">
            {countries.map(c => (
              <div 
                key={c.country}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-lg">
                  {c.country === 'CZ' ? '🇨🇿' : 
                   c.country === 'SK' ? '🇸🇰' : 
                   c.country === 'HU' ? '🇭🇺' : 
                   c.country === 'AT' ? '🇦🇹' : 
                   c.country === 'DE' ? '🇩🇪' : '🌍'}
                </span>
                <span style={{ color: 'var(--color-text-dark)' }}>{c.country}</span>
                <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {c.boxCount.toLocaleString('cs-CZ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Chart */}
      {dailyStats && dailyStats.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              Denní přehled doručení
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-green)' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>≥95% včas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-orange)' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>90-95%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-red)' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>&lt;90%</span>
              </div>
            </div>
          </div>
          <DailyChart data={dailyStats} />
        </div>
      )}

      {/* Routes Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            Statistiky podle tras
          </h3>
        </div>
        {routeStats ? (
          <RouteTable routes={routeStats} />
        ) : (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Načítání...
          </div>
        )}
      </div>

      {/* Problem Routes Alert */}
      {problemRoutes.length > 0 && (
        <div className="card p-4" style={{ borderLeft: '4px solid var(--color-red)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5" style={{ color: 'var(--color-red)' }} />
            <div>
              <h4 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                Trasy s nízkou kvalitou doručení
              </h4>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Následující trasy mají méně než 90% doručení včas:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {problemRoutes.map(r => (
                  <span 
                    key={r.routeName}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}
                  >
                    {r.routeName} ({r.onTimePct.toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
