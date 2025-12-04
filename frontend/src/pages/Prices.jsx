import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  DollarSign, FileText, AlertTriangle, Building2, Truck, 
  Package, Warehouse, ChevronDown, Loader2, Plus, Calendar
} from 'lucide-react'
import { prices, contracts, carriers } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 2 
  }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(new Date(dateStr), 'd.M.yyyy', { locale: cs })
  } catch {
    return dateStr
  }
}

function PriceRow({ label, value, color = 'var(--color-primary)', dodatek, contractNumber }) {
  const displayDodatek = contractNumber || dodatek
  const isMissing = displayDodatek === '?'
  return (
    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold" style={{ color }}>{value}</span>
        {displayDodatek && (
          <span 
            className="text-xs px-1.5 py-0.5 rounded" 
            style={{ 
              backgroundColor: isMissing ? 'var(--color-orange-light)' : 'var(--color-border)', 
              color: isMissing ? '#e67e22' : 'var(--color-text-light)' 
            }}
            title={isMissing ? 'Chybí ve smlouvách' : displayDodatek}
          >
            {isMissing ? '?' : displayDodatek.replace('Dodatek č. ', 'D')}
          </span>
        )}
      </div>
    </div>
  )
}

function PriceSection({ title, children, color = 'var(--color-text-muted)' }) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-3" style={{ color }}>{title}</h4>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-12">
      <DollarSign className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
      <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  )
}

