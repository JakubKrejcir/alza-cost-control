import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Package, Clock, TrendingUp, Target,
  CheckCircle, XCircle, Filter, ChevronDown, ChevronUp,
  ArrowLeft, MapPin, Truck, X, Calendar, AlertTriangle
} from 'lucide-react'
import { alzabox as alzaboxApi } from '../lib/api'

// =============================================================================
// KONSTANTY
// =============================================================================

const TARGET_PCT = 99 // Cílová včasnost v %

const getStatusColor = (pct) => {
  if (pct >= 99) return { bg: 'var(--color-green-light)', fg: 'var(--color-green)', status: 'success' }
  if (pct >= 95) return { bg: 'var(--color-orange-light)', fg: '#e67e22', status: 'warning' }
  return { bg: 'var(--color-red-light)', fg: 'var(--color-red)', status: 'error' }
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({ icon: Icon, label, value, subtext, target, color = 'primary' }) {
  const colorMap = {
    primary: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' },
    green: { bg: 'var(--color-green-light)', fg: 'var(--color-green)' },
    orange: { bg: 'var(--color-orange-light)', fg: '#e67e22' },
    red: { bg: 'var(--color-red-light)', fg: 'var(--color-red)' },
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
        {target && (
          <span className="text-xs px-2 py-1 rounded-full" 
            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
            Cíl: {target}
          </span>
        )}
      </div>
      <div className="stat-card-value" style={{ color: colors.fg }}>{value}</div>
      {subtext && (
        <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{subtext}</div>
      )}
    </div>
  )
}

function ProgressBar({ value, showLabel = true }) {
  const colors = getStatusColor(value)
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
        <div 
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: colors.fg }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium w-14 text-right" style={{ color: colors.fg }}>
          {value.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

function StatusBadge({ onTime }) {
  if (onTime) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: 'var(--color-green-light)', color: 'var(--color-green)' }}>
        <CheckCircle size={12} /> Včas
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>
      <XCircle size={12} /> Pozdě
    </span>
  )
}

function TimeDiff({ planned, actual }) {
  if (!planned || !actual) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  
  // Parse times
  const [pH, pM] = planned.split(':').map(Number)
  const [aH, aM] = actual.split(':').map(Number)
  const plannedMins = pH * 60 + pM
  const actualMins = aH * 60 + aM
  const diff = actualMins - plannedMins
  
  if (diff <= 0) {
    return (
      <span style={{ color: 'var(--color-green)' }}>
        {diff === 0 ? 'Přesně' : `${Math.abs(diff)} min dříve`}
      </span>
    )
  }
  return (
    <span style={{ color: 'var(--color-red)' }}>
      +{diff} min
    </span>
  )
}

// =============================================================================
// BOX DETAIL MODAL
// =============================================================================

