import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  TrendingUp, 
  TrendingDown,
  FileText,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  X
} from 'lucide-react'
import { proofs, invoices, routePlans, analysis } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function formatNumber(num) {
  if (num == null) return '—'
  return new Intl.NumberFormat('cs-CZ').format(Math.round(num))
}

function formatPercent(num) {
  if (num == null) return '—'
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)} %`
}

function StatCard({ label, value, change, color, icon: Icon }) {
  const isPositive = change && parseFloat(change) >= 0
  
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <span className="stat-card-label">{label}</span>
        {change && (
          <span className={`stat-card-change ${isPositive ? 'up' : 'down'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {change}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {Icon && (
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            <Icon size={20} />
          </div>
        )}
        <div className="stat-card-value">{value}</div>
      </div>
      <div className="stat-card-progress">
        <div 
          className="stat-card-progress-bar"
          style={{ backgroundColor: color, width: '65%' }}
        />
      </div>
    </div>
  )
}

function Badge({ type, children }) {
  const classes = {
    purple: 'badge-purple',
    blue: 'badge-blue',
    green: 'badge-green',
    orange: 'badge-orange',
    red: 'badge-red',
    cyan: 'badge-cyan',
  }
  return <span className={`badge ${classes[type] || 'badge-blue'}`}>{children}</span>
}