export default function Prices() {
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)

  // Načti seznam dopravců
  const { data: carrierList, isLoading: carriersLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Načti ceníky pro vybraného dopravce
  const { data: priceList, isLoading: pricesLoading, refetch: refetchPrices } = useQuery({
    queryKey: ['prices', 'carrier', selectedCarrierId],
    queryFn: async () => {
      console.log('>>> API CALL: Fetching prices for carrier_id:', selectedCarrierId)
      const result = await prices.getAll({ carrier_id: selectedCarrierId })
      console.log('<<< API RESPONSE: Got', result?.length, 'prices:', result)
      return result
    },
    enabled: !!selectedCarrierId,
    staleTime: 0,  // Vždy považuj data za stale
    cacheTime: 0,  // Nekešuj
  })

  // Načti smlouvy pro vybraného dopravce
  const { data: contractList } = useQuery({
    queryKey: ['contracts', 'carrier', selectedCarrierId],
    queryFn: async () => {
      console.log('>>> API CALL: Fetching contracts for carrier_id:', selectedCarrierId)
      const result = await contracts.getAll(selectedCarrierId)
      console.log('<<< API RESPONSE: Got', result?.length, 'contracts:', result)
      return result
    },
    enabled: !!selectedCarrierId,
    staleTime: 0,
    cacheTime: 0,
  })

  // Auto-select první dopravce
  useEffect(() => {
    if (carrierList?.length > 0 && !selectedCarrierId) {
      console.log('Auto-selecting first carrier:', carrierList[0].id, carrierList[0].name)
      setSelectedCarrierId(carrierList[0].id)
    }
  }, [carrierList, selectedCarrierId])

  const selectedCarrier = carrierList?.find(c => c.id === selectedCarrierId)

  // Handler pro změnu dopravce
  const handleCarrierChange = (e) => {
    const newCarrierId = Number(e.target.value)
    console.log('🔄 CARRIER CHANGE: from', selectedCarrierId, 'to', newCarrierId)
    setSelectedCarrierId(newCarrierId)
  }

  // Debug log
  useEffect(() => {
    console.log('=== Prices Debug ===')
    console.log('Selected carrier ID:', selectedCarrierId)
    console.log('Selected carrier name:', selectedCarrier?.name)
    console.log('Price configs count:', priceList?.length)
    console.log('Price configs:', priceList?.map(p => ({ id: p.id, carrierId: p.carrierId, type: p.type })))
    console.log('Contracts count:', contractList?.length)
  }, [selectedCarrierId, selectedCarrier, priceList, contractList])
  
  // Seskup ceníky podle typu
  const pricesByType = priceList?.reduce((acc, config) => {
    const type = config.type || 'general'
    if (!acc[type]) acc[type] = []
    acc[type].push(config)
    return acc
  }, {}) || {}

  // Pomocná funkce pro získání smlouvy podle ID
  const getContract = (contractId) => {
    return contractList?.find(c => c.id === contractId)
  }

  const isLoading = carriersLoading || pricesLoading

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header s výběrem dopravce */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            Správa ceníků
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Přehled sazeb ze smluv
          </p>
        </div>
        
        {/* Dropdown pro výběr dopravce */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Dopravce:
          </label>
          <div className="relative">
            <select
              value={selectedCarrierId || ''}
              onChange={handleCarrierChange}
              className="input pr-10 min-w-[200px] appearance-none"
              disabled={carriersLoading}
            >
              {carriersLoading ? (
                <option>Načítám...</option>
              ) : carrierList?.length === 0 ? (
                <option>Žádní dopravci</option>
              ) : (
                carrierList?.map(carrier => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown 
              size={16} 
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Načítám ceníky...</p>
        </div>
      )}

      {/* Žádný dopravce */}
      {!isLoading && !selectedCarrierId && (
        <div className="card">
          <EmptyState message="Vyberte dopravce pro zobrazení ceníků" />
        </div>
      )}

      {/* Žádné ceníky */}
      {!isLoading && selectedCarrierId && priceList?.length === 0 && (
        <div className="card">
          <EmptyState message={`Dopravce ${selectedCarrier?.name || ''} nemá žádné ceníky. Nahrajte smlouvu pro vytvoření ceníku.`} />
        </div>
      )}

      {/* Ceníky podle typu */}
      {!isLoading && priceList?.length > 0 && (
        <>
          {Object.entries(pricesByType).map(([type, configs]) => (
            <div key={type} className="card">
              <div className="card-header" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                  <DollarSign size={22} />
                  {type === 'general' ? 'Obecný ceník' : type}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {configs.length} {configs.length === 1 ? 'ceník' : 'ceníky'}
                </p>
              </div>
              
              <div className="p-6 space-y-6">
                {configs.map(config => {
                  const contract = getContract(config.contractId)
                  return (
                  <div 
                    key={config.id} 
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    {/* Hlavička ceníku */}
                    <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <div className="flex items-center gap-3">
                        <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                        <div>
                          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                            {contract?.number || `Ceník #${config.id}`}
                          </span>
                          <span className="text-sm ml-2" style={{ color: 'var(--color-text-muted)' }}>
                            od {formatDate(config.validFrom)}
                            {config.validTo && ` do ${formatDate(config.validTo)}`}
                          </span>
                        </div>
                      </div>
                      <span 
                        className={`px-2 py-1 rounded text-xs font-medium ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {config.isActive ? 'Aktivní' : 'Neaktivní'}
                      </span>
                    </div>

                    {/* Sazby */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* FIX sazby */}
                      {config.fixRates?.length > 0 && (
                        <PriceSection title="FIX sazby" color="var(--color-purple)">
                          {config.fixRates.map((rate, idx) => (
                            <PriceRow 
                              key={idx}
                              label={rate.routeType || 'Standardní'}
                              value={formatCZK(rate.rate)}
                              color="var(--color-purple)"
                              contractNumber={contract?.number}
                            />
                          ))}
                        </PriceSection>
                      )}

                      {/* KM sazby */}
                      {config.kmRates?.length > 0 && (
                        <PriceSection title="Kilometrové sazby" color="var(--color-green)">
                          {config.kmRates.map((rate, idx) => (
                            <PriceRow 
                              key={idx}
                              label={rate.routeType || 'Standardní'}
                              value={`${rate.rate} Kč/km`}
                              color="var(--color-green)"
                              contractNumber={contract?.number}
                            />
                          ))}
                        </PriceSection>
                      )}

                      {/* DEPO sazby */}
                      {config.depoRates?.length > 0 && (
                        <PriceSection title="DEPO sazby" color="#0891b2">
                          {config.depoRates.map((rate, idx) => (
                            <PriceRow 
                              key={idx}
                              label={`${rate.depoName} (${rate.rateType})`}
                              value={formatCZK(rate.rate)}
                              color="#0891b2"
                              contractNumber={contract?.number}
                            />
                          ))}
                        </PriceSection>
                      )}

                      {/* Linehaul sazby */}
                      {config.linehaulRates?.length > 0 && (
                        <PriceSection title="Linehaul sazby" color="var(--color-red)">
                          {config.linehaulRates.map((rate, idx) => (
                            <PriceRow 
                              key={idx}
                              label={`${rate.fromCode || '?'} → ${rate.toCode || '?'} (${rate.vehicleType})`}
                              value={formatCZK(rate.rate)}
                              color="var(--color-red)"
                              contractNumber={contract?.number}
                            />
                          ))}
                        </PriceSection>
                      )}

                      {/* Bonus sazby */}
                      {config.bonusRates?.length > 0 && (
                        <PriceSection title="Bonusy" color="var(--color-green)">
                          {config.bonusRates.map((rate, idx) => (
                            <PriceRow 
                              key={idx}
                              label={`Kvalita ${rate.qualityMin}% - ${rate.qualityMax}%`}
                              value={formatCZK(rate.totalWithBonus)}
                              color="var(--color-green)"
                              contractNumber={contract?.number}
                            />
                          ))}
                        </PriceSection>
                      )}
                    </div>

                    {/* Prázdný ceník */}
                    {!config.fixRates?.length && !config.kmRates?.length && !config.depoRates?.length && 
                     !config.linehaulRates?.length && !config.bonusRates?.length && (
                      <p className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                        Tento ceník nemá definované žádné sazby
                      </p>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Historie smluv */}
      {!isLoading && contractList?.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <FileText size={22} />
              Historie smluv a dodatků
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {contractList.map(contract => (
                <div 
                  key={contract.id} 
                  className="grid grid-cols-[150px_100px_1fr] gap-4 p-3 rounded-lg items-center" 
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {contract.number || `Smlouva #${contract.id}`}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    od {formatDate(contract.validFrom)}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-dark)' }}>
                    {contract.type || 'Obecná smlouva'}
                    {contract.notes && ` – ${contract.notes}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Legenda:</span>
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>D7</span>
            = Dodatek č. 7
          </span>
          <span className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-orange-light)', color: '#e67e22' }}>?</span>
            = Chybí ve smlouvách
          </span>
          <span className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Aktivní</span>
            = Aktuálně platný ceník
          </span>
        </div>
      </div>
    </div>
  )
}
