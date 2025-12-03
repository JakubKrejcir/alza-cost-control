import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Package, Clock, TrendingUp, AlertTriangle,
  CheckCircle, Filter, ChevronDown, ChevronUp,
  ArrowLeft, MapPin, Truck, X, Calendar
} from 'lucide-react'
import { alzabox as alzaboxApi } from '../lib/api'

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({ icon: Icon, label, value, subtext, color = 'primary' }) {
  const colorMap = {
    primary: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' },
    green: { bg: 'var(--color-green-light)', fg: 'var(--color-green)' },
    orange: { bg: 'var(--color-orange-light)', fg: '#e67e22' },
    red: { bg: 'var(--color-red-light)', fg: 'var(--color-red)' },
  }
  const colors = colorMap[color] || colorMap.primary

  return (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: colors.bg, color: colors.fg }}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
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
        style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: getColor(percentage) }}
      />
    </div>
  )
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return null
  const maxDeliveries = Math.max(...data.map(d => d.totalDeliveries))
  
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {data.map((day) => {
          const height = (day.totalDeliveries / maxDeliveries) * 100
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center group relative">
              <div 
                className="w-full rounded-t relative"
                style={{ height: `${height}%`, backgroundColor: 'var(--color-border)', minHeight: '4px' }}
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
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="px-2 py-1 rounded text-xs whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-card)', boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ color: 'var(--color-text-dark)' }}>{format(new Date(day.date), 'd.M.', { locale: cs })}</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{day.totalDeliveries} doručení</div>
                  <div style={{ color: day.onTimePct >= 95 ? 'var(--color-green)' : 'var(--color-orange)' }}>
                    {day.onTimePct.toFixed(0)}% včas
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {data.map((day, idx) => (
          <div key={day.date} className="flex-1 text-center">
            {idx % 5 === 0 ? format(new Date(day.date), 'd.M.', { locale: cs }) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// BOX DETAIL MODAL
// =============================================================================

function BoxDetailModal({ boxId, filters, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['box-detail', boxId, filters],
    queryFn: () => alzaboxApi.getBoxDetail(boxId, {
      start_date: filters.startDate,
      end_date: filters.endDate,
      delivery_type: filters.deliveryType
    }),
    enabled: !!boxId
  })

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="card p-8">Načítání...</div>
      </div>
    )
  }

  const { box, stats, history, trend } = data || {}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              {box?.code} - {box?.name}
            </h2>
            <div className="flex items-center gap-4 text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1"><MapPin size={14} />{box?.city}</span>
              <span className="flex items-center gap-1"><Truck size={14} />{box?.carrierName || 'Nepřiřazeno'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>
                {stats?.totalDeliveries || 0}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Doručení celkem</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold" style={{ 
                color: stats?.onTimePct >= 95 ? 'var(--color-green)' : 
                       stats?.onTimePct >= 90 ? '#e67e22' : 'var(--color-red)' 
              }}>
                {stats?.onTimePct || 0}%
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Včas</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>
                {stats?.avgDelayMinutes || 0} min
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ø zpoždění</div>
            </div>
          </div>

          {/* Trend chart */}
          {trend && trend.length > 0 && (
            <div>
              <h3 className="font-medium mb-3" style={{ color: 'var(--color-text-dark)' }}>Trend</h3>
              <DailyChart data={trend} />
            </div>
          )}

          {/* History table */}
          <div>
            <h3 className="font-medium mb-3" style={{ color: 'var(--color-text-dark)' }}>Historie doručení</h3>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left p-2">Datum</th>
                    <th className="text-left p-2">Trasa</th>
                    <th className="text-center p-2">Plán</th>
                    <th className="text-center p-2">Skutečnost</th>
                    <th className="text-right p-2">Zpoždění</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((h, idx) => (
                    <tr key={idx} style={{ 
                      borderBottom: '1px solid var(--color-border-light)',
                      backgroundColor: h.onTime ? 'transparent' : 'var(--color-red-light)'
                    }}>
                      <td className="p-2">{h.date}</td>
                      <td className="p-2">{h.routeName}</td>
                      <td className="text-center p-2">{h.plannedTime || '—'}</td>
                      <td className="text-center p-2">{h.actualTime || '—'}</td>
                      <td className="text-right p-2" style={{ 
                        color: h.delayMinutes > 0 ? 'var(--color-red)' : 'var(--color-green)' 
                      }}>
                        {h.delayMinutes > 0 ? '+' : ''}{h.delayMinutes} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AlzaBoxBI() {
  // View state: 'overview' | 'route' | 'box'
  const [view, setView] = useState('overview')
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [selectedBoxId, setSelectedBoxId] = useState(null)
  
  // Filters
  const [showFilters, setShowFilters] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [deliveryType, setDeliveryType] = useState('DPO')
  const [carrierId, setCarrierId] = useState(null)

  const filters = {
    start_date: dateRange.start,
    end_date: dateRange.end,
    delivery_type: deliveryType,
    carrier_id: carrierId
  }

  // Queries
  const { data: carriers } = useQuery({
    queryKey: ['alzabox-carriers'],
    queryFn: () => alzaboxApi.getCarriers()
  })

  const { data: summary } = useQuery({
    queryKey: ['alzabox-summary', filters],
    queryFn: () => alzaboxApi.getSummary(filters)
  })

  const { data: routeStats } = useQuery({
    queryKey: ['alzabox-routes', filters],
    queryFn: () => alzaboxApi.getByRoute(filters)
  })

  const { data: dailyStats } = useQuery({
    queryKey: ['alzabox-daily', filters],
    queryFn: () => alzaboxApi.getByDay(filters)
  })

  const { data: countries } = useQuery({
    queryKey: ['alzabox-countries'],
    queryFn: () => alzaboxApi.getCountries()
  })

  const { data: boxStats } = useQuery({
    queryKey: ['alzabox-boxes', selectedRoute, filters],
    queryFn: () => alzaboxApi.getByBox({ ...filters, route_name: selectedRoute }),
    enabled: view === 'route' && !!selectedRoute
  })

  // Handlers
  const handleRouteClick = (routeName) => {
    setSelectedRoute(routeName)
    setView('route')
  }

  const handleBoxClick = (boxId) => {
    setSelectedBoxId(boxId)
  }

  const handleBack = () => {
    if (view === 'route') {
      setView('overview')
      setSelectedRoute(null)
    }
  }

  const problemRoutes = routeStats?.filter(r => r.onTimePct < 90) || []
  const selectedCarrier = carriers?.find(c => c.id === carrierId)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view !== 'overview' && (
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              {view === 'overview' ? 'AlzaBox BI' : `Trasa: ${selectedRoute}`}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {view === 'overview' ? 'Analýza dojezdů a kvality doručení' : 'Detail boxů na trase'}
            </p>
          </div>
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
            {/* Carrier filter */}
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Dopravce
              </label>
              <select
                value={carrierId || ''}
                onChange={(e) => setCarrierId(e.target.value ? Number(e.target.value) : null)}
                className="select"
                style={{ minWidth: '180px' }}
              >
                <option value="">Všichni dopravci</option>
                {carriers?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.onTimePct}% včas)
                  </option>
                ))}
              </select>
            </div>
            
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
          
          {selectedCarrier && (
            <div className="mt-3 pt-3 border-t flex items-center gap-4" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <strong>{selectedCarrier.name}</strong>: {selectedCarrier.boxCount} boxů, {selectedCarrier.deliveryCount.toLocaleString()} doručení
              </span>
            </div>
          )}
        </div>
      )}

      {/* VIEW: OVERVIEW */}
      {view === 'overview' && (
        <>
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
                  <div key={c.country} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg)' }}>
                    <span className="text-lg">
                      {c.country === 'CZ' ? '🇨🇿' : c.country === 'SK' ? '🇸🇰' : 
                       c.country === 'HU' ? '🇭🇺' : c.country === 'AT' ? '🇦🇹' : '🌍'}
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
              <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-dark)' }}>
                Denní přehled doručení
              </h3>
              <DailyChart data={dailyStats} />
            </div>
          )}

          {/* Routes Table */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                Statistiky podle tras
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Klikněte na trasu pro zobrazení detailu boxů
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left p-3">Trasa</th>
                    <th className="text-center p-3">Doručení</th>
                    <th className="text-center p-3">Včas</th>
                    <th className="p-3 w-32"></th>
                    <th className="text-right p-3">Ø Zpoždění</th>
                  </tr>
                </thead>
                <tbody>
                  {routeStats?.map((route) => (
                    <tr 
                      key={route.routeName}
                      onClick={() => handleRouteClick(route.routeName)}
                      className="cursor-pointer hover:bg-gray-50"
                      style={{ 
                        borderBottom: '1px solid var(--color-border-light)',
                        backgroundColor: route.onTimePct < 90 ? 'var(--color-red-light)' : 'transparent'
                      }}
                    >
                      <td className="p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                        {route.routeName}
                      </td>
                      <td className="text-center p-3">{route.totalDeliveries}</td>
                      <td className="text-center p-3">
                        <span className="font-semibold" style={{ 
                          color: route.onTimePct >= 95 ? 'var(--color-green)' : 
                                 route.onTimePct >= 90 ? '#e67e22' : 'var(--color-red)' 
                        }}>
                          {route.onTimePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3"><OnTimeBar percentage={route.onTimePct} /></td>
                      <td className="text-right p-3">
                        {route.avgDelayMinutes > 0 ? '+' : ''}{route.avgDelayMinutes.toFixed(0)} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: ROUTE DETAIL (Boxes) */}
      {view === 'route' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              Boxy na trase {selectedRoute}
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Klikněte na box pro zobrazení detailu
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left p-3">Box</th>
                  <th className="text-left p-3">Město</th>
                  <th className="text-center p-3">Doručení</th>
                  <th className="text-center p-3">Včas</th>
                  <th className="p-3 w-32"></th>
                  <th className="text-right p-3">Ø Zpoždění</th>
                  <th className="text-right p-3">Max</th>
                </tr>
              </thead>
              <tbody>
                {boxStats?.map((box) => (
                  <tr 
                    key={box.boxId}
                    onClick={() => handleBoxClick(box.boxId)}
                    className="cursor-pointer hover:bg-gray-50"
                    style={{ 
                      borderBottom: '1px solid var(--color-border-light)',
                      backgroundColor: box.onTimePct < 90 ? 'var(--color-red-light)' : 'transparent'
                    }}
                  >
                    <td className="p-3">
                      <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{box.boxCode}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{box.boxName}</div>
                    </td>
                    <td className="p-3" style={{ color: 'var(--color-text-muted)' }}>{box.city}</td>
                    <td className="text-center p-3">{box.totalDeliveries}</td>
                    <td className="text-center p-3">
                      <span className="font-semibold" style={{ 
                        color: box.onTimePct >= 95 ? 'var(--color-green)' : 
                               box.onTimePct >= 90 ? '#e67e22' : 'var(--color-red)' 
                      }}>
                        {box.onTimePct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3"><OnTimeBar percentage={box.onTimePct} /></td>
                    <td className="text-right p-3">
                      {box.avgDelayMinutes > 0 ? '+' : ''}{box.avgDelayMinutes.toFixed(0)} min
                    </td>
                    <td className="text-right p-3" style={{ color: 'var(--color-red)' }}>
                      {box.maxDelayMinutes > 0 ? `+${box.maxDelayMinutes}` : box.maxDelayMinutes} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Box Detail Modal */}
      {selectedBoxId && (
        <BoxDetailModal 
          boxId={selectedBoxId} 
          filters={{ startDate: dateRange.start, endDate: dateRange.end, deliveryType }}
          onClose={() => setSelectedBoxId(null)} 
        />
      )}
    </div>
  )
}
