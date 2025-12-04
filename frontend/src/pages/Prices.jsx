import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  DollarSign, FileText, AlertTriangle, Building2, Truck, 
  Package, Warehouse, ChevronDown, Loader2, Calendar, Trash2,
  Upload, AlertCircle, CheckCircle
} from 'lucide-react'
import { prices, contracts, carriers } from '../lib/api'

function formatCZK(amount) {
  if (amount == null || isNaN(amount)) return '—'
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

function PriceRow({ label, value, color = 'var(--color-primary)', contractNumber }) {
  return (
    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold" style={{ color }}>{value}</span>
        {contractNumber && (
          <span 
            className="text-xs px-1.5 py-0.5 rounded" 
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
            title={contractNumber}
          >
            {contractNumber.replace('Dodatek č. ', 'D')}
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

function EmptyState({ message, icon: Icon = DollarSign }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
      <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  )
}

export default function Prices() {
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)
  const [deletingContractId, setDeletingContractId] = useState(null)
  const queryClient = useQueryClient()

  // Načti seznam dopravců
  const { data: carrierList, isLoading: carriersLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Načti ceníky pro vybraného dopravce
  const { data: priceList, isLoading: pricesLoading } = useQuery({
    queryKey: ['prices', 'carrier', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId,
    staleTime: 0,
  })

  // Načti smlouvy pro vybraného dopravce
  const { data: contractList, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', 'carrier', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId,
    staleTime: 0,
  })

  // Mazání smlouvy
  const deleteContractMutation = useMutation({
    mutationFn: (contractId) => contracts.delete(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts', 'carrier', selectedCarrierId])
      setDeletingContractId(null)
    },
    onError: (error) => {
      alert(`Chyba při mazání: ${error.response?.data?.detail || error.message}`)
      setDeletingContractId(null)
    }
  })

  // Auto-select prvního dopravce
  useEffect(() => {
    if (carrierList?.length > 0 && !selectedCarrierId) {
      setSelectedCarrierId(carrierList[0].id)
    }
  }, [carrierList, selectedCarrierId])

  const selectedCarrier = carrierList?.find(c => c.id === selectedCarrierId)

  // Pomocná funkce pro získání smlouvy podle ID
  const getContract = (contractId) => contractList?.find(c => c.id === contractId)

  // Seskup ceníky podle typu
  const pricesByType = priceList?.reduce((acc, config) => {
    const type = config.type || 'general'
    if (!acc[type]) acc[type] = []
    acc[type].push(config)
    return acc
  }, {}) || {}

  const isLoading = carriersLoading || pricesLoading
  const hasContracts = contractList?.length > 0
  const hasPrices = priceList?.length > 0

  // Handler pro změnu dopravce
  const handleCarrierChange = (e) => {
    setSelectedCarrierId(Number(e.target.value))
  }

  // Handler pro mazání smlouvy
  const handleDeleteContract = (contractId) => {
    if (window.confirm('Opravdu chcete smazat tuto smlouvu? Ceníky zůstanou zachovány.')) {
      setDeletingContractId(contractId)
      deleteContractMutation.mutate(contractId)
    }
  }

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

      {/* Warning: Žádné smlouvy */}
      {!isLoading && selectedCarrierId && !hasContracts && (
        <div className="card p-5" style={{ borderLeft: '4px solid var(--color-orange)' }}>
          <div className="flex items-start gap-4">
            <AlertTriangle size={24} style={{ color: 'var(--color-orange)' }} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-orange)' }}>
                Žádné nahrané smlouvy
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Pro dopravce {selectedCarrier?.name} nejsou nahrané žádné smlouvy. 
                Nahrajte smlouvy v záložce "Dokumenty" pro automatické vytvoření ceníků.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info: Smlouvy bez ceníků */}
      {!isLoading && selectedCarrierId && hasContracts && !hasPrices && (
        <div className="card p-5" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="flex items-start gap-4">
            <AlertCircle size={24} style={{ color: 'var(--color-primary)' }} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-primary)' }}>
                Smlouvy bez extrahovaných ceníků
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Máte {contractList.length} {contractList.length === 1 ? 'smlouvu' : 'smluv'}, 
                ale nepodařilo se z nich extrahovat žádné sazby. 
                Zkontrolujte formát PDF nebo přidejte ceníky ručně.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ceníky podle typu */}
      {!isLoading && hasPrices && (
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
                            {!contract && config.contractId && (
                              <span className="text-xs ml-2 px-1.5 py-0.5 rounded" 
                                style={{ backgroundColor: 'var(--color-orange-light)', color: '#e67e22' }}>
                                Smlouva smazána
                              </span>
                            )}
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

      {/* Žádné ceníky - empty state */}
      {!isLoading && selectedCarrierId && !hasPrices && hasContracts && (
        <div className="card">
          <EmptyState 
            message={`Žádné ceníky pro dopravce ${selectedCarrier?.name || ''}`}
            icon={DollarSign}
          />
        </div>
      )}

      {/* Legenda */}
      {hasPrices && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Legenda:</span>
          <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>D7</span>
              = Dodatek č. 7
            </span>
            <span className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Aktivní</span>
              = Aktuálně platný ceník
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-orange-light)', color: '#e67e22' }}>Smlouva smazána</span>
              = Ceník zachován bez smlouvy
            </span>
          </div>
        </div>
      )}

      {/* Seznam smluv s možností mazání */}
      {!isLoading && hasContracts && (
        <div className="card">
          <div className="card-header" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <FileText size={22} />
              Nahrané smlouvy ({contractList.length})
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Smazáním smlouvy se ceníky zachovají
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {contractList.map(contract => (
                <div 
                  key={contract.id} 
                  className="flex items-center justify-between p-3 rounded-lg" 
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold min-w-[120px]" style={{ color: 'var(--color-primary)' }}>
                      {contract.number || `Smlouva #${contract.id}`}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      od {formatDate(contract.validFrom)}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--color-text-dark)' }}>
                      {contract.type || 'Obecná smlouva'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteContract(contract.id)}
                    disabled={deletingContractId === contract.id}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                    style={{ color: 'var(--color-red)' }}
                    title="Smazat smlouvu"
                  >
                    {deletingContractId === contract.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
