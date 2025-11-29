import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  TrendingUp,
  ArrowRight,
  Calendar,
  MoreVertical,
  Sparkles,
  Truck,
  Receipt,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { analysis, proofs, invoices, carriers } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function getPeriodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    options.push(format(date, 'MM/yyyy'))
  }
  return options
}

// Donut Chart Component
function DonutChart({ data, size = 140, strokeWidth = 20 }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  
  let currentOffset = 0
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {/* Data segments */}
        {data.map((item, index) => {
          const percentage = item.value / total
          const strokeDasharray = `${circumference * percentage} ${circumference}`
          const strokeDashoffset = -currentOffset
          currentOffset += circumference * percentage
          
          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          )
        })}
      </svg>
    </div>
  )
}

// Progress Ring Component
function ProgressRing({ percentage, size = 80, strokeWidth = 8, color = '#2563eb' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-lg font-bold text-gray-900">{percentage}%</span>
    </div>
  )
}

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', selectedPeriod],
    queryFn: () => analysis.getDashboard({ period: selectedPeriod })
  })

  const { data: periodProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod],
    queryFn: () => proofs.getAll({ period: selectedPeriod })
  })

  const { data: periodInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod],
    queryFn: () => invoices.getAll({ period: selectedPeriod })
  })

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  const proof = periodProofs?.[0]
  const invoiceList = periodInvoices || []
  
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const totalProof = proof ? parseFloat(proof.grandTotal || 0) : 0
  const remaining = totalProof - totalInvoiced
  const invoicePercentage = totalProof > 0 ? Math.round((totalInvoiced / totalProof) * 100) : 0

  // Donut chart data for invoice breakdown
  const invoiceBreakdown = [
    { label: 'FIX', value: parseFloat(proof?.totalFix || 0), color: '#2563eb' },
    { label: 'KM', value: parseFloat(proof?.totalKm || 0), color: '#10b981' },
    { label: 'Linehaul', value: parseFloat(proof?.totalLinehaul || 0), color: '#f59e0b' },
    { label: 'DEPO', value: parseFloat(proof?.totalDepo || 0), color: '#8b5cf6' },
  ].filter(item => item.value > 0)

  // Activity items
  const recentActivity = [
    { type: 'success', title: 'Proof nahrán', desc: `${selectedPeriod}`, time: 'Dnes' },
    { type: 'info', title: `${invoiceList.length} faktur nahráno`, desc: 'Ke kontrole', time: 'Dnes' },
    { type: remaining > 1000 ? 'warning' : 'success', title: remaining > 1000 ? 'Neúplná fakturace' : 'Kompletní', desc: formatCZK(remaining), time: 'Aktuální' },
  ]

  const periodLabel = format(
    new Date(selectedPeriod.split('/')[1], parseInt(selectedPeriod.split('/')[0]) - 1),
    'LLLL yyyy',
    { locale: cs }
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Přehled</h1>
          <p className="text-gray-500 text-sm mt-1">Kontrola nákladů na dopravu</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Calendar size={18} className="text-gray-400" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer pr-6"
          >
            {getPeriodOptions().map(period => (
              <option key={period} value={period}>
                {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Carrier Info */}
      {carrierList?.[0] && (
        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Truck size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{carrierList[0].name}</h2>
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                LIVE
              </span>
            </div>
            <p className="text-sm text-gray-500">IČO: {carrierList[0].ico || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Proof Total */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="stat-icon bg-blue-50">
              <FileText size={22} className="text-blue-600" />
            </div>
            <span className={`flex items-center gap-1 text-xs font-medium ${proof ? 'text-emerald-600' : 'text-gray-400'}`}>
              {proof ? (
                <>
                  <CheckCircle size={14} />
                  Nahráno
                </>
              ) : (
                <>Chybí</>
              )}
            </span>
          </div>
          <div className="stat-value">{formatCZK(totalProof)}</div>
          <div className="stat-label">Proof celkem</div>
        </div>

        {/* Invoiced */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="stat-icon bg-emerald-50">
              <Receipt size={22} className="text-emerald-600" />
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <ArrowUpRight size={14} />
              {invoiceList.length} faktur
            </span>
          </div>
          <div className="stat-value">{formatCZK(totalInvoiced)}</div>
          <div className="stat-label">Fakturováno</div>
        </div>

        {/* Remaining */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className={`stat-icon ${remaining > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <TrendingUp size={22} className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'} />
            </div>
            {remaining > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <ArrowDownRight size={14} />
                K dofakturování
              </span>
            )}
          </div>
          <div className={`stat-value ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCZK(remaining)}
          </div>
          <div className="stat-label">Zbývá</div>
        </div>

        {/* Status */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className={`stat-icon ${
              !proof ? 'bg-red-50' : remaining > 1000 ? 'bg-amber-50' : 'bg-emerald-50'
            }`}>
              {!proof ? (
                <AlertCircle size={22} className="text-red-600" />
              ) : remaining > 1000 ? (
                <AlertTriangle size={22} className="text-amber-600" />
              ) : (
                <CheckCircle size={22} className="text-emerald-600" />
              )}
            </div>
          </div>
          <div className="stat-value text-xl">
            {!proof ? 'Chybí data' : remaining > 1000 ? 'Neúplné' : 'Kompletní'}
          </div>
          <div className="stat-label">
            {!proof ? 'Nahrajte proof' : remaining > 1000 ? 'Chybí faktury' : 'Vše sedí'}
          </div>
        </div>
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Widget */}
        <div className="widget lg:col-span-2">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Sparkles size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="widget-title">Detail proofu</h3>
                <p className="widget-subtitle">{periodLabel}</p>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <MoreVertical size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="widget-body">
            {proof ? (
              <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                {/* Left side - amounts */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-xs text-blue-600 font-medium mb-1">FIX</p>
                    <p className="text-xl font-bold text-gray-900">{formatCZK(proof.totalFix)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl">
                    <p className="text-xs text-emerald-600 font-medium mb-1">KM</p>
                    <p className="text-xl font-bold text-gray-900">{formatCZK(proof.totalKm)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-600 font-medium mb-1">Linehaul</p>
                    <p className="text-xl font-bold text-gray-900">{formatCZK(proof.totalLinehaul)}</p>
                  </div>
                  <div className="p-4 bg-violet-50 rounded-xl">
                    <p className="text-xs text-violet-600 font-medium mb-1">DEPO</p>
                    <p className="text-xl font-bold text-gray-900">{formatCZK(proof.totalDepo)}</p>
                  </div>
                </div>

                {/* Right side - progress rings */}
                <div className="flex items-center gap-6 justify-center lg:justify-end">
                  <div className="text-center">
                    <ProgressRing percentage={invoicePercentage} color="#10b981" />
                    <p className="text-xs text-gray-500 mt-2">Vyfakturováno</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCZK(totalInvoiced)}</p>
                  </div>
                  <div className="text-center">
                    <ProgressRing percentage={100 - invoicePercentage} color="#f59e0b" />
                    <p className="text-xs text-gray-500 mt-2">Zbývá</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCZK(remaining)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Žádný proof pro toto období</p>
                <button className="btn btn-primary mt-4">
                  Nahrát proof
                </button>
              </div>
            )}
          </div>

          <div className="widget-footer">
            <button className="link-btn">
              Zobrazit detail
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Activity Monitor Widget */}
        <div className="widget">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="widget-title">Stav</h3>
                <p className="widget-subtitle">Aktivita</p>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <MoreVertical size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="widget-body">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl mb-4 ${
              !proof ? 'bg-red-50 border border-red-100' :
              remaining > 1000 ? 'bg-amber-50 border border-amber-100' :
              'bg-emerald-50 border border-emerald-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  !proof ? 'bg-red-100' :
                  remaining > 1000 ? 'bg-amber-100' :
                  'bg-emerald-100'
                }`}>
                  {!proof ? (
                    <AlertCircle size={20} className="text-red-600" />
                  ) : remaining > 1000 ? (
                    <AlertTriangle size={20} className="text-amber-600" />
                  ) : (
                    <CheckCircle size={20} className="text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className={`font-medium ${
                    !proof ? 'text-red-700' :
                    remaining > 1000 ? 'text-amber-700' :
                    'text-emerald-700'
                  }`}>
                    {!proof ? 'Chybí proof' : remaining > 1000 ? 'Neúplná fakturace' : 'Vše v pořádku'}
                  </p>
                  <p className={`text-xs ${
                    !proof ? 'text-red-600' :
                    remaining > 1000 ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                    {!proof ? 'Nahrajte XLSX soubor' : remaining > 1000 ? `Zbývá ${formatCZK(remaining)}` : 'Fakturace kompletní'}
                  </p>
                </div>
              </div>
            </div>

            {/* Activity List */}
            <div className="space-y-0 divide-y divide-gray-100">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="activity-item">
                  <div className={`activity-dot ${
                    item.type === 'success' ? 'bg-emerald-500' :
                    item.type === 'warning' ? 'bg-amber-500' :
                    item.type === 'error' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="activity-content">
                    <p className="activity-title">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <span className="activity-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="widget-footer">
            <button className="link-btn">
              Zobrazit historii
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row - Invoices & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices Table */}
        <div className="widget lg:col-span-2">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Receipt size={16} className="text-violet-600" />
              </div>
              <div>
                <h3 className="widget-title">Faktury</h3>
                <p className="widget-subtitle">{periodLabel}</p>
              </div>
            </div>
            <span className="badge badge-info">{invoiceList.length}</span>
          </div>

          {invoiceList.length === 0 ? (
            <div className="p-8 text-center">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Žádné faktury pro toto období</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Číslo</th>
                    <th>Typ</th>
                    <th className="text-right">Částka</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.slice(0, 5).map(invoice => (
                    <tr key={invoice.id} className="cursor-pointer">
                      <td className="font-medium text-gray-900">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {invoice.items?.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="badge badge-info">
                              {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right font-medium text-gray-900">
                        {formatCZK(invoice.totalWithoutVat)}
                      </td>
                      <td>
                        <span className={`badge ${
                          invoice.status === 'matched' ? 'badge-success' :
                          invoice.status === 'disputed' ? 'badge-error' :
                          'badge-warning'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' :
                           invoice.status === 'disputed' ? 'Sporná' :
                           'Ke kontrole'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoiceList.length > 5 && (
            <div className="widget-footer">
              <button className="link-btn">
                Zobrazit všechny ({invoiceList.length})
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Breakdown Donut Chart */}
        <div className="widget">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <TrendingUp size={16} className="text-rose-600" />
              </div>
              <div>
                <h3 className="widget-title">Rozložení</h3>
                <p className="widget-subtitle">Náklady dle typu</p>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <MoreVertical size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="widget-body">
            {invoiceBreakdown.length > 0 ? (
              <>
                <div className="flex justify-center">
                  <DonutChart data={invoiceBreakdown} />
                </div>

                <div className="donut-legend justify-center mt-6">
                  {invoiceBreakdown.map((item, idx) => (
                    <div key={idx} className="donut-legend-item">
                      <div 
                        className="donut-legend-dot" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-gray-400 text-xs">
                        ({Math.round((item.value / invoiceBreakdown.reduce((s, i) => s + i.value, 0)) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <TrendingUp size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Žádná data</p>
              </div>
            )}
          </div>

          <div className="widget-footer">
            <button className="link-btn">
              Detail analýzy
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
