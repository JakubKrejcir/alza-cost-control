import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  AlertCircle, CheckCircle, FileText, TrendingUp, 
  Map, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus
} from 'lucide-react'
import { analysis, proofs, invoices, routePlans, carriers } from '../lib/api'

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

function DiffBadge({ diff, size = 'normal' }) {
  if (diff === 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 font-medium text-gray-400 ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
        <Minus size={size === 'small' ? 10 : 12} />
        0
      </span>
    )
  }
  
  const isPositive = diff > 0
  
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${
      isPositive ? 'text-green-400' : 'text-red-400'
    } ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
      {isPositive ? <ArrowUp size={size === 'small' ? 10 : 12} /> : <ArrowDown size={size === 'small' ? 10 : 12} />}
      {isPositive ? '+' : ''}{diff}
    </span>
  )
}

function SummaryCard({ icon: Icon, label, value, subtext, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  }
  
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
}

function ComparisonSummary({ data }) {
  if (!data?.totals) return null
  
  const { planned, actual, diff } = data.totals
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className={`p-4 rounded-lg ${diff.dpoRoutes === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">DPO trasy</span>
          <DiffBadge diff={diff.dpoRoutes} />
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <div className="text-2xl font-bold">{actual.dpoRoutes}</div>
            <div className="text-xs text-gray-500">skutečnost</div>
          </div>
          <div className="text-gray-500">/</div>
          <div>
            <div className="text-lg text-gray-400">{planned.dpoRoutes}</div>
            <div className="text-xs text-gray-500">plán</div>
          </div>
        </div>
      </div>
      
      <div className={`p-4 rounded-lg ${diff.sdRoutes === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">SD trasy</span>
          <DiffBadge diff={diff.sdRoutes} />
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <div className="text-2xl font-bold">{actual.sdRoutes}</div>
            <div className="text-xs text-gray-500">skutečnost</div>
          </div>
          <div className="text-gray-500">/</div>
          <div>
            <div className="text-lg text-gray-400">{planned.sdRoutes}</div>
            <div className="text-xs text-gray-500">plán</div>
          </div>
        </div>
      </div>
      
      <div className={`p-4 rounded-lg ${diff.totalRoutes === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Celkem</span>
          <DiffBadge diff={diff.totalRoutes} />
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <div className="text-2xl font-bold">{actual.totalRoutes}</div>
            <div className="text-xs text-gray-500">skutečnost</div>
          </div>
          <div className="text-gray-500">/</div>
          <div>
            <div className="text-lg text-gray-400">{planned.totalRoutes}</div>
            <div className="text-xs text-gray-500">plán</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DailyTable({ days }) {
  if (!days || days.length === 0) return null
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-3 font-medium text-gray-400">Den</th>
            <th className="text-center p-3 font-medium text-gray-400" colSpan={3}>DPO (ranní)</th>
            <th className="text-center p-3 font-medium text-gray-400" colSpan={3}>SD (odpolední)</th>
            <th className="text-center p-3 font-medium text-gray-400" colSpan={3}>Celkem</th>
            <th className="text-right p-3 font-medium text-gray-400">KM</th>
            <th className="text-left p-3 font-medium text-gray-400">Plán</th>
          </tr>
          <tr className="border-b border-white/10 text-xs">
            <th className="text-left p-2 font-normal text-gray-500">Datum</th>
            <th className="text-center p-2 font-normal text-gray-500">Plán</th>
            <th className="text-center p-2 font-normal text-gray-500">Skut.</th>
            <th className="text-center p-2 font-normal text-gray-500">Rozdíl</th>
            <th className="text-center p-2 font-normal text-gray-500">Plán</th>
            <th className="text-center p-2 font-normal text-gray-500">Skut.</th>
            <th className="text-center p-2 font-normal text-gray-500">Rozdíl</th>
            <th className="text-center p-2 font-normal text-gray-500">Plán</th>
            <th className="text-center p-2 font-normal text-gray-500">Skut.</th>
            <th className="text-center p-2 font-normal text-gray-500">Rozdíl</th>
            <th className="text-right p-2 font-normal text-gray-500">Celkem</th>
            <th className="text-left p-2 font-normal text-gray-500">Aktivní</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, idx) => {
            const hasIssue = !day.isOk && day.hasData
            const noData = !day.hasData
            const noPlan = !day.hasPlan
            
            return (
              <tr 
                key={day.date}
                className={`border-b border-white/5 ${
                  hasIssue ? 'bg-orange-500/5' : 
                  noData ? 'bg-gray-500/5' : 
                  noPlan ? 'bg-red-500/5' : 
                  'hover:bg-white/5'
                }`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 text-center font-medium ${
                      ['So', 'Ne'].includes(day.dayOfWeek) ? 'text-gray-500' : ''
                    }`}>
                      {day.dayOfWeek}
                    </span>
                    <span className="font-bold">{day.dayNumber}.</span>
                  </div>
                </td>
                
                {/* DPO */}
                <td className="text-center p-3 text-gray-400">{day.plannedDpo}</td>
                <td className="text-center p-3 font-medium">{day.hasData ? day.actualDpo : '—'}</td>
                <td className="text-center p-3">
                  {day.hasData ? <DiffBadge diff={day.diffDpo} size="small" /> : '—'}
                </td>
                
                {/* SD */}
                <td className="text-center p-3 text-gray-400">{day.plannedSd}</td>
                <td className="text-center p-3 font-medium">{day.hasData ? day.actualSd : '—'}</td>
                <td className="text-center p-3">
                  {day.hasData ? <DiffBadge diff={day.diffSd} size="small" /> : '—'}
                </td>
                
                {/* Total */}
                <td className="text-center p-3 text-gray-400">{day.plannedTotal}</td>
                <td className="text-center p-3 font-medium">{day.hasData ? day.actualTotal : '—'}</td>
                <td className="text-center p-3">
                  {day.hasData ? <DiffBadge diff={day.diffTotal} size="small" /> : '—'}
                </td>
                
                {/* KM */}
                <td className="text-right p-3 text-blue-400 font-mono text-xs">
                  {day.hasData && day.actualTotalKm > 0 
                    ? day.actualTotalKm.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) 
                    : '—'}
                </td>
                
                {/* Plan info */}
                <td className="p-3 text-xs text-gray-500">
                  {day.plans.length > 0 ? (
                    day.plans.map(p => p.planType).join(', ')
                  ) : (
                    <span className="text-red-400">Bez plánu</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-white/20 font-bold">
            <td className="p-3">CELKEM</td>
            <td className="text-center p-3 text-gray-400">
              {days.reduce((sum, d) => sum + d.plannedDpo, 0)}
            </td>
            <td className="text-center p-3">
              {days.reduce((sum, d) => sum + (d.hasData ? d.actualDpo : 0), 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffDpo : 0), 0)} />
            </td>
            <td className="text-center p-3 text-gray-400">
              {days.reduce((sum, d) => sum + d.plannedSd, 0)}
            </td>
            <td className="text-center p-3">
              {days.reduce((sum, d) => sum + (d.hasData ? d.actualSd : 0), 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffSd : 0), 0)} />
            </td>
            <td className="text-center p-3 text-gray-400">
              {days.reduce((sum, d) => sum + d.plannedTotal, 0)}
            </td>
            <td className="text-center p-3">
              {days.reduce((sum, d) => sum + (d.hasData ? d.actualTotal : 0), 0)}
            </td>
            <td className="text-center p-3">
              <DiffBadge diff={days.reduce((sum, d) => sum + (d.hasData ? d.diffTotal : 0), 0)} />
            </td>
            <td className="text-right p-3 text-blue-400 font-mono">
              {days.reduce((sum, d) => sum + (d.actualTotalKm || 0), 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
            </td>
            <td className="p-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])
  const [selectedCarrier, setSelectedCarrier] = useState(null)
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false)

  // Fetch carriers
  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Auto-select first carrier
  if (carrierList?.length > 0 && !selectedCarrier) {
    setSelectedCarrier(carrierList[0].id)
  }

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', selectedPeriod],
    queryFn: () => analysis.getDashboard({ period: selectedPeriod })
  })

  const { data: periodProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod, selectedCarrier],
    queryFn: () => proofs.getAll({ period: selectedPeriod, carrier_id: selectedCarrier }),
    enabled: !!selectedCarrier
  })

  const { data: periodInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod, selectedCarrier],
    queryFn: () => invoices.getAll({ period: selectedPeriod, carrier_id: selectedCarrier }),
    enabled: !!selectedCarrier
  })

  const proof = periodProofs?.[0]
  const invoiceList = periodInvoices || []
  
  // Fetch daily breakdown if proof exists
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['dailyBreakdown', proof?.id],
    queryFn: () => routePlans.dailyBreakdown(proof.id),
    enabled: !!proof?.id
  })
  
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const totalProof = proof ? parseFloat(proof.grandTotal || 0) : 0
  const remaining = totalProof - totalInvoiced

  // Determine comparison status
  const comparisonStatus = dailyData?.summary?.status || 'unknown'
  const daysWithDiff = dailyData?.summary?.daysWithDiff || 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Přehled nákladů na dopravu</p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={selectedCarrier || ''}
            onChange={(e) => setSelectedCarrier(Number(e.target.value))}
            className="input w-48"
          >
            {carrierList?.map(carrier => (
              <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
            ))}
          </select>
          
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input w-48"
          >
            {getPeriodOptions().map(period => (
              <option key={period} value={period}>
                {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          icon={FileText}
          label="Proof"
          value={formatCZK(totalProof)}
          subtext={proof ? 'Nahráno' : 'Chybí proof'}
          color="blue"
        />
        
        <SummaryCard 
          icon={CheckCircle}
          label="Fakturováno"
          value={formatCZK(totalInvoiced)}
          subtext={`${invoiceList.length} faktur`}
          color="green"
        />
        
        <SummaryCard 
          icon={TrendingUp}
          label="Zbývá"
          value={formatCZK(remaining)}
          subtext={remaining > 0 ? 'K vyfakturování' : 'Vše vyfakturováno'}
          color={remaining > 0 ? 'orange' : 'green'}
        />
        
        <SummaryCard 
          icon={Map}
          label="Plán vs Skutečnost"
          value={
            comparisonStatus === 'ok' ? '✓ OK' :
            comparisonStatus === 'warning' ? `⚠ ${daysWithDiff} dnů` :
            '—'
          }
          subtext={dailyData ? `${dailyData.month?.totalDays} dnů v měsíci` : 'Načítání...'}
          color={comparisonStatus === 'ok' ? 'green' : comparisonStatus === 'warning' ? 'orange' : 'purple'}
        />
      </div>

      {/* Plan vs Proof Comparison */}
      {proof && dailyData && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Map size={20} className="text-alza-orange" />
              Porovnání plán vs. skutečnost — {dailyData.month?.monthName} {dailyData.month?.year}
            </h2>
            <div className="flex items-center gap-3">
              {dailyData.summary && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dailyData.summary.status === 'ok' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {dailyData.summary.status === 'ok' 
                    ? 'Vše v pořádku' 
                    : `${dailyData.summary.daysWithDiff} dnů s rozdílem`}
                </span>
              )}
              <button
                onClick={() => setShowDailyBreakdown(!showDailyBreakdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                {showDailyBreakdown ? 'Skrýt detail' : 'Zobrazit detail'}
                {showDailyBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {/* Summary comparison */}
          <ComparisonSummary data={dailyData} />

          {/* Daily table */}
          {showDailyBreakdown && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Denní přehled</h3>
              {dailyLoading ? (
                <div className="text-center py-8 text-gray-400">Načítání...</div>
              ) : (
                <DailyTable days={dailyData.days} />
              )}
              
              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500/20 rounded" />
                  <span>Den s rozdílem</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500/20 rounded" />
                  <span>Den bez plánu</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500/20 rounded" />
                  <span>Den bez dat v proofu</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state for comparison */}
      {proof && !dailyData && dailyLoading && (
        <div className="card p-8 text-center">
          <div className="text-gray-400">Načítání porovnání...</div>
        </div>
      )}

      {/* Invoices list */}
      {invoiceList.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Faktury za období</h2>
          <div className="space-y-2">
            {invoiceList.map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium">{invoice.invoiceNumber}</div>
                  <div className="text-sm text-gray-400">{invoice.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCZK(invoice.totalWithoutVat)}</div>
                  <div className="text-sm text-gray-400">bez DPH</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No proof warning */}
      {!proof && !isLoading && (
        <div className="card p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chybí proof za toto období</h3>
          <p className="text-gray-400">
            Nahrajte proof od dopravce pro zobrazení porovnání s plány.
          </p>
        </div>
      )}
    </div>
  )
}
