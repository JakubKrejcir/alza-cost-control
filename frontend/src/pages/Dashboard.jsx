import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  AlertCircle, CheckCircle, FileText, TrendingUp, 
  Map, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus,
  AlertTriangle, Calendar
} from 'lucide-react'
import { analysis, proofs, invoices, routePlans } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function getPeriodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    options.push(format(date, 'MM/yyyy'))
  }
  return options
}

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

function DiffBadge({ diff, size = 'normal' }) {
  if (diff === 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 font-medium ${size === 'small' ? 'text-xs' : 'text-sm'}`} style={{ color: 'var(--color-text-light)' }}>
        <Minus size={size === 'small' ? 10 : 12} />
        0
      </span>
    )
  }
  
  const isPositive = diff > 0
  
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${size === 'small' ? 'text-xs' : 'text-sm'}`} 
      style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }}>
      {isPositive ? <ArrowUp size={size === 'small' ? 10 : 12} /> : <ArrowDown size={size === 'small' ? 10 : 12} />}
      {isPositive ? '+' : ''}{diff}
    </span>
  )
}

function SummaryCard({ icon: Icon, label, value, subtext, color = 'blue' }) {
  const colorMap = {
    blue: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' },
    green: { bg: 'var(--color-green-light)', fg: 'var(--color-green)' },
    orange: { bg: 'var(--color-orange-light)', fg: '#e67e22' },
    purple: { bg: 'var(--color-purple-light)', fg: 'var(--color-purple)' },
    red: { bg: 'var(--color-red-light)', fg: 'var(--color-red)' },
  }
  const colors = colorMap[color] || colorMap.blue
  
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
          style={{ backgroundColor: colors.bg, color: colors.fg }}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <div className="stat-card-value">{value}</div>
      {subtext && <div className="text-xs mt-1" style={{ color: 'var(--color-text-light)' }}>{subtext}</div>}
    </div>
  )
}

