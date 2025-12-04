import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Calculator, ChevronDown, Loader2, AlertTriangle, 
  FileText, Truck, MapPin, Building2, Receipt, TrendingUp
} from 'lucide-react'
import { carriers } from '../lib/api'
import api from '../lib/api'

function formatCZK(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

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

export default function ExpectedBilling() {
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // Načti dopravce
  const { data: carrierList, isLoading: carriersLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Auto-select prvního dopravce
  useEffect(() => {
    if (carrierList?.length > 0 && !selectedCarrierId) {
      setSelectedCarrierId(carrierList[0].id)
    }
  }, [carrierList, selectedCarrierId])

  // Načti dostupná období
  const { data: periodsData } = useQuery({
    queryKey: ['billing-periods', selectedCarrierId],
    queryFn: () => api.get(`/expected-billing/periods?carrier_id=${selectedCarrierId}`).then(r => r.data),
    enabled: !!selectedCarrierId
  })

  // Vypočítej očekávanou fakturaci
  const { data: billingData, isLoading: billingLoading, error: billingError } = useQuery({
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

  const selectedCarrier = carrierList?.find(c => c.id === selectedCarrierId)

  // Generuj roky a měsíce pro dropdown
  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 2; y--) {
    years.push(y)
  }
  
  const months = [
    { value: 1, label: 'Leden' },
    { value: 2, label: 'Únor' },
    { value: 3, label: 'Březen' },
    { value: 4, label: 'Duben' },
    { value: 5, label: 'Květen' },
    { value: 6, label: 'Červen' },
    { value: 7, label: 'Červenec' },
    { value: 8, label: 'Srpen' },
    { value: 9, label: 'Září' },
    { value: 10, label: 'Říjen' },
    { value: 11, label: 'Listopad' },
    { value: 12, label: 'Prosinec' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            Očekávaná fakturace
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Výpočet na základě plánovacích souborů a ceníků
          </p>
        </div>

        {/* Filtry */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Dopravce */}
          <div className="relative">
            <select
              value={selectedCarrierId || ''}
              onChange={(e) => setSelectedCarrierId(Number(e.target.value))}
              className="input pr-10 min-w-[180px] appearance-none"
              disabled={carriersLoading}
            >
              {carriersLoading ? (
                <option>Načítám...</option>
              ) : (
                carrierList?.map(carrier => (
                  <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                ))
              )}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }} />
          </div>

          {/* Měsíc */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="input pr-10 min-w-[120px] appearance-none"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }} />
          </div>

          {/* Rok */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="input pr-10 min-w-[100px] appearance-none"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Loading */}
      {billingLoading && (
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Počítám očekávanou fakturaci...</p>
        </div>
      )}

      {/* Error */}
      {billingError && (
        <div className="card p-6" style={{ borderLeft: '4px solid var(--color-red)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: 'var(--color-red)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-red)' }}>Chyba při výpočtu</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {billingError.response?.data?.detail || billingError.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No data */}
      {billingData && !billingData.success && (
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
      {billingData?.success && (
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
              subtitle={`${billingData.breakdown?.fix?.dpoRoutes + billingData.breakdown?.fix?.sdRoutes} tras`}
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

          {/* Detailní rozpis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FIX sazby */}
            <div className="card">
              <div className="card-header" style={{ backgroundColor: 'var(--color-purple-light)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-purple)' }}>
                  <Truck size={20} />
                  FIX za trasy
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="DPO trasy"
                  quantity={billingData.breakdown?.fix?.dpoRoutes}
                  rate={billingData.breakdown?.fix?.dpoRate}
                  total={billingData.breakdown?.fix?.dpoTotal}
                  color="var(--color-purple)"
                />
                <BreakdownRow
                  label="SD trasy"
                  quantity={billingData.breakdown?.fix?.sdRoutes}
                  rate={billingData.breakdown?.fix?.sdRate}
                  total={billingData.breakdown?.fix?.sdTotal}
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

            {/* KM */}
            <div className="card">
              <div className="card-header" style={{ backgroundColor: 'var(--color-green-light)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-green)' }}>
                  <MapPin size={20} />
                  Kilometry
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="Celkové km"
                  quantity={Math.round(billingData.breakdown?.km?.totalKm || 0)}
                  rate={billingData.breakdown?.km?.rate}
                  total={billingData.breakdown?.km?.total}
                  color="var(--color-green)"
                />
              </div>
            </div>

            {/* Linehaul */}
            <div className="card">
              <div className="card-header" style={{ backgroundColor: 'var(--color-red-light)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-red)' }}>
                  <Truck size={20} />
                  Linehaul (svozy)
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <BreakdownRow
                  label="DPO linehauly"
                  quantity={billingData.breakdown?.linehaul?.dpoCount}
                  total={null}
                />
                <BreakdownRow
                  label="SD linehauly"
                  quantity={billingData.breakdown?.linehaul?.sdCount}
                  total={null}
                />
                <BreakdownRow
                  label="Celkem linehaulů"
                  quantity={billingData.breakdown?.linehaul?.totalCount}
                  rate={billingData.breakdown?.linehaul?.avgRate}
                  total={billingData.breakdown?.linehaul?.total}
                  color="var(--color-red)"
                />
              </div>
            </div>

            {/* DEPO */}
            <div className="card">
              <div className="card-header" style={{ backgroundColor: '#e0f2fe' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#0891b2' }}>
                  <Building2 size={20} />
                  DEPO
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {billingData.breakdown?.depo?.details?.map((depo, idx) => (
                  <BreakdownRow
                    key={idx}
                    label={`${depo.name} (${depo.rateType === 'monthly' ? 'měsíční' : `${depo.days} dnů`})`}
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
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Období</th>
                        <th className="text-left py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Depo</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>Prac. dny</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>DPO</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>SD</th>
                        <th className="text-right py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>KM/den</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.plans.map((plan, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                            {plan.fileName}
                          </td>
                          <td className="py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>
                            {plan.effectiveStart} – {plan.effectiveEnd}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-xs" 
                              style={{ 
                                backgroundColor: plan.depot === 'VRATIMOV' ? 'var(--color-purple-light)' : 
                                                plan.depot === 'BYDZOV' ? '#e0f2fe' : 'var(--color-bg)',
                                color: plan.depot === 'VRATIMOV' ? 'var(--color-purple)' : 
                                       plan.depot === 'BYDZOV' ? '#0891b2' : 'var(--color-text-muted)'
                              }}>
                              {plan.depot}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-dark)' }}>
                            {plan.workingDays}
                          </td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-dark)' }}>
                            {plan.dpoRoutes}
                          </td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-dark)' }}>
                            {plan.sdRoutes}
                          </td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-dark)' }}>
                            {Math.round(plan.totalKm)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <strong>Poznámka:</strong> Výpočet je orientační a vychází z plánovacích souborů a aktivních ceníků. 
              Skutečná fakturace se může lišit podle reálného provozu (přidané/zrušené trasy, posily, atd.).
              Použito {billingData.priceConfigsCount} aktivních ceníků.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
