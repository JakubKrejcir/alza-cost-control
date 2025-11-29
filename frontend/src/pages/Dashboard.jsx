import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  TrendingUp, 
  TrendingDown,
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Calendar,
  ChevronRight,
  MoreVertical,
  Activity,
  PieChart
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

function formatShort(amount) {
  if (amount == null) return '—'
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
  return amount.toString()
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

// Simple donut chart component
function DonutChart({ value, max, color, size = 120 }) {
  const percentage = Math.round((value / max) * 100) || 0
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="progress-ring-value">
        <span className="text-2xl font-bold">{percentage}%</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  const { data: periodProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod],
    queryFn: () => proofs.getAll({ period: selectedPeriod })
  })

  const { data: periodInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod],
    queryFn: () => invoices.getAll({ period: selectedPeriod })
  })

  const { data: allProofs } = useQuery({
    queryKey: ['proofs'],
    queryFn: () => proofs.getAll()
  })

  const proof = periodProofs?.[0]
  const invoiceList = periodInvoices || []
  
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const totalProof = proof ? parseFloat(proof.grandTotal || 0) : 0
  const remaining = totalProof - totalInvoiced

  // Calculate category breakdown
  const fixAmount = proof ? parseFloat(proof.totalFix || 0) : 0
  const kmAmount = proof ? parseFloat(proof.totalKm || 0) : 0
  const linehaulAmount = proof ? parseFloat(proof.totalLinehaul || 0) : 0
  const depoAmount = proof ? parseFloat(proof.totalDepo || 0) : 0

  // Recent activity from proofs
  const recentProofs = (allProofs || []).slice(0, 4)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Přehled</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-green-400 flex items-center justify-center">
              <span className="text-white text-xs font-bold">TB</span>
            </div>
            <span className="text-gray-600 font-medium">TransportBrain</span>
            <span className="badge badge-success text-xs">
              <span className="status-dot success mr-1"></span>
              LIVE
            </span>
          </div>
        </div>
        
        <div className="date-picker">
          <Calendar size={16} className="text-gray-400" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-sm text-gray-600 cursor-pointer"
          >
            {getPeriodOptions().map(period => (
              <option key={period} value={period}>
                {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Revenue Card - Large */}
        <div className="col-span-5 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Activity size={16} className="text-blue-500" />
                Náklady
              </div>
              <div className="card-subtitle">Přehled období</div>
            </div>
            <button className="menu-dots">
              <MoreVertical size={16} />
            </button>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Celkem</span>
              <span className="text-3xl font-bold text-gray-800">{formatShort(totalProof)}</span>
              <span className="text-xs text-gray-400">Kč</span>
            </div>
            
            {/* Mini bar chart placeholder */}
            <div className="h-24 flex items-end gap-1 mb-4">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 70].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-blue-100 rounded-t hover:bg-blue-200 transition-colors"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-500">FIX</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-gray-500">KM</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span className="text-gray-500">Linehaul</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <button 
              onClick={() => proof && navigate(`/proof/${proof.id}`)}
              className="link-arrow"
            >
              Zobrazit detail <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Invoiced Progress */}
        <div className="col-span-3 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <PieChart size={16} className="text-green-500" />
                Fakturováno
              </div>
              <div className="card-subtitle">Stav období</div>
            </div>
          </div>
          <div className="card-body flex flex-col items-center">
            <DonutChart 
              value={totalInvoiced} 
              max={totalProof || 1} 
              color="#48bb78" 
            />
            <div className="mt-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{formatCZK(totalInvoiced)}</div>
              <div className="text-xs text-gray-400">z {formatCZK(totalProof)}</div>
            </div>
          </div>
        </div>

        {/* Activity Monitor */}
        <div className="col-span-4 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Activity size={16} className="text-blue-500" />
                Aktivita
              </div>
              <div className="card-subtitle">Poslední změny</div>
            </div>
          </div>
          <div className="card-body">
            {/* Status alert */}
            {proof && remaining <= 1000 ? (
              <div className="alert-success flex items-center gap-3 mb-4">
                <CheckCircle className="text-green-500" size={20} />
                <div>
                  <div className="font-medium text-green-800 text-sm">Vše v pořádku</div>
                  <div className="text-xs text-green-600">Fakturace je kompletní</div>
                </div>
              </div>
            ) : proof ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <AlertTriangle className="text-orange-500" size={20} />
                <div>
                  <div className="font-medium text-orange-800 text-sm">Pozor</div>
                  <div className="text-xs text-orange-600">Zbývá {formatCZK(remaining)}</div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <FileText className="text-gray-400" size={20} />
                <div>
                  <div className="font-medium text-gray-600 text-sm">Chybí data</div>
                  <div className="text-xs text-gray-400">Nahrajte proof</div>
                </div>
              </div>
            )}

            {/* Activity items */}
            <div className="space-y-1">
              {recentProofs.map((p, idx) => (
                <div key={p.id} className="activity-item">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    idx === 0 ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">
                      Proof {p.period}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatCZK(p.grandTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <button onClick={() => navigate('/history')} className="link-arrow">
              Zobrazit vše <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="col-span-4 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <PieChart size={16} className="text-orange-500" />
                Rozpad nákladů
              </div>
              <div className="card-subtitle">Aktuální období</div>
            </div>
            <button className="menu-dots">
              <MoreVertical size={16} />
            </button>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-6">
              {/* Simple donut representation */}
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4299e1" strokeWidth="3" 
                    strokeDasharray={`${(fixAmount/totalProof)*100 || 0} 100`} 
                    strokeDashoffset="0" 
                    transform="rotate(-90 18 18)" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#48bb78" strokeWidth="3" 
                    strokeDasharray={`${(kmAmount/totalProof)*100 || 0} 100`} 
                    strokeDashoffset={`-${(fixAmount/totalProof)*100 || 0}`}
                    transform="rotate(-90 18 18)" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ed8936" strokeWidth="3" 
                    strokeDasharray={`${(linehaulAmount/totalProof)*100 || 0} 100`} 
                    strokeDashoffset={`-${((fixAmount+kmAmount)/totalProof)*100 || 0}`}
                    transform="rotate(-90 18 18)" />
                </svg>
              </div>
              
              {/* Legend */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-blue-500"></span>
                    <span className="text-sm text-gray-600">FIX</span>
                  </div>
                  <span className="text-sm font-medium">{formatShort(fixAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-green-500"></span>
                    <span className="text-sm text-gray-600">KM</span>
                  </div>
                  <span className="text-sm font-medium">{formatShort(kmAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-orange-500"></span>
                    <span className="text-sm text-gray-600">Linehaul</span>
                  </div>
                  <span className="text-sm font-medium">{formatShort(linehaulAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-purple-500"></span>
                    <span className="text-sm text-gray-600">DEPO</span>
                  </div>
                  <span className="text-sm font-medium">{formatShort(depoAmount)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <button onClick={() => navigate('/prices')} className="link-arrow">
              Zobrazit ceníky <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="col-span-8 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <FileText size={16} className="text-blue-500" />
                Faktury
              </div>
              <div className="card-subtitle">{invoiceList.length} faktur v období</div>
            </div>
            <button className="menu-dots">
              <MoreVertical size={16} />
            </button>
          </div>
          
          {invoiceList.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400 text-sm">Žádné faktury</p>
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
                    <tr key={invoice.id}>
                      <td className="font-medium text-gray-800">{invoice.invoiceNumber}</td>
                      <td>
                        {invoice.items?.map((item, idx) => (
                          <span key={idx} className="badge badge-info mr-1">
                            {(item.itemType || '').replace('ALZABOXY ', '')}
                          </span>
                        ))}
                      </td>
                      <td className="text-right font-medium">{formatCZK(invoice.totalWithoutVat)}</td>
                      <td>
                        <span className={`badge ${
                          invoice.status === 'matched' ? 'badge-success' :
                          invoice.status === 'disputed' ? 'badge-error' :
                          'badge-warning'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' :
                           invoice.status === 'disputed' ? 'Sporná' :
                           'Čeká'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <button onClick={() => navigate('/upload')} className="link-arrow">
              Zobrazit vše <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Carriers Quick View */}
        <div className="col-span-4 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Truck size={16} className="text-purple-500" />
                Dopravci
              </div>
              <div className="card-subtitle">Přehled</div>
            </div>
          </div>
          <div className="card-body space-y-3">
            {(carrierList || []).slice(0, 4).map(carrier => (
              <div key={carrier.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {carrier.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{carrier.name}</div>
                  <div className="text-xs text-gray-400">{carrier.proofsCount || 0} proofů</div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <button onClick={() => navigate('/carriers')} className="link-arrow">
              Zobrazit vše <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