function ProofDetailCard({ proof }) {
  const items = [
    { label: 'FIX', value: proof?.totalFix },
    { label: 'KM', value: proof?.totalKm },
    { label: 'Linehaul', value: proof?.totalLinehaul },
    { label: 'DEPO', value: proof?.totalDepo },
    { label: 'Posily', value: proof?.totalPosily },
    { label: 'Pokuty', value: proof?.totalPenalty },
  ]
  
  // Součet dílčích hodnot (včetně pokut a posil)
  const calculatedTotal = (parseFloat(proof?.totalFix) || 0) + 
                          (parseFloat(proof?.totalKm) || 0) + 
                          (parseFloat(proof?.totalLinehaul) || 0) + 
                          (parseFloat(proof?.totalDepo) || 0) + 
                          (parseFloat(proof?.totalPenalty) || 0) +
                          (parseFloat(proof?.totalPosily) || 0)
  const grandTotal = parseFloat(proof?.grandTotal) || 0
  const totalsMatch = Math.abs(calculatedTotal - grandTotal) < 1 // tolerance 1 Kč
  
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
          style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Proof</span>
      </div>
      {proof ? (
        <div className="space-y-2">
          <div className="stat-card-value">{formatCZK(grandTotal)}</div>
          {!totalsMatch && (
            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--color-orange)' }}>
              <AlertTriangle size={12} />
              Součet nesedí ({formatCZK(calculatedTotal)})
            </div>
          )}
          <div className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            {items.map(item => (
              item.value ? (
                <div key={item.label} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                  <span className="font-medium" style={{ color: item.value < 0 ? 'var(--color-red)' : 'var(--color-text-dark)' }}>
                    {formatCZK(item.value)}
                  </span>
                </div>
              ) : null
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Chybí proof</div>
      )}
    </div>
  )
}

function InvoicesDetailCard({ invoices, proofTotal }) {
  const invoiceTotal = invoices?.reduce((sum, inv) => sum + (parseFloat(inv.totalWithoutVat) || 0), 0) || 0
  
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
          style={{ backgroundColor: 'var(--color-green-light)', color: 'var(--color-green)' }}>
          <CheckCircle className="w-5 h-5" />
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Faktury</span>
      </div>
      {invoices && invoices.length > 0 ? (
        <div className="space-y-2">
          <div className="stat-card-value">{formatCZK(invoiceTotal)}</div>
          <div className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            {invoices.map(inv => (
              <div key={inv.id} className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-muted)' }} title={inv.type}>
                  {inv.invoiceNumber}
                </span>
                <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                  {formatCZK(inv.totalWithoutVat)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Žádné faktury</div>
      )}
    </div>
  )
}

function ComparisonSummary({ data }) {
  if (!data?.totals) return null
  
  const { planned, actual, diff } = data.totals
  
  return (
    <div className="space-y-6">
      {/* Celkový přehled */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl" style={{ 
          backgroundColor: diff.dpoRoutes === 0 ? 'var(--color-green-light)' : 'var(--color-orange-light)',
          border: `1px solid ${diff.dpoRoutes === 0 ? 'var(--color-green)' : 'var(--color-orange)'}20`
        }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>DPO (ranní)</span>
            <DiffBadge diff={diff.dpoRoutes} />
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>{actual.dpoRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>skutečnost</div>
            </div>
            <div style={{ color: 'var(--color-text-light)' }}>/</div>
            <div>
              <div className="text-lg" style={{ color: 'var(--color-text-muted)' }}>{planned.dpoRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>plán</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl" style={{ 
          backgroundColor: diff.sdRoutes === 0 ? 'var(--color-green-light)' : 'var(--color-orange-light)',
          border: `1px solid ${diff.sdRoutes === 0 ? 'var(--color-green)' : 'var(--color-orange)'}20`
        }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>SD (odpolední)</span>
            <DiffBadge diff={diff.sdRoutes} />
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>{actual.sdRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>skutečnost</div>
            </div>
            <div style={{ color: 'var(--color-text-light)' }}>/</div>
            <div>
              <div className="text-lg" style={{ color: 'var(--color-text-muted)' }}>{planned.sdRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>plán</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl" style={{ 
          backgroundColor: diff.totalRoutes === 0 ? 'var(--color-green-light)' : 'var(--color-orange-light)',
          border: `1px solid ${diff.totalRoutes === 0 ? 'var(--color-green)' : 'var(--color-orange)'}20`
        }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Celkem</span>
            <DiffBadge diff={diff.totalRoutes} />
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>{actual.totalRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>skutečnost</div>
            </div>
            <div style={{ color: 'var(--color-text-light)' }}>/</div>
            <div>
              <div className="text-lg" style={{ color: 'var(--color-text-muted)' }}>{planned.totalRoutes}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>plán</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rozdělení podle dep */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VRATIMOV */}
        <div className="p-4 rounded-xl" style={{ 
          backgroundColor: diff.vratimovTotal === 0 ? 'var(--color-green-light)' : 'var(--color-purple-light)',
          border: `1px solid ${diff.vratimovTotal === 0 ? 'var(--color-green)' : 'var(--color-purple)'}30`
        }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold" style={{ color: 'var(--color-purple)' }}>🏭 Depo Vratimov</span>
            <DiffBadge diff={diff.vratimovTotal || 0} />
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>DPO</span>
                <DiffBadge diff={diff.vratimovDpo || 0} size="small" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: 'var(--color-purple)' }}>{actual.vratimovDpo || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.vratimovDpo || 0}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>SD</span>
                <DiffBadge diff={diff.vratimovSd || 0} size="small" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: 'var(--color-purple)' }}>{actual.vratimovSd || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.vratimovSd || 0}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Celkem</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: 'var(--color-purple)' }}>{actual.vratimovRoutes || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.vratimovTotal || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-1 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-purple)' }}>
                {(actual.vratimovKm || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-purple)' }}>
                {actual.vratimovRoutes > 0 
                  ? Math.round((actual.vratimovKm || 0) / actual.vratimovRoutes).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.vratimovTotal > 0 && planned.vratimovKm > 0
                  ? Math.round((planned.vratimovKm || 0) / planned.vratimovTotal).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø pl. km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.vratimovTotal > 0 && planned.vratimovDuration > 0
                  ? formatDuration((planned.vratimovDuration || 0) / planned.vratimovTotal)
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø pl. čas</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.vratimovTotal > 0 && planned.vratimovStops > 0
                  ? Math.round((planned.vratimovStops || 0) / planned.vratimovTotal).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø boxů</div>
            </div>
          </div>
        </div>
        
        {/* NOVÝ BYDŽOV */}
        <div className="p-4 rounded-xl" style={{ 
          backgroundColor: diff.bydzovTotal === 0 ? 'var(--color-green-light)' : 'var(--color-cyan-light)',
          border: `1px solid ${diff.bydzovTotal === 0 ? 'var(--color-green)' : 'var(--color-cyan)'}30`
        }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold" style={{ color: '#0891b2' }}>🏭 Depo Nový Bydžov</span>
            <DiffBadge diff={diff.bydzovTotal || 0} />
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>DPO</span>
                <DiffBadge diff={diff.bydzovDpo || 0} size="small" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: '#0891b2' }}>{actual.bydzovDpo || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.bydzovDpo || 0}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>SD</span>
                <DiffBadge diff={diff.bydzovSd || 0} size="small" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: '#0891b2' }}>{actual.bydzovSd || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.bydzovSd || 0}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Celkem</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: '#0891b2' }}>{actual.bydzovRoutes || 0}</span>
                <span style={{ color: 'var(--color-text-light)' }}>/</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{planned.bydzovTotal || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-1 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: '#0891b2' }}>
                {(actual.bydzovKm || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: '#0891b2' }}>
                {actual.bydzovRoutes > 0 
                  ? Math.round((actual.bydzovKm || 0) / actual.bydzovRoutes).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.bydzovTotal > 0 && planned.bydzovKm > 0
                  ? Math.round((planned.bydzovKm || 0) / planned.bydzovTotal).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø pl. km</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.bydzovTotal > 0 && planned.bydzovDuration > 0
                  ? formatDuration((planned.bydzovDuration || 0) / planned.bydzovTotal)
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø pl. čas</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                {planned.bydzovTotal > 0 && planned.bydzovStops > 0
                  ? Math.round((planned.bydzovStops || 0) / planned.bydzovTotal).toLocaleString('cs-CZ')
                  : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-light)' }}>Ø boxů</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DailyTable({ days, viewMode = 'total' }) {
  if (!days || days.length === 0) return null
  
  const formatPlanName = (plan) => {
    if (!plan?.fileName) return ''
    const name = plan.fileName.replace('.xlsx', '').replace('.xls', '')
    if (name.includes('Depo Východ') || name.includes('Depo_Vy_chod') || name.includes('Depo Vychod')) {
      const match = name.match(/(\d{2}-\d{2}-\d{2})(_DPO|_SD)?$/)
      return match ? `Východ ${match[1]}${match[2] || ''}` : name
    }
    const match = name.match(/(\d{2}-\d{2}-\d{2})(_DPO|_SD)?$/)
    return match ? `${match[1]}${match[2] || ''}` : name
  }
  
  const formatPlansWithDepot = (plans) => {
    if (!plans || plans.length === 0) return '—'
    
    const vratimovPlans = plans.filter(p => p.depot === 'VRATIMOV' || p.depot === 'BOTH')
    const bydzovPlans = plans.filter(p => p.depot === 'BYDZOV' || p.depot === 'BOTH')
    
    const parts = []
    if (vratimovPlans.length > 0) {
      parts.push(`🟣 ${vratimovPlans.map(formatPlanName).join(', ')}`)
    }
    if (bydzovPlans.length > 0) {
      parts.push(`🔵 ${bydzovPlans.map(formatPlanName).join(', ')}`)
    }
    
    return parts.length > 0 ? parts.join(' | ') : '—'
  }
  
  if (viewMode === 'total') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Den</th>
              <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>DPO (ranní)</th>
              <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>SD (odpolední)</th>
              <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>Celkem</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>KM</th>
              <th className="text-center p-3 font-medium" style={{ color: 'var(--color-purple)' }}>Vrat.</th>
              <th className="text-center p-3 font-medium" style={{ color: '#0891b2' }}>Bydž.</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Plány</th>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <th className="text-left p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Datum</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Plán</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Skut.</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Rozdíl</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Plán</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Skut.</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Rozdíl</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Plán</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Skut.</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Rozdíl</th>
              <th className="text-right p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Celkem</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Tras</th>
              <th className="text-center p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Tras</th>
              <th className="text-left p-2 font-normal text-xs" style={{ color: 'var(--color-text-light)' }}>Soubory</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const hasIssue = !day.isOk && day.hasData
              const noData = !day.hasData
              const noPlan = !day.hasPlan
              
              return (
                <tr 
                  key={day.date}
                  style={{ 
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: hasIssue ? 'var(--color-orange-light)' : 
                                    noData ? 'var(--color-bg)' : 
                                    noPlan ? 'var(--color-red-light)' : 'transparent'
                  }}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-medium" style={{ 
                        color: ['So', 'Ne'].includes(day.dayOfWeek) ? 'var(--color-text-light)' : 'var(--color-text)' 
                      }}>
                        {day.dayOfWeek}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--color-text-dark)' }}>{day.dayNumber}.</span>
                    </div>
                  </td>
                  
                  <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{day.plannedDpo}</td>
                  <td className="text-center p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>{day.hasData ? day.actualDpo : '—'}</td>
                  <td className="text-center p-3">{day.hasData ? <DiffBadge diff={day.diffDpo} size="small" /> : '—'}</td>
                  
                  <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{day.plannedSd}</td>
                  <td className="text-center p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>{day.hasData ? day.actualSd : '—'}</td>
                  <td className="text-center p-3">{day.hasData ? <DiffBadge diff={day.diffSd} size="small" /> : '—'}</td>
                  
                  <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{day.plannedTotal}</td>
                  <td className="text-center p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>{day.hasData ? day.actualTotal : '—'}</td>
                  <td className="text-center p-3">{day.hasData ? <DiffBadge diff={day.diffTotal} size="small" /> : '—'}</td>
                  
                  <td className="text-right p-3 font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
                    {day.hasData && day.actualTotalKm > 0 
                      ? day.actualTotalKm.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) 
                      : '—'}
                  </td>
                  
                  <td className="text-center p-3" style={{ color: 'var(--color-purple)' }}>
                    {day.hasData ? day.vratimovTotal : '—'}
                  </td>
                  
                  <td className="text-center p-3" style={{ color: '#0891b2' }}>
                    {day.hasData ? day.bydzovTotal : '—'}
                  </td>
                  
                  <td className="text-left p-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatPlansWithDepot(day.plans)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold" style={{ borderTop: '2px solid var(--color-border)' }}>
              <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>CELKEM</td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
                {days.reduce((sum, d) => sum + d.plannedDpo, 0)}
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-dark)' }}>
                {days.reduce((sum, d) => sum + (d.hasData ? d.actualDpo : 0), 0)}
              </td>
              <td className="text-center p-3">
                <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffDpo : 0), 0)} />
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
                {days.reduce((sum, d) => sum + d.plannedSd, 0)}
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-dark)' }}>
                {days.reduce((sum, d) => sum + (d.hasData ? d.actualSd : 0), 0)}
              </td>
              <td className="text-center p-3">
                <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffSd : 0), 0)} />
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
                {days.reduce((sum, d) => sum + d.plannedTotal, 0)}
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-text-dark)' }}>
                {days.reduce((sum, d) => sum + (d.hasData ? d.actualTotal : 0), 0)}
              </td>
              <td className="text-center p-3">
                <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffTotal : 0), 0)} />
              </td>
              <td className="text-right p-3 font-mono" style={{ color: 'var(--color-primary)' }}>
                {days.reduce((sum, d) => sum + (d.actualTotalKm || 0), 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
              </td>
              <td className="text-center p-3" style={{ color: 'var(--color-purple)' }}>
                {days.reduce((sum, d) => sum + (d.vratimovTotal || 0), 0)}
              </td>
              <td className="text-center p-3" style={{ color: '#0891b2' }}>
                {days.reduce((sum, d) => sum + (d.bydzovTotal || 0), 0)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }
  
  // Depot-specific view (vratimov or bydzov)
  const isVratimov = viewMode === 'vratimov'
  const depotColor = isVratimov ? 'var(--color-purple)' : '#0891b2'
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Den</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>DPO</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>SD</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }} colSpan={3}>Celkem</th>
            <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>KM</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const planned = isVratimov 
              ? { dpo: day.plannedVratimovDpo || 0, sd: day.plannedVratimovSd || 0, total: day.plannedVratimovTotal || 0 }
              : { dpo: day.plannedBydzovDpo || 0, sd: day.plannedBydzovSd || 0, total: day.plannedBydzovTotal || 0 }
            const actual = isVratimov 
              ? { dpo: day.vratimovDpo || 0, sd: day.vratimovSd || 0, total: day.vratimovTotal || 0, km: day.vratimovKm || 0 }
              : { dpo: day.bydzovDpo || 0, sd: day.bydzovSd || 0, total: day.bydzovTotal || 0, km: day.bydzovKm || 0 }
            const diff = isVratimov
              ? { dpo: day.diffVratimovDpo || 0, sd: day.diffVratimovSd || 0, total: day.diffVratimovTotal || 0 }
              : { dpo: day.diffBydzovDpo || 0, sd: day.diffBydzovSd || 0, total: day.diffBydzovTotal || 0 }
            
            const hasIssue = diff.total !== 0 && day.hasData
            
            return (
              <tr 
                key={day.date} 
                style={{ 
                  borderBottom: '1px solid var(--color-border-light)',
                  backgroundColor: hasIssue ? 'var(--color-orange-light)' : 'transparent'
                }}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center font-medium" style={{ 
                      color: ['So', 'Ne'].includes(day.dayOfWeek) ? 'var(--color-text-light)' : 'var(--color-text)' 
                    }}>
                      {day.dayOfWeek}
                    </span>
                    <span className="font-bold" style={{ color: 'var(--color-text-dark)' }}>{day.dayNumber}.</span>
                  </div>
                </td>
                <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{planned.dpo}</td>
                <td className="text-center p-3 font-medium" style={{ color: depotColor }}>{day.hasData ? actual.dpo : '—'}</td>
                <td className="text-center p-3">{day.hasData ? <DiffBadge diff={diff.dpo} size="small" /> : '—'}</td>
                <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{planned.sd}</td>
                <td className="text-center p-3 font-medium" style={{ color: depotColor }}>{day.hasData ? actual.sd : '—'}</td>
                <td className="text-center p-3">{day.hasData ? <DiffBadge diff={diff.sd} size="small" /> : '—'}</td>
                <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>{planned.total}</td>
                <td className="text-center p-3 font-medium" style={{ color: depotColor }}>{day.hasData ? actual.total : '—'}</td>
                <td className="text-center p-3">{day.hasData ? <DiffBadge diff={diff.total} size="small" /> : '—'}</td>
                <td className="text-right p-3 font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
                  {day.hasData && actual.km > 0 
                    ? actual.km.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) 
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold" style={{ borderTop: '2px solid var(--color-border)' }}>
            <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>CELKEM</td>
            <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
              {days.reduce((sum, d) => {
                const planned = isVratimov 
                  ? (d.plannedVratimovDpo || 0) 
                  : (d.plannedBydzovDpo || 0)
                return sum + planned
              }, 0)}
            </td>
            <td className="text-center p-3" style={{ color: depotColor }}>
              {days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const actual = isVratimov ? (d.vratimovDpo || 0) : (d.bydzovDpo || 0)
                return sum + actual
              }, 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const diff = isVratimov ? (d.diffVratimovDpo || 0) : (d.diffBydzovDpo || 0)
                return sum + diff
              }, 0)} />
            </td>
            <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
              {days.reduce((sum, d) => {
                const planned = isVratimov 
                  ? (d.plannedVratimovSd || 0) 
                  : (d.plannedBydzovSd || 0)
                return sum + planned
              }, 0)}
            </td>
            <td className="text-center p-3" style={{ color: depotColor }}>
              {days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const actual = isVratimov ? (d.vratimovSd || 0) : (d.bydzovSd || 0)
                return sum + actual
              }, 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const diff = isVratimov ? (d.diffVratimovSd || 0) : (d.diffBydzovSd || 0)
                return sum + diff
              }, 0)} />
            </td>
            <td className="text-center p-3" style={{ color: 'var(--color-text-muted)' }}>
              {days.reduce((sum, d) => {
                const planned = isVratimov 
                  ? (d.plannedVratimovTotal || 0) 
                  : (d.plannedBydzovTotal || 0)
                return sum + planned
              }, 0)}
            </td>
            <td className="text-center p-3" style={{ color: depotColor }}>
              {days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const actual = isVratimov ? (d.vratimovTotal || 0) : (d.bydzovTotal || 0)
                return sum + actual
              }, 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const diff = isVratimov ? (d.diffVratimovTotal || 0) : (d.diffBydzovTotal || 0)
                return sum + diff
              }, 0)} />
            </td>
            <td className="text-right p-3 font-mono" style={{ color: 'var(--color-primary)' }}>
              {days.reduce((sum, d) => {
                if (!d.hasData) return sum
                const km = isVratimov ? (d.vratimovKm || 0) : (d.bydzovKm || 0)
                return sum + km
              }, 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const { selectedCarrierId, selectedPeriod } = useCarrier()
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false)
  const [viewMode, setViewMode] = useState('total')

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', selectedPeriod],
    queryFn: () => analysis.getDashboard({ period: selectedPeriod })
  })

  const { data: periodProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod, selectedCarrierId],
    queryFn: () => proofs.getAll({ period: selectedPeriod, carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: periodInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod, selectedCarrierId],
    queryFn: () => invoices.getAll({ period: selectedPeriod, carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const proof = periodProofs?.[0]
  const invoiceList = periodInvoices || []
  
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['dailyBreakdown', proof?.id],
    queryFn: () => routePlans.dailyBreakdown(proof.id),
    enabled: !!proof?.id
  })

  // Historie - všechny proofy a faktury pro tabulku
  const historyPeriods = getPeriodOptions()
  
  const { data: allProofsHistory } = useQuery({
    queryKey: ['proofsHistory', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: allInvoicesHistory } = useQuery({
    queryKey: ['invoicesHistory', selectedCarrierId],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const getHistoryDataForPeriod = (period) => {
    const periodProof = allProofsHistory?.find(p => p.period === period)
    const periodInvs = allInvoicesHistory?.filter(i => i.period === period) || []
    
    const proofTotal = periodProof ? parseFloat(periodProof.grandTotal || 0) : 0
    const invoicedTotal = periodInvs.reduce((sum, inv) => 
      sum + parseFloat(inv.totalWithoutVat || 0), 0
    )
    
    let status = 'pending'
    if (periodProof && periodInvs.length > 0) {
      const diff = Math.abs(proofTotal - invoicedTotal)
      if (diff < 1000) status = 'ok'
      else if (invoicedTotal < proofTotal * 0.5) status = 'warning'
      else status = 'partial'
    } else if (periodProof && periodInvs.length === 0) {
      status = 'warning'
    }

    return { proof: periodProof, periodInvoices: periodInvs, proofTotal, invoicedTotal, status }
  }

  const totalProof = proof?.grandTotal ? parseFloat(proof.grandTotal) : 0
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const remaining = totalProof - totalInvoiced

  const comparisonStatus = dailyData?.summary?.status || null
  const daysWithDiff = dailyData?.summary?.daysWithDiff || 0

  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Přehled nákladů na dopravu</p>
        </div>
        <div className="card p-8 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-orange)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>Vyberte dopravce</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pro zobrazení dashboardu vyberte dopravce v horním menu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Přehled nákladů na dopravu</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InvoicesDetailCard invoices={invoiceList} proofTotal={totalProof} />
        
        <ProofDetailCard proof={proof} />
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ backgroundColor: remaining === 0 ? 'var(--color-green-light)' : 'var(--color-orange-light)', 
                       color: remaining === 0 ? 'var(--color-green)' : '#e67e22' }}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Faktury vs. Proof</span>
          </div>
          <div className="stat-card-value">
            {remaining === 0 ? (
              <span style={{ color: 'var(--color-green)' }}>✓ Vše sedí</span>
            ) : (
              <>
                {formatCZK(Math.abs(remaining))}
                <span className="text-sm font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                  {remaining > 0 ? 'vyfakturováno méně, než v proofu' : 'vyfakturováno více, než v proofu'}
                </span>
              </>
            )}
          </div>
        </div>
        
        <SummaryCard 
          icon={Map}
          label="Plánovací soubory vs Proof"
          value={
            comparisonStatus === 'ok' ? '✓ OK' :
            comparisonStatus === 'warning' ? `⚠ ${daysWithDiff} dnů s rozdílem` :
            '—'
          }
          subtext={dailyData ? `${dailyData.month?.totalDays} dnů v měsíci` : 'Načítání...'}
          color={comparisonStatus === 'ok' ? 'green' : comparisonStatus === 'warning' ? 'orange' : 'purple'}
        />
      </div>

      {/* Plan vs Proof Comparison */}
      {proof && dailyData && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Map size={20} style={{ color: 'var(--color-primary)' }} />
              Plánovací soubory vs Proof — {dailyData.month?.monthName} {dailyData.month?.year}
            </h2>
            <div className="flex items-center gap-3">
              {dailyData.summary && (
                <span className="badge" style={{ 
                  backgroundColor: dailyData.summary.status === 'ok' ? 'var(--color-green-light)' : 'var(--color-orange-light)',
                  color: dailyData.summary.status === 'ok' ? 'var(--color-green)' : '#e67e22'
                }}>
                  {dailyData.summary.status === 'ok' 
                    ? 'Vše v pořádku' 
                    : `${dailyData.summary.daysWithDiff} dnů s rozdílem`}
                </span>
              )}
              <button
                onClick={() => setShowDailyBreakdown(!showDailyBreakdown)}
                className="btn btn-ghost flex items-center gap-2"
              >
                {showDailyBreakdown ? 'Skrýt detail' : 'Zobrazit detail'}
                {showDailyBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          <div className="p-6">
            <ComparisonSummary data={dailyData} />

            {showDailyBreakdown && (
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Denní přehled</h3>
                  <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <button
                      onClick={() => setViewMode('total')}
                      className={`tab ${viewMode === 'total' ? 'active' : ''}`}
                    >
                      Celkem
                    </button>
                    <button
                      onClick={() => setViewMode('vratimov')}
                      className="tab"
                      style={viewMode === 'vratimov' ? { backgroundColor: 'var(--color-purple)', color: 'white' } : {}}
                    >
                      Vratimov
                    </button>
                    <button
                      onClick={() => setViewMode('bydzov')}
                      className="tab"
                      style={viewMode === 'bydzov' ? { backgroundColor: '#0891b2', color: 'white' } : {}}
                    >
                      Nový Bydžov
                    </button>
                  </div>
                </div>
                
                {dailyLoading ? (
                  <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Načítání...</div>
                ) : (
                  <DailyTable days={dailyData.days} viewMode={viewMode} />
                )}
                
                {viewMode === 'total' && (
                  <div className="flex flex-wrap gap-4 mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-orange-light)' }} />
                      <span>Den s rozdílem</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-red-light)' }} />
                      <span>Den bez plánu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-bg)' }} />
                      <span>Den bez dat v proofu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-purple-light)' }} />
                      <span>Vratimov</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-cyan-light)' }} />
                      <span>Nový Bydžov</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {proof && !dailyData && dailyLoading && (
        <div className="card p-8 text-center">
          <div style={{ color: 'var(--color-text-muted)' }}>Načítání porovnání...</div>
        </div>
      )}

      {/* No proof warning */}
      {!proof && !isLoading && (
        <div className="card p-8 text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-orange)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>Chybí proof za toto období</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Nahrajte proof od dopravce pro zobrazení porovnání s plány.
          </p>
        </div>
      )}

      {/* Historie - posledních 12 měsíců */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
            <Calendar size={20} style={{ color: 'var(--color-primary)' }} />
            Historie — posledních 12 měsíců
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Období</th>
                <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Proof</th>
                <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Faktury</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Proof částka</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Fakturováno</th>
                <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyPeriods.map(period => {
                const { proof: histProof, periodInvoices: histInvs, proofTotal: histProofTotal, invoicedTotal: histInvoicedTotal, status } = getHistoryDataForPeriod(period)
                const hasData = histProof || histInvs.length > 0
                const isCurrentPeriod = period === selectedPeriod
                
                return (
                  <tr 
                    key={period}
                    style={{ 
                      borderBottom: '1px solid var(--color-border-light)',
                      backgroundColor: isCurrentPeriod ? 'var(--color-primary-light)' : 'transparent'
                    }}
                  >
                    <td className="p-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                      {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                      {isCurrentPeriod && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                          aktuální
                        </span>
                      )}
                    </td>
                    <td className="text-center p-3">
                      {histProof ? (
                        <CheckCircle className="w-5 h-5 inline" style={{ color: 'var(--color-green)' }} />
                      ) : (
                        <span style={{ color: 'var(--color-text-light)' }}>—</span>
                      )}
                    </td>
                    <td className="text-center p-3">
                      {histInvs.length > 0 ? (
                        <span style={{ color: 'var(--color-green)' }}>{histInvs.length}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-light)' }}>—</span>
                      )}
                    </td>
                    <td className="text-right p-3" style={{ color: 'var(--color-text-dark)' }}>
                      {histProof ? formatCZK(histProofTotal) : '—'}
                    </td>
                    <td className="text-right p-3" style={{ color: 'var(--color-text-dark)' }}>
                      {histInvs.length > 0 ? formatCZK(histInvoicedTotal) : '—'}
                    </td>
                    <td className="text-center p-3">
                      {!hasData ? (
                        <span className="badge" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-light)' }}>
                          Žádná data
                        </span>
                      ) : status === 'ok' ? (
                        <span className="badge" style={{ backgroundColor: 'var(--color-green-light)', color: 'var(--color-green)' }}>
                          <CheckCircle className="w-3 h-3 mr-1 inline" />
                          OK
                        </span>
                      ) : status === 'warning' ? (
                        <span className="badge" style={{ backgroundColor: 'var(--color-orange-light)', color: '#e67e22' }}>
                          <AlertTriangle className="w-3 h-3 mr-1 inline" />
                          Chybí faktury
                        </span>
                      ) : status === 'partial' ? (
                        <span className="badge" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                          <FileText className="w-3 h-3 mr-1 inline" />
                          Částečně
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>
                          <AlertCircle className="w-3 h-3 mr-1 inline" />
                          Rozdíl
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