export default function Dashboard() {
  const { selectedCarrierId, selectedCarrier, selectedPeriod } = useCarrier()
  const [expandedPlan, setExpandedPlan] = useState(null)

  // Queries
  const { data: periodProofs, isLoading: loadingProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod, selectedCarrierId],
    queryFn: () => proofs.getAll({ period: selectedPeriod, carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: periodInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod, selectedCarrierId],
    queryFn: () => invoices.getAll({ period: selectedPeriod, carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['dashboard', selectedPeriod],
    queryFn: () => analysis.getDashboard(selectedPeriod),
    enabled: !!selectedCarrierId
  })

  const { data: planList } = useQuery({
    queryKey: ['route-plans', selectedCarrierId],
    queryFn: () => routePlans.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: dailyBreakdown } = useQuery({
    queryKey: ['daily-breakdown', expandedPlan],
    queryFn: () => routePlans.getDailyBreakdown(expandedPlan),
    enabled: !!expandedPlan
  })

  // Loading & empty states
  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Fakturace</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Přehled nákladů na dopravu</p>
        </div>
        <div className="card p-6" style={{ borderColor: 'var(--color-orange)', backgroundColor: 'var(--color-orange-light)' }}>
          <div className="flex items-center gap-3" style={{ color: '#e67e22' }}>
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Pro zobrazení fakturačního přehledu vyberte dopravce a období v horním menu
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = loadingProofs || loadingInvoices || loadingDashboard

  // Calculations
  const proof = periodProofs?.[0]
  const invoiceTotal = periodInvoices?.reduce((sum, inv) => sum + (inv.totalWithoutVat || 0), 0) || 0
  const proofTotal = proof?.grandTotal || 0
  const difference = proofTotal - invoiceTotal
  const differencePercent = invoiceTotal ? ((difference / invoiceTotal) * 100) : 0

  // Period display
  const [month, year] = selectedPeriod.split('/')
  const periodDisplay = format(new Date(parseInt('20' + year), parseInt(month) - 1), 'LLLL yyyy', { locale: cs })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Fakturace</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {selectedCarrier?.name} — {periodDisplay}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Proof celkem"
          value={formatCZK(proofTotal)}
          color="var(--color-primary)"
          icon={FileText}
        />
        <StatCard
          label="Faktury celkem"
          value={formatCZK(invoiceTotal)}
          color="var(--color-purple)"
          icon={FileText}
        />
        <StatCard
          label="Rozdíl"
          value={formatCZK(Math.abs(difference))}
          change={formatPercent(differencePercent)}
          color={difference > 0 ? 'var(--color-red)' : 'var(--color-green)'}
          icon={difference > 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Počet faktur"
          value={periodInvoices?.length || 0}
          color="var(--color-orange)"
          icon={FileText}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proof Breakdown */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Rozpis proofu</span>
            <Badge type="blue">{selectedPeriod}</Badge>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !proof ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádný proof pro toto období</p>
            </div>
          ) : (
            <div>
              {[
                { label: 'FIX', value: proof.totalFix, color: 'var(--color-primary)' },
                { label: 'Kilometry', value: proof.totalKm, color: 'var(--color-purple)' },
                { label: 'Linehaul', value: proof.totalLinehaul, color: 'var(--color-green)' },
                { label: 'Ostatní', value: proof.totalOther, color: 'var(--color-orange)' },
              ].map((item, idx) => (
                <div key={idx} className="list-item">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="flex-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(item.value)}</span>
                </div>
              ))}
              <div className="list-item" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="flex-1 font-medium" style={{ color: 'var(--color-text-dark)' }}>Celkem</span>
                <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>{formatCZK(proof.grandTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Faktury</span>
            <Badge type="purple">{periodInvoices?.length || 0}</Badge>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !periodInvoices?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné faktury pro toto období</p>
            </div>
          ) : (
            <div>
              {periodInvoices.map((invoice, idx) => (
                <div key={idx} className="list-item">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{invoice.invoiceNumber}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {invoice.items?.slice(0, 3).map((item, i) => (
                        <Badge key={i} type="blue">
                          {(item.itemType || '').replace('ALZABOXY ', '').substring(0, 15)}
                        </Badge>
                      ))}
                      {invoice.items?.length > 3 && (
                        <Badge type="blue">+{invoice.items.length - 3}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(invoice.totalWithoutVat)}</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>bez DPH</div>
                  </div>
                  <Badge type={invoice.status === 'matched' ? 'green' : invoice.status === 'disputed' ? 'red' : 'orange'}>
                    {invoice.status === 'matched' ? <Check size={12} /> : invoice.status === 'disputed' ? <X size={12} /> : '?'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Route Plans */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Plánovací soubory</span>
          <Badge type="purple">{planList?.length || 0}</Badge>
        </div>
        
        {!planList?.length ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádné plánovací soubory</p>
          </div>
        ) : (
          <div>
            {planList.slice(0, 5).map(plan => (
              <div key={plan.id}>
                <div 
                  className="list-item cursor-pointer"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{plan.fileName}</span>
                      <Badge type={plan.planType === 'BOTH' ? 'purple' : plan.planType === 'DPO' ? 'blue' : 'orange'}>
                        {plan.planType || 'BOTH'}
                      </Badge>
                      {plan.depot && plan.depot !== 'BOTH' && (
                        <Badge type={plan.depot === 'VRATIMOV' ? 'purple' : 'cyan'}>
                          {plan.depot === 'VRATIMOV' ? 'Vratimov' : 'Bydžov'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {plan.totalRoutes} tras
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck size={14} /> {formatNumber(plan.totalStops)} zastávek
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> Ø {plan.avgDuration?.toFixed(0) || '—'} min
                      </span>
                    </div>
                  </div>
                  {expandedPlan === plan.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {/* Expanded Daily Breakdown */}
                {expandedPlan === plan.id && dailyBreakdown && (
                  <div style={{ backgroundColor: 'var(--color-bg)' }}>
                    <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                      Denní rozpis
                    </div>
                    <div className="grid grid-cols-7 gap-2 px-6 pb-4">
                      {dailyBreakdown.map((day, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 rounded-xl text-center"
                          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                        >
                          <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            {format(new Date(day.date), 'EEE', { locale: cs })}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>
                            {format(new Date(day.date), 'd.M.')}
                          </div>
                          <div className="font-bold mt-1" style={{ color: 'var(--color-primary)' }}>
                            {day.routes}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>tras</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dashboard Analysis */}
      {dashboardData && (
        <div className="card">
          <div className="card-header">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Souhrnná analýza</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatNumber(dashboardData.totalRoutes)}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Celkem tras</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--color-purple)' }}>
                {formatNumber(dashboardData.totalStops)}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Celkem zastávek</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--color-green)' }}>
                {dashboardData.avgStopsPerRoute?.toFixed(1)}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ø zastávek/trasa</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--color-orange)' }}>
                {dashboardData.avgDuration?.toFixed(0)} min
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ø doba trasy</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
