/**
 * ExpectedBilling.jsx - Očekávaná fakturace
 * Updated: 2025-12-05 - Přidán per-depot breakdown a nová data
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Calculator, Loader2, AlertTriangle, 
  FileText, Truck, MapPin, Building2, Receipt, TrendingUp, Package
} from 'lucide-react'
import api from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

// =============================================================================
// HELPERS
// =============================================================================

function formatCZK(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

// Barvy pro depa
const DEPOT_COLORS = {
  'VRATIMOV': '#ef4444',
  'NOVY_BYDZOV': '#3b82f6',
  'BRNO': '#10b981',
  'CESKE_BUDEJOVICE': '#f59e0b',
  'RAKOVNIK': '#8b5cf6',
  'DIRECT': '#06b6d4',
  'UNKNOWN': '#6b7280',
}

const DEPOT_NAMES = {
  'VRATIMOV': 'Vratimov',
  'NOVY_BYDZOV': 'Nový Bydžov',
  'BRNO': 'Brno',
  'CESKE_BUDEJOVICE': 'České Budějovice',
  'RAKOVNIK': 'Rakovník',
  'DIRECT': 'DIRECT (Praha)',
  'UNKNOWN': 'Ostatní',
}

// =============================================================================
// KOMPONENTY
// =============================================================================

function StatCard({ title, value, subtitle, icon: Icon, color = 'var(--color-primary)' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          {subtitle && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" 
            style={{ backgroundColor: `${color}20` }}>
            <Icon size={20} style={{ color }} />
          </div>
        )}
      </div>
    </div>
  )
}

function BreakdownRow({ label, quantity, rate, total, color = 'var(--color-text-dark)' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg" 
      style={{ backgroundColor: 'var(--color-bg)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="flex items-center gap-4 text-sm">
        {quantity !== undefined && (
          <span style={{ color: 'var(--color-text-muted)' }}>{quantity}×</span>
        )}
        {rate !== undefined && (
          <span style={{ color: 'var(--color-text-muted)' }}>{formatCZK(rate)}</span>
        )}
        <span className="font-semibold min-w-[100px] text-right" style={{ color }}>{formatCZK(total)}</span>
      </div>
    </div>
  )
}

function DepotBreakdownCard({ depotCode, data }) {
  const color = DEPOT_COLORS[depotCode] || DEPOT_COLORS['UNKNOWN']
  const name = DEPOT_NAMES[depotCode] || depotCode
  
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between" 
        style={{ backgroundColor: `${color}10`, borderColor: 'var(--color-border)' }}>
        <h4 className="font-semibold flex items-center gap-2" style={{ color }}>
          <Building2 size={16} />
          {name}
        </h4>
        <span className="text-lg font-bold" style={{ color }}>
          {formatCZK(data.total)}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Tras:</span>
          <span className="font-medium">{data.routes} ({data.trips} jízd)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>KM:</span>
          <span className="font-medium">{Math.round(data.km).toLocaleString('cs-CZ')} km</span>
        </div>
        <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--color-border-light)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-text-muted)' }}>FIX:</span>
            <span className="font-medium">{formatCZK(data.fix)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-text-muted)' }}>KM náklady:</span>
            <span className="font-medium">{formatCZK(data.kmCost)}</span>
          </div>
          {data.linehaul > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>Linehaul:</span>
              <span className="font-medium">{formatCZK(data.linehaul)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// HLAVNÍ KOMPONENTA
// =============================================================================

export default function ExpectedBilling() {
  const { selectedCarrierId, carrierList, selectedPeriod } = useCarrier()
  
  // Parse období
  const { selectedYear, selectedMonth } = useMemo(() => {
    if (!selectedPeriod) {
      return { 
        selectedYear: new Date().getFullYear(), 
        selectedMonth: new Date().getMonth() + 1 
      }
    }
    const [month, year] = selectedPeriod.split('/')
    return {
      selectedYear: parseInt(year),
      selectedMonth: parseInt(month)
    }
  }, [selectedPeriod])

  const selectedCarrier = useMemo(() => {
    return carrierList?.find(c => c.id === Number(selectedCarrierId))
  }, [carrierList, selectedCarrierId])

  // Fetch billing data
  const { data: billingData, isLoading, error } = useQuery({
    queryKey: ['expected-billing', selectedCarrierId, selectedYear, selectedMonth],
    queryFn: () => api.get(`/expected-billing/calculate`, {
      params: {
        carrier_id: selectedCarrierId,
        year: selectedYear,
        month: selectedMonth
      }
    }).then(r => r.data),
    enabled: !!selectedCarrierId && !!selectedYear && !!selectedMonth
  })

  // Per-depot data
  const perDepotData = useMemo(() => {
    if (!billingData?.perDepot) return []
    return Object.entries(billingData.perDepot)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [billingData])

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
          Očekávaná fakturace
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Výpočet na základě plánovacích souborů a ceníků
        </p>
      </div>

      {/* Prázdný stav */}
      {!selectedCarrierId && (
        <div className="card p-12 text-center">
          <Calculator className="mx-auto mb-4" size={48} style={{ color: 'var(--color-text-light)' }} />
          <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Vyberte dopravce</h2>
          <p style={{ color: 'var(--color-text-light)' }}>Pro zobrazení očekávané fakturace vyberte dopravce a období v hlavičce stránky</p>
        </div>
      )}

      {/* Loading */}
      {selectedCarrierId && isLoading && (
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Počítám očekávanou fakturaci...</p>
        </div>
      )}

      {/* Error */}
      {selectedCarrierId && error && (
        <div className="card p-6" style={{ borderLeft: '4px solid var(--color-red)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: 'var(--color-red)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-red)' }}>Chyba při výpočtu</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {error.response?.data?.detail || error.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No data */}
      {selectedCarrierId && billingData && !billingData.success && (
        <div className="card p-6" style={{ borderLeft: '4px solid var(--color-orange)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: 'var(--color-orange)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-orange)' }}>Nedostatek dat</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {billingData.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {selectedCarrierId && billingData?.success && (
        <>
          {/* Souhrn */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Celkem bez DPH"
              value={formatCZK(billingData.totals?.grandTotal)}
              subtitle={`${billingData.workingDays} pracovních dnů`}
              icon={Calculator}
              color="var(--color-primary)"
            />
            <StatCard
              title="Celkem s DPH (21%)"
              value={formatCZK(billingData.totals?.grandTotalWithVat)}
              subtitle="Očekávaná faktura"
              icon={Receipt}
              color="var(--color-green)"
            />
            <StatCard
              title="FIX za trasy"
              value={formatCZK(billingData.totals?.fix)}
              subtitle={`${(billingData.breakdown?.fix?.dpoRoutes || 0) + (billingData.breakdown?.fix?.sdRoutes || 0)} tras`}
              icon={Truck}
              color="var(--color-purple)"
            />
            <StatCard
              title="Variabilní náklady"
              value={formatCZK((billingData.totals?.km || 0) + (billingData.totals?.linehaul || 0) + (billingData.totals?.depo || 0))}
              subtitle="KM + Linehaul + DEPO"
              icon={TrendingUp}
              color="#0891b2"
            />
          </div>

          {/* Per-depot breakdown - NOVÉ */}
          {perDepotData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <Building2 size={20} />
                  Rozpad dle depa
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {perDepotData.map(depot => (
                    <DepotBreakdownCard 
                      key={depot.code} 
                      depotCode={depot.code} 
                      data={depot} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Detailní rozpis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FIX rozpis */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <Truck size={20} />
                  FIX za trasy
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="DPO trasy"
                  quantity={billingData.breakdown?.fix?.dpoRoutes}
                  total={billingData.totals?.fix * (billingData.breakdown?.fix?.dpoRoutes / ((billingData.breakdown?.fix?.dpoRoutes || 0) + (billingData.breakdown?.fix?.sdRoutes || 1)))}
                  color="var(--color-purple)"
                />
                <BreakdownRow
                  label="SD trasy"
                  quantity={billingData.breakdown?.fix?.sdRoutes}
                  total={billingData.totals?.fix * (billingData.breakdown?.fix?.sdRoutes / ((billingData.breakdown?.fix?.dpoRoutes || 1) + (billingData.breakdown?.fix?.sdRoutes || 0)))}
                  color="var(--color-purple)"
                />
                <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <BreakdownRow
                    label="Celkem FIX"
                    total={billingData.breakdown?.fix?.total}
                    color="var(--color-purple)"
                  />
                </div>
              </div>
            </div>

            {/* KM rozpis */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <MapPin size={20} />
                  Variabilní (KM)
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="Celkem KM"
                  quantity={Math.round(billingData.breakdown?.km?.totalKm || 0)}
                  total={billingData.breakdown?.km?.total}
                  color="#0891b2"
                />
              </div>
            </div>

            {/* Linehaul rozpis */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <Truck size={20} />
                  Line-haul
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="DPO linehauly"
                  quantity={billingData.breakdown?.linehaul?.dpoLinehauls}
                  total={billingData.totals?.linehaul * ((billingData.breakdown?.linehaul?.dpoLinehauls || 0) / ((billingData.breakdown?.linehaul?.dpoLinehauls || 0) + (billingData.breakdown?.linehaul?.sdLinehauls || 1)))}
                  color="var(--color-orange)"
                />
                <BreakdownRow
                  label="SD linehauly"
                  quantity={billingData.breakdown?.linehaul?.sdLinehauls}
                  total={billingData.totals?.linehaul * ((billingData.breakdown?.linehaul?.sdLinehauls || 0) / ((billingData.breakdown?.linehaul?.dpoLinehauls || 1) + (billingData.breakdown?.linehaul?.sdLinehauls || 0)))}
                  color="var(--color-orange)"
                />
                <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <BreakdownRow
                    label="Celkem Linehaul"
                    total={billingData.breakdown?.linehaul?.total}
                    color="var(--color-orange)"
                  />
                </div>
              </div>
            </div>

            {/* DEPO rozpis */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <Building2 size={20} />
                  DEPO náklady
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {billingData.breakdown?.depo?.details?.map((depo, idx) => (
                  <BreakdownRow
                    key={idx}
                    label={`${depo.name} (${depo.rateType === 'monthly' || depo.rateType === 'měsíční' ? 'měsíční' : `${depo.days} dnů`})`}
                    rate={depo.rate}
                    total={depo.amount}
                    color="#0891b2"
                  />
                ))}
                {(!billingData.breakdown?.depo?.details || billingData.breakdown?.depo?.details.length === 0) && (
                  <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                    Žádné DEPO sazby v ceníku
                  </p>
                )}
                {billingData.breakdown?.depo?.details?.length > 0 && (
                  <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <BreakdownRow
                      label="Celkem DEPO"
                      total={billingData.breakdown?.depo?.total}
                      color="#0891b2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Denní rozpad */}
          {billingData.dailyBreakdown?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <Receipt size={20} />
                  Denní rozpad fakturace ({billingData.dailyBreakdown.filter(d => d.routes > 0).length} aktivních dnů)
                </h3>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Datum</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Tras</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>DPO</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>SD</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>LH</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>KM</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>FIX</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>KM nákl.</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Linehaul</th>
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: 'var(--color-text-dark)' }}>Celkem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.dailyBreakdown.map((day, idx) => {
                        const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6
                        const hasData = day.routes > 0
                        return (
                          <tr 
                            key={day.date} 
                            style={{ 
                              borderBottom: '1px solid var(--color-border-light)',
                              backgroundColor: isWeekend ? 'var(--color-bg)' : 'transparent',
                              opacity: hasData ? 1 : 0.5
                            }}
                            title={day.planName ? `Plán: ${day.planName}` : 'Žádný platný plán'}
                          >
                            <td className="py-2 px-3">
                              <span className="font-medium">{day.dayShort}</span>
                              <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'][new Date(day.date).getDay()]}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-medium">{day.routes || '—'}</td>
                            <td className="py-2 px-3 text-right" style={{ color: 'var(--color-purple)' }}>{day.dpoRoutes || '—'}</td>
                            <td className="py-2 px-3 text-right" style={{ color: 'var(--color-green)' }}>{day.sdRoutes || '—'}</td>
                            <td className="py-2 px-3 text-right" style={{ color: 'var(--color-orange)' }}>{day.linehauls || '—'}</td>
                            <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-muted)' }}>
                              {hasData ? Math.round(day.km).toLocaleString('cs-CZ') : '—'}
                            </td>
                            <td className="py-2 px-3 text-right">{hasData ? formatCZK(day.fix) : '—'}</td>
                            <td className="py-2 px-3 text-right">{hasData ? formatCZK(day.kmCost) : '—'}</td>
                            <td className="py-2 px-3 text-right">{hasData ? formatCZK(day.linehaul) : '—'}</td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: hasData ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {hasData ? formatCZK(day.total) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                        <td className="py-3 px-3 font-semibold">CELKEM</td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {billingData.dailyBreakdown.reduce((sum, d) => sum + d.routes, 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--color-purple)' }}>
                          {billingData.dailyBreakdown.reduce((sum, d) => sum + d.dpoRoutes, 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--color-green)' }}>
                          {billingData.dailyBreakdown.reduce((sum, d) => sum + d.sdRoutes, 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--color-orange)' }}>
                          {billingData.dailyBreakdown.reduce((sum, d) => sum + (d.linehauls || 0), 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          {Math.round(billingData.dailyBreakdown.reduce((sum, d) => sum + d.km, 0)).toLocaleString('cs-CZ')}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {formatCZK(billingData.dailyBreakdown.reduce((sum, d) => sum + d.fix, 0))}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {formatCZK(billingData.dailyBreakdown.reduce((sum, d) => sum + d.kmCost, 0))}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {formatCZK(billingData.dailyBreakdown.reduce((sum, d) => sum + d.linehaul, 0))}
                        </td>
                        <td className="py-3 px-3 text-right font-bold" style={{ color: 'var(--color-primary)' }}>
                          {formatCZK(billingData.dailyBreakdown.reduce((sum, d) => sum + d.total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Použité plánovací soubory */}
          {billingData.plans?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <FileText size={20} />
                  Použité plánovací soubory ({billingData.plans.length})
                </h3>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Soubor</th>
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Platnost od</th>
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Depo</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Tras</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.plans.map(plan => (
                        <tr key={plan.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td className="py-2 px-3">{plan.fileName || `Plán #${plan.id}`}</td>
                          <td className="py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>
                            {plan.validFrom ? new Date(plan.validFrom).toLocaleDateString('cs-CZ') : '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-xs" 
                              style={{ backgroundColor: 'var(--color-bg-dark)', color: 'var(--color-text-muted)' }}>
                              {plan.depot}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium">{plan.routesCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {billingData.warnings?.length > 0 && (
            <div className="card p-4" style={{ borderLeft: '4px solid var(--color-orange)' }}>
              <h4 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-orange)' }}>
                <AlertTriangle size={16} />
                Upozornění
              </h4>
              <ul className="text-sm space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                {billingData.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
