import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  AlertCircle, CheckCircle, AlertTriangle, FileText, TrendingUp, 
  Calendar, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp,
  Map, Truck
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

function DiffBadge({ diff, showZero = false }) {
  if (diff === 0 && !showZero) return null
  
  const isPositive = diff > 0
  const isNegative = diff < 0
  
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isPositive ? 'bg-green-500/20 text-green-400' : 
      isNegative ? 'bg-red-500/20 text-red-400' : 
      'bg-gray-500/20 text-gray-400'
    }`}>
      {isPositive ? <ArrowUp size={12} /> : isNegative ? <ArrowDown size={12} /> : <Minus size={12} />}
      {isPositive ? '+' : ''}{diff}
    </span>
  )
}

function ComparisonRow({ label, planned, actual, diff, icon: Icon }) {
  const hasIssue = diff !== 0
  
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${
      hasIssue ? 'bg-orange-500/5 border border-orange-500/20' : 'bg-white/5'
    }`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon size={18} className={hasIssue ? 'text-orange-400' : 'text-gray-400'} />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-gray-500">Plán</div>
          <div className="font-medium">{planned}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Skutečnost</div>
          <div className="font-medium">{actual}</div>
        </div>
        <div className="w-20 text-right">
          <DiffBadge diff={diff} showZero />
        </div>
      </div>
    </div>
  )
}