function BoxDetailModal({ boxId, filters, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['box-detail', boxId, filters],
    queryFn: () => alzaboxApi.getBoxDetail(boxId, {
      start_date: filters.startDate,
      end_date: filters.endDate,
      delivery_type: filters.deliveryType
    }),
    enabled: !!boxId,
    retry: false
  })

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="card p-8">Načítání...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="card p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>
              <AlertTriangle size={20} />
            </div>
            <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              Chyba při načítání detailu
            </h3>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {error.response?.data?.detail || error.message || 'Neznámá chyba'}
          </p>
          <p className="text-xs mb-4 font-mono p-2 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
            Box ID: {boxId}
          </p>
          <button onClick={onClose} className="btn btn-primary w-full">
            Zavřít
          </button>
        </div>
      </div>
    )
  }

  const { box, stats, history } = data || {}
  const colors = getStatusColor(stats?.onTimePct || 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-dark)' }}>
              {box?.code}
            </h2>
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {box?.name}
            </div>
            <div className="flex items-center gap-4 text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
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
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: colors.bg }}>
              <div className="text-2xl font-bold" style={{ color: colors.fg }}>
                {stats?.onTimePct || 0}%
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Včasnost (cíl {TARGET_PCT}%)
              </div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>
                {stats?.onTimeDeliveries || 0}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Včas (=1)</div>
            </div>
          </div>

          {/* History table */}
          <div>
            <h3 className="font-medium mb-3" style={{ color: 'var(--color-text-dark)' }}>
              Historie dojezdů
            </h3>
            <div className="overflow-x-auto max-h-80 border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <tr>
                    <th className="text-left p-3 font-medium">Datum</th>
                    <th className="text-center p-3 font-medium">Plán</th>
                    <th className="text-center p-3 font-medium">Skutečnost</th>
                    <th className="text-center p-3 font-medium">Rozdíl</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((h, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      <td className="p-3">{h.date}</td>
                      <td className="text-center p-3 font-mono">{h.plannedTime || '—'}</td>
                      <td className="text-center p-3 font-mono">{h.actualTime || '—'}</td>
                      <td className="text-center p-3">
                        <TimeDiff planned={h.plannedTime} actual={h.actualTime} />
                      </td>
                      <td className="text-center p-3">
                        <StatusBadge onTime={h.onTime} />
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
  // View state: 'overview' | 'route'
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

  const summaryColors = getStatusColor(summary?.onTimePct || 0)
  const lateDeliveries = (summary?.totalDeliveries || 0) - (summary?.onTimeDeliveries || 0)
  const routesBelowTarget = routeStats?.filter(r => r.onTimePct < TARGET_PCT).length || 0

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
              {view === 'overview' ? 'Včasnost dojezdů k AlzaBoxům' : `Trasa: ${selectedRoute}`}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {view === 'overview' 
                ? `Cíl: ${TARGET_PCT}% včasnost | Včas = 1, Pozdě = 0`
                : 'Detail boxů na trase'
              }
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
                    {c.name} ({c.onTimePct}%)
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
        </div>
      )}

      {/* VIEW: OVERVIEW */}
      {view === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Target}
              label="Včasnost"
              value={`${summary?.onTimePct || 0}%`}
              target={`${TARGET_PCT}%`}
              subtext={`${summary?.onTimeDeliveries?.toLocaleString('cs-CZ') || 0} včas z ${summary?.totalDeliveries?.toLocaleString('cs-CZ') || 0}`}
              color={summaryColors.status}
            />
            <StatCard
              icon={CheckCircle}
              label="Včas (=1)"
              value={summary?.onTimeDeliveries?.toLocaleString('cs-CZ') || '0'}
              subtext="Doručeno včas nebo dříve"
              color="green"
            />
            <StatCard
              icon={XCircle}
              label="Pozdě (=0)"
              value={lateDeliveries.toLocaleString('cs-CZ')}
              subtext="Doručeno po plánovaném čase"
              color={lateDeliveries > 0 ? 'red' : 'green'}
            />
            <StatCard
              icon={AlertTriangle}
              label="Trasy pod cílem"
              value={routesBelowTarget}
              subtext={`< ${TARGET_PCT}% včasnost`}
              color={routesBelowTarget === 0 ? 'green' : 'red'}
            />
          </div>

          {/* Daily Breakdown */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                Denní přehled
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                    <th className="text-left p-3 font-medium">Datum</th>
                    <th className="text-center p-3 font-medium">Celkem</th>
                    <th className="text-center p-3 font-medium">Včas (=1)</th>
                    <th className="text-center p-3 font-medium">Pozdě (=0)</th>
                    <th className="p-3 font-medium">Včasnost</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats?.map((day) => {
                    const late = day.totalDeliveries - day.onTimeDeliveries
                    const colors = getStatusColor(day.onTimePct)
                    return (
                      <tr key={day.date} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                        <td className="p-3 font-medium">
                          {format(new Date(day.date), 'EEEE d.M.', { locale: cs })}
                        </td>
                        <td className="text-center p-3">{day.totalDeliveries}</td>
                        <td className="text-center p-3" style={{ color: 'var(--color-green)' }}>
                          {day.onTimeDeliveries}
                        </td>
                        <td className="text-center p-3" style={{ color: late > 0 ? 'var(--color-red)' : 'inherit' }}>
                          {late}
                        </td>
                        <td className="p-3 w-48">
                          <ProgressBar value={day.onTimePct} />
                        </td>
                        <td className="text-center p-3">
                          {day.onTimePct >= TARGET_PCT ? (
                            <CheckCircle size={18} style={{ color: 'var(--color-green)' }} />
                          ) : (
                            <XCircle size={18} style={{ color: 'var(--color-red)' }} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Routes Table */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                Včasnost podle tras
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Klikněte na trasu pro zobrazení detailu boxů
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                    <th className="text-left p-3 font-medium">Trasa</th>
                    <th className="text-center p-3 font-medium">Celkem</th>
                    <th className="text-center p-3 font-medium">Včas (=1)</th>
                    <th className="text-center p-3 font-medium">Pozdě (=0)</th>
                    <th className="p-3 font-medium w-48">Včasnost</th>
                    <th className="text-center p-3 font-medium">vs Cíl</th>
                  </tr>
                </thead>
                <tbody>
                  {routeStats?.map((route) => {
                    const late = route.totalDeliveries - route.onTimeDeliveries
                    const colors = getStatusColor(route.onTimePct)
                    const diffFromTarget = route.onTimePct - TARGET_PCT
                    return (
                      <tr 
                        key={route.routeName}
                        onClick={() => handleRouteClick(route.routeName)}
                        className="cursor-pointer hover:bg-gray-50"
                        style={{ borderTop: '1px solid var(--color-border-light)' }}
                      >
                        <td className="p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                          {route.routeName}
                        </td>
                        <td className="text-center p-3">{route.totalDeliveries}</td>
                        <td className="text-center p-3" style={{ color: 'var(--color-green)' }}>
                          {route.onTimeDeliveries}
                        </td>
                        <td className="text-center p-3" style={{ color: late > 0 ? 'var(--color-red)' : 'inherit' }}>
                          {late}
                        </td>
                        <td className="p-3">
                          <ProgressBar value={route.onTimePct} />
                        </td>
                        <td className="text-center p-3">
                          <span style={{ 
                            color: diffFromTarget >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                            fontWeight: 500
                          }}>
                            {diffFromTarget >= 0 ? '+' : ''}{diffFromTarget.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
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
              Klikněte na box pro zobrazení historie dojezdů
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                  <th className="text-left p-3 font-medium">Box</th>
                  <th className="text-left p-3 font-medium">Město</th>
                  <th className="text-center p-3 font-medium">Celkem</th>
                  <th className="text-center p-3 font-medium">Včas (=1)</th>
                  <th className="text-center p-3 font-medium">Pozdě (=0)</th>
                  <th className="p-3 font-medium w-48">Včasnost</th>
                  <th className="text-center p-3 font-medium">vs Cíl</th>
                </tr>
              </thead>
              <tbody>
                {boxStats?.map((box) => {
                  const late = box.totalDeliveries - box.onTimeDeliveries
                  const diffFromTarget = box.onTimePct - TARGET_PCT
                  return (
                    <tr 
                      key={box.boxId}
                      onClick={() => handleBoxClick(box.boxId)}
                      className="cursor-pointer hover:bg-gray-50"
                      style={{ borderTop: '1px solid var(--color-border-light)' }}
                    >
                      <td className="p-3">
                        <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                          {box.boxCode}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {box.boxName}
                        </div>
                      </td>
                      <td className="p-3" style={{ color: 'var(--color-text-muted)' }}>{box.city}</td>
                      <td className="text-center p-3">{box.totalDeliveries}</td>
                      <td className="text-center p-3" style={{ color: 'var(--color-green)' }}>
                        {box.onTimeDeliveries}
                      </td>
                      <td className="text-center p-3" style={{ color: late > 0 ? 'var(--color-red)' : 'inherit' }}>
                        {late}
                      </td>
                      <td className="p-3">
                        <ProgressBar value={box.onTimePct} />
                      </td>
                      <td className="text-center p-3">
                        <span style={{ 
                          color: diffFromTarget >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                          fontWeight: 500
                        }}>
                          {diffFromTarget >= 0 ? '+' : ''}{diffFromTarget.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
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