function DailyCalendar({ days, comparison }) {
  // Group days by weeks
  const weeks = []
  let currentWeek = []
  
  // Add empty cells for days before month starts
  if (days.length > 0) {
    const firstDayOfWeek = new Date(days[0].date).getDay()
    // Convert Sunday (0) to 7 for Monday-first calendar
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    for (let i = 0; i < adjustedFirstDay; i++) {
      currentWeek.push(null)
    }
  }
  
  days.forEach((day, index) => {
    currentWeek.push(day)
    
    // Check if this is the last day of the week (Sunday)
    const dayOfWeek = new Date(day.date).getDay()
    if (dayOfWeek === 0 || index === days.length - 1) {
      // Fill rest of week with empty cells
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
      currentWeek = []
    }
  })
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(day => (
              <th key={day} className="p-2 text-center text-gray-400 font-medium w-[14.28%]">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((day, dayIndex) => (
                <td key={dayIndex} className="p-1">
                  {day ? (
                    <div className={`p-2 rounded-lg text-center min-h-[80px] ${
                      day.isWeekend 
                        ? 'bg-gray-800/50 text-gray-500' 
                        : day.plans.length > 0 
                          ? 'bg-white/5 hover:bg-white/10 transition-colors cursor-default' 
                          : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                      <div className={`font-bold text-lg ${day.isWeekend ? 'text-gray-500' : ''}`}>
                        {day.dayNumber}
                      </div>
                      {day.isWorkingDay && (
                        <>
                          {day.plans.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              <div className="text-xs">
                                <span className="text-blue-400">{day.dpoRoutes}</span>
                                <span className="text-gray-500"> DPO</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-orange-400">{day.sdRoutes}</span>
                                <span className="text-gray-500"> SD</span>
                              </div>
                              {day.plans.map((plan, idx) => (
                                <div key={idx} className="text-[10px] text-gray-500 truncate" title={plan.fileName}>
                                  {plan.planType}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-red-400 mt-1">
                              Bez plánu!
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-2 min-h-[80px]" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
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
  
  // Fetch comparison data if proof exists
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['comparison', proof?.id],
    queryFn: () => routePlans.comparePeriod(proof.id),
    enabled: !!proof?.id
  })

  // Fetch daily breakdown if expanded
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['dailyBreakdown', proof?.id],
    queryFn: () => routePlans.dailyBreakdown(proof.id),
    enabled: !!proof?.id && showDailyBreakdown
  })
  
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const totalProof = proof ? parseFloat(proof.grandTotal || 0) : 0
  const remaining = totalProof - totalInvoiced

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
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">Proof</span>
          </div>
          <div className="text-2xl font-bold">{formatCZK(totalProof)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {proof ? 'Nahráno' : 'Chybí proof'}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">Fakturováno</span>
          </div>
          <div className="text-2xl font-bold">{formatCZK(totalInvoiced)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {invoiceList.length} faktur
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-gray-400 text-sm">Zbývá</span>
          </div>
          <div className={`text-2xl font-bold ${remaining > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {formatCZK(remaining)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {remaining > 0 ? 'K vyfakturování' : 'Vše vyfakturováno'}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Map className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm">Plán vs Skutečnost</span>
          </div>
          <div className="text-2xl font-bold">
            {comparisonData?.status === 'ok' ? (
              <span className="text-green-400">✓ OK</span>
            ) : comparisonData?.status === 'warning' ? (
              <span className="text-orange-400">⚠ Rozdíly</span>
            ) : comparisonData?.status === 'error' ? (
              <span className="text-red-400">✗ Chyba</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {comparisonData?.plans ? `${comparisonData.plans.totalWorkingDays} prac. dnů` : 'Načítání...'}
          </div>
        </div>
      </div>

      {/* Plan vs Proof Comparison */}
      {proof && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Map size={20} className="text-alza-orange" />
              Porovnání plán vs. proof
            </h2>
            {comparisonData?.status && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                comparisonData.status === 'ok' ? 'bg-green-500/20 text-green-400' :
                comparisonData.status === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {comparisonData.status === 'ok' ? 'Vše v pořádku' :
                 comparisonData.status === 'warning' ? 'Nalezeny rozdíly' :
                 'Chybí data'}
              </span>
            )}
          </div>

          {comparisonLoading ? (
            <div className="text-center py-8 text-gray-400">Načítání porovnání...</div>
          ) : comparisonData?.plans ? (
            <div className="space-y-4">
              {/* Summary info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="text-xs text-gray-500">Období</div>
                  <div className="font-medium">{comparisonData.proof.period}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pracovních dnů</div>
                  <div className="font-medium">{comparisonData.plans.totalWorkingDays}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Aktivních plánů</div>
                  <div className="font-medium">{comparisonData.plans.plansUsed?.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Dopravce</div>
                  <div className="font-medium">{comparisonData.proof.carrierName}</div>
                </div>
              </div>

              {/* Comparison rows */}
              <div className="space-y-2">
                <ComparisonRow 
                  label="DPO trasy (ranní)"
                  icon={Truck}
                  planned={comparisonData.plans.dpoRoutesCount}
                  actual={comparisonData.proof?.dpoRoutesCount || 0}
                  diff={(comparisonData.proof?.dpoRoutesCount || 0) - comparisonData.plans.dpoRoutesCount}
                />
                <ComparisonRow 
                  label="SD trasy (odpolední)"
                  icon={Truck}
                  planned={comparisonData.plans.sdRoutesCount}
                  actual={(comparisonData.proof?.sdRoutesCount || 0) + (comparisonData.proof?.sdSpojenCount || 0)}
                  diff={((comparisonData.proof?.sdRoutesCount || 0) + (comparisonData.proof?.sdSpojenCount || 0)) - comparisonData.plans.sdRoutesCount}
                />
                <ComparisonRow 
                  label="Linehauly"
                  icon={Truck}
                  planned={comparisonData.plans.dpoLinehaulCount + comparisonData.plans.sdLinehaulCount}
                  actual={comparisonData.proof?.linehaulCount || 0}
                  diff={(comparisonData.proof?.linehaulCount || 0) - (comparisonData.plans.dpoLinehaulCount + comparisonData.plans.sdLinehaulCount)}
                />
              </div>

              {/* Warnings */}
              {comparisonData.warnings?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {comparisonData.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <AlertTriangle size={16} className="text-yellow-400" />
                      <span className="text-sm text-yellow-200">{warning.note || warning.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Daily breakdown toggle */}
              <button
                onClick={() => setShowDailyBreakdown(!showDailyBreakdown)}
                className="w-full mt-4 p-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Calendar size={18} />
                <span>{showDailyBreakdown ? 'Skrýt' : 'Zobrazit'} denní přehled</span>
                {showDailyBreakdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
          ) : comparisonData?.status === 'error' ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
              <p className="text-red-400">{comparisonData.message}</p>
              {comparisonData.warnings?.map((w, i) => (
                <p key={i} className="text-sm text-gray-400 mt-2">{w.note}</p>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Vyberte období s nahraným proofem pro zobrazení porovnání
            </div>
          )}
        </div>
      )}

      {/* Daily Breakdown */}
      {showDailyBreakdown && proof && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-alza-orange" />
            Denní přehled - {dailyData?.month?.monthName} {dailyData?.month?.year}
          </h2>

          {dailyLoading ? (
            <div className="text-center py-8 text-gray-400">Načítání denního přehledu...</div>
          ) : dailyData ? (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-400">{dailyData.plannedTotals.workingDays}</div>
                  <div className="text-xs text-gray-400">Pracovních dnů</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold">{dailyData.plannedTotals.dpoRoutes}</div>
                  <div className="text-xs text-gray-400">DPO tras celkem</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold">{dailyData.plannedTotals.sdRoutes}</div>
                  <div className="text-xs text-gray-400">SD tras celkem</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold">{dailyData.plannedTotals.dpoLinehauls + dailyData.plannedTotals.sdLinehauls}</div>
                  <div className="text-xs text-gray-400">Linehaulů celkem</div>
                </div>
              </div>

              {/* Comparison summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${dailyData.comparison.dpoRoutes.diff === 0 ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">DPO trasy</span>
                    <DiffBadge diff={dailyData.comparison.dpoRoutes.diff} showZero />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{dailyData.comparison.dpoRoutes.actual}</span>
                    <span className="text-sm text-gray-500">/ {dailyData.comparison.dpoRoutes.planned} plán</span>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${dailyData.comparison.sdRoutes.diff === 0 ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">SD trasy</span>
                    <DiffBadge diff={dailyData.comparison.sdRoutes.diff} showZero />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{dailyData.comparison.sdRoutes.actual}</span>
                    <span className="text-sm text-gray-500">/ {dailyData.comparison.sdRoutes.planned} plán</span>
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${dailyData.comparison.linehauls.diff === 0 ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Linehauly</span>
                    <DiffBadge diff={dailyData.comparison.linehauls.diff} showZero />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{dailyData.comparison.linehauls.actual}</span>
                    <span className="text-sm text-gray-500">/ {dailyData.comparison.linehauls.planned} plán</span>
                  </div>
                </div>
              </div>

              {/* Calendar view */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Kalendář</h3>
                <DailyCalendar days={dailyData.days} comparison={dailyData.comparison} />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/5 rounded" />
                  <span>Pracovní den s plánem</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500/10 border border-red-500/20 rounded" />
                  <span>Pracovní den bez plánu</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-800/50 rounded" />
                  <span>Víkend</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">■</span>
                  <span>DPO (ranní)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-400">■</span>
                  <span>SD (odpolední)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Nepodařilo se načíst denní přehled
            </div>
          )}
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
