import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  DollarSign, FileText, AlertTriangle, Building2, Truck, 
  Package, Warehouse, ChevronDown, Loader2, Calendar, Trash2,
  Upload, AlertCircle, CheckCircle, Box, MapPin, Award
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

// Mapování typů služeb na ikony a barvy
const SERVICE_TYPE_CONFIG = {
  'AlzaBox': { icon: Box, color: '#3b82f6', label: 'AlzaBox' },
  'alzabox': { icon: Box, color: '#3b82f6', label: 'AlzaBox' },
  'Třídírna': { icon: Warehouse, color: '#8b5cf6', label: 'Třídírna' },
  'tridirna': { icon: Warehouse, color: '#8b5cf6', label: 'Třídírna' },
  'DROP 2.0': { icon: Package, color: '#10b981', label: 'DROP 2.0' },
  'drop': { icon: Package, color: '#10b981', label: 'DROP 2.0' },
  'XL': { icon: Truck, color: '#f59e0b', label: 'XL zásilky' },
  'xl': { icon: Truck, color: '#f59e0b', label: 'XL zásilky' },
  'Pobočka': { icon: Building2, color: '#06b6d4', label: 'Pobočka' },
  'pobocka': { icon: Building2, color: '#06b6d4', label: 'Pobočka' },
  'general': { icon: FileText, color: '#6b7280', label: 'Obecné' },
}

function getServiceConfig(type) {
  return SERVICE_TYPE_CONFIG[type] || SERVICE_TYPE_CONFIG['general']
}

// Detekce rozvozové oblasti z názvu trasy nebo sazby
function detectArea(rate, rateType = 'other') {
  const text = `${rate.routeType || ''} ${rate.depoName || ''} ${rate.fromCode || ''} ${rate.toCode || ''} ${rate.description || ''}`.toLowerCase()
  
  // FIX sazby - podle routeType
  if (rateType === 'fix') {
    if (text.includes('praha')) return 'Praha'
    if (text.includes('vratimov')) return 'Vratimov'
  }
  
  // KM sazby - "standard" platí pro všechny oblasti, vrátíme null pro speciální handling
  if (rateType === 'km' && (text.includes('standard') || !text.trim())) {
    return null // Sdílená sazba
  }
  
  // DEPO sazby - hodinové patří k Vratimovu, měsíční ke skladu
  if (rateType === 'depo') {
    if (text.includes('sklad') || text.includes('all_in') || text.includes('all in') || text.includes('skladník') || text.includes('brigádník')) return 'Sklad'
    if (text.includes('vratimov') || text.includes('hourly') || text.includes('hodin')) return 'Vratimov'
  }
  
  // Linehaul - vždy patří k Vratimovu (tam směřují)
  if (rateType === 'linehaul') {
    return 'Vratimov'
  }
  
  // Bonus sazby - patří ke skladu
  if (rateType === 'bonus') {
    return 'Sklad'
  }
  
  // Obecná detekce
  if (text.includes('praha') || text.includes('direct_praha')) return 'Praha'
  if (text.includes('vratimov') || text.includes('czlc4') || text.includes('cztc1')) return 'Vratimov'
  
  return null // Neznámé
}

// Konfigurace rozvozových oblastí
const AREA_CONFIG = {
  'Praha': { 
    color: '#ef4444', 
    icon: '🏙️',
    label: 'Rozvozová oblast Praha',
    description: 'Direct trasy z CZLC4/CZTC1'
  },
  'Vratimov': { 
    color: '#3b82f6', 
    icon: '🏭',
    label: 'Rozvozová oblast Vratimov',
    description: 'Linehaul → třídění → rozvoz dodávkami'
  },
  'Sklad': { 
    color: '#10b981', 
    icon: '📦',
    label: 'Sklad Nový Bydžov',
    description: 'Skladové služby'
  },
}

function AreaSection({ area, fixRates, kmRates, depoRates, linehaulRates, bonusRates }) {
  const areaConfig = AREA_CONFIG[area] || { color: '#6b7280', icon: '📍', label: area, description: '' }
  
  const hasRates = fixRates.length > 0 || kmRates.length > 0 || 
                   depoRates.length > 0 || linehaulRates.length > 0 || bonusRates.length > 0
  
  if (!hasRates) return null

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: areaConfig.color + '40' }}>
      {/* Area header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: areaConfig.color + '10' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{areaConfig.icon}</span>
          <div>
            <span className="font-semibold" style={{ color: areaConfig.color }}>
              {areaConfig.label}
            </span>
            {areaConfig.description && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {areaConfig.description}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Rates */}
      <div className="p-4 space-y-4">
        
        {/* Pro Prahu - Direct trasy */}
        {area === 'Praha' && (fixRates.length > 0 || kmRates.length > 0) && (
          <div className="space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Direct trasy (přímo z CZLC4/CZTC1)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fixRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#8b5cf6' }}>
                    <DollarSign size={14} />
                    FIX sazba za trasu
                  </h6>
                  {fixRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Direct</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold" style={{ color: '#8b5cf6' }}>{formatCZK(rate.rate)}</span>
                        {rate.contractLabel && (
                          <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                            {rate.contractLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {kmRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#10b981' }}>
                    <MapPin size={14} />
                    Kilometrová sazba
                  </h6>
                  {kmRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Všechny trasy</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold" style={{ color: '#10b981' }}>{rate.rate} Kč/km</span>
                        {rate.contractLabel && (
                          <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                            {rate.contractLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pro Vratimov - Linehauly + Rozvoz */}
        {area === 'Vratimov' && (
          <>
            {/* Linehauly do depa */}
            {linehaulRates.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Linehaul do depa Vratimov
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {linehaulRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {rate.fromCode} → Vratimov
                        <span className="text-xs ml-1 px-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                          {rate.vehicleType}
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold" style={{ color: '#ef4444' }}>{formatCZK(rate.rate)}</span>
                        {rate.contractLabel && (
                          <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                            {rate.contractLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rozvoz z depa */}
            {(fixRates.length > 0 || kmRates.length > 0 || depoRates.length > 0) && (
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Rozvoz z depa Vratimov (dodávky)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {fixRates.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#8b5cf6' }}>
                        <DollarSign size={14} />
                        FIX sazba
                      </h6>
                      {fixRates.map((rate, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Za trasu</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold" style={{ color: '#8b5cf6' }}>{formatCZK(rate.rate)}</span>
                            {rate.contractLabel && (
                              <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                                {rate.contractLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {kmRates.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#10b981' }}>
                        <MapPin size={14} />
                        Km sazba
                      </h6>
                      {kmRates.map((rate, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Za km</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold" style={{ color: '#10b981' }}>{rate.rate} Kč/km</span>
                            {rate.contractLabel && (
                              <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                                {rate.contractLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {depoRates.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#0891b2' }}>
                        <Warehouse size={14} />
                        Práce na depu
                      </h6>
                      {depoRates.map((rate, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {rate.rateType === 'hourly' ? 'Hodinová' : rate.rateType}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold" style={{ color: '#0891b2' }}>{formatCZK(rate.rate)}/h</span>
                            {rate.contractLabel && (
                              <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                                {rate.contractLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Pro Sklad */}
        {area === 'Sklad' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {depoRates.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#0891b2' }}>
                  <Warehouse size={14} />
                  Skladové služby
                </h6>
                {depoRates.map((rate, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {rate.depoName?.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold" style={{ color: '#0891b2' }}>
                        {formatCZK(rate.rate)}
                        <span className="text-xs font-normal">/měs</span>
                      </span>
                      {rate.contractLabel && (
                        <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                          {rate.contractLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {bonusRates.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-xs font-semibold flex items-center gap-1" style={{ color: '#f59e0b' }}>
                  <Award size={14} />
                  Bonusy za kvalitu
                </h6>
                {bonusRates.map((rate, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {rate.qualityMin >= 98 ? '≥' : ''}{rate.qualityMin}% - {rate.qualityMax}%
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold" style={{ color: '#f59e0b' }}>+{formatCZK(rate.bonusAmount)}</span>
                      {rate.contractLabel && (
                        <span className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
                          {rate.contractLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ServiceCard({ type, configs, contractList }) {
  const serviceConfig = getServiceConfig(type)
  const Icon = serviceConfig.icon
  
  // Filtruj jen AKTIVNÍ ceníky
  const activeConfigs = configs.filter(c => c.isActive !== false)
  
  if (activeConfigs.length === 0) return null
  
  // Sloučit všechny sazby ze všech AKTIVNÍCH ceníků tohoto typu
  const allFixRates = []
  const allKmRates = []
  const allDepoRates = []
  const allLinehaulRates = []
  const allBonusRates = []
  
  activeConfigs.forEach(config => {
    const contract = contractList?.find(c => c.id === config.contractId)
    const contractLabel = contract?.number?.replace('Dodatek č. ', 'D') || ''
    
    config.fixRates?.forEach(rate => {
      allFixRates.push({ ...rate, contractLabel, validFrom: config.validFrom })
    })
    config.kmRates?.forEach(rate => {
      allKmRates.push({ ...rate, contractLabel, validFrom: config.validFrom })
    })
    config.depoRates?.forEach(rate => {
      allDepoRates.push({ ...rate, contractLabel, validFrom: config.validFrom })
    })
    config.linehaulRates?.forEach(rate => {
      allLinehaulRates.push({ ...rate, contractLabel, validFrom: config.validFrom })
    })
    config.bonusRates?.forEach(rate => {
      allBonusRates.push({ ...rate, contractLabel, validFrom: config.validFrom })
    })
  })

  // Seskupit sazby podle rozvozové oblasti
  const areas = ['Praha', 'Vratimov', 'Sklad']
  const ratesByArea = {}
  
  // Najdi které oblasti mají FIX sazby (pro sdílení KM sazeb)
  const areasWithFixRates = new Set(
    allFixRates.map(r => detectArea(r, 'fix')).filter(Boolean)
  )
  
  areas.forEach(area => {
    // FIX sazby - přesné přiřazení
    const fixRates = allFixRates.filter(r => detectArea(r, 'fix') === area)
    
    // KM sazby - sdílené mezi oblastmi které mají FIX sazby
    let kmRates = allKmRates.filter(r => detectArea(r, 'km') === area)
    // Pokud je KM sazba sdílená (null), přidej ji do oblastí s FIX sazbami
    if (areasWithFixRates.has(area)) {
      const sharedKmRates = allKmRates.filter(r => detectArea(r, 'km') === null)
      kmRates = [...kmRates, ...sharedKmRates]
    }
    
    // DEPO sazby
    const depoRates = allDepoRates.filter(r => detectArea(r, 'depo') === area)
    
    // Linehaul sazby
    const linehaulRates = allLinehaulRates.filter(r => detectArea(r, 'linehaul') === area)
    
    // Bonus sazby
    const bonusRates = allBonusRates.filter(r => detectArea(r, 'bonus') === area)
    
    ratesByArea[area] = { fixRates, kmRates, depoRates, linehaulRates, bonusRates }
  })

  const hasAnyRates = allFixRates.length > 0 || allKmRates.length > 0 || 
                      allDepoRates.length > 0 || allLinehaulRates.length > 0 || 
                      allBonusRates.length > 0

  if (!hasAnyRates) return null
  
  // Najdi oblasti s nějakými sazbami
  const activeAreas = areas.filter(area => {
    const a = ratesByArea[area]
    return a.fixRates.length > 0 || a.kmRates.length > 0 || a.depoRates.length > 0 || 
           a.linehaulRates.length > 0 || a.bonusRates.length > 0
  })

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div 
        className="card-header flex items-center gap-3"
        style={{ backgroundColor: `${serviceConfig.color}15` }}
      >
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${serviceConfig.color}25` }}
        >
          <Icon size={22} style={{ color: serviceConfig.color }} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold" style={{ color: serviceConfig.color }}>
            {serviceConfig.label}
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {activeAreas.length} {activeAreas.length === 1 ? 'oblast' : 'oblasti'} • {activeConfigs.length} aktivní {activeConfigs.length === 1 ? 'ceník' : 'ceníky'}
          </p>
        </div>
      </div>

      {/* Content - Area sections */}
      <div className="p-6 space-y-4">
        {activeAreas.map(area => (
          <AreaSection
            key={area}
            area={area}
            fixRates={ratesByArea[area].fixRates}
            kmRates={ratesByArea[area].kmRates}
            depoRates={ratesByArea[area].depoRates}
            linehaulRates={ratesByArea[area].linehaulRates}
            bonusRates={ratesByArea[area].bonusRates}
          />
        ))}
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
      queryClient.invalidateQueries(['prices', 'carrier', selectedCarrierId])
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

  // Seskup ceníky podle typu služby
  const pricesByType = priceList?.reduce((acc, config) => {
    // Normalizuj typ
    let type = config.type || 'general'
    // Mapuj podobné typy
    if (type.toLowerCase().includes('alzabox') || type.toLowerCase() === 'ab') type = 'AlzaBox'
    if (type.toLowerCase().includes('tridirna') || type.toLowerCase().includes('třídírna')) type = 'Třídírna'
    if (type.toLowerCase().includes('drop')) type = 'DROP 2.0'
    if (type.toLowerCase() === 'xl') type = 'XL'
    if (type.toLowerCase().includes('pobocka') || type.toLowerCase().includes('pobočka')) type = 'Pobočka'
    
    if (!acc[type]) acc[type] = []
    acc[type].push(config)
    return acc
  }, {}) || {}

  // Pořadí typů služeb pro zobrazení
  const typeOrder = ['AlzaBox', 'Třídírna', 'DROP 2.0', 'XL', 'Pobočka', 'general']
  const sortedTypes = Object.keys(pricesByType).sort((a, b) => {
    const indexA = typeOrder.indexOf(a)
    const indexB = typeOrder.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

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
            Přehled sazeb podle typu služby
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

      {/* Upozornění na chybějící smlouvy */}
      {!isLoading && selectedCarrierId && !hasContracts && (
        <div 
          className="flex items-start gap-3 p-4 rounded-lg"
          style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}
        >
          <AlertTriangle size={20} style={{ color: '#d97706' }} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium" style={{ color: '#92400e' }}>
              Chybějící smlouvy
            </p>
            <p className="text-sm mt-1" style={{ color: '#a16207' }}>
              Dopravce {selectedCarrier?.name} nemá nahrané žádné smlouvy. 
              Nahrajte PDF smluv v sekci <strong>Dokumenty</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Info o chybějících ceníkách */}
      {!isLoading && hasContracts && !hasPrices && (
        <div 
          className="flex items-start gap-3 p-4 rounded-lg"
          style={{ backgroundColor: '#dbeafe', border: '1px solid #3b82f6' }}
        >
          <AlertCircle size={20} style={{ color: '#2563eb' }} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium" style={{ color: '#1e40af' }}>
              Smlouvy bez extrahovaných ceníků
            </p>
            <p className="text-sm mt-1" style={{ color: '#1d4ed8' }}>
              Máte {contractList.length} {contractList.length === 1 ? 'smlouvu' : 'smluv'}, ale nepodařilo se z nich extrahovat žádné sazby. 
              Zkontrolujte formát PDF nebo přidejte ceníky ručně.
            </p>
          </div>
        </div>
      )}

      {/* Ceníky podle typu služby */}
      {!isLoading && hasPrices && (
        <div className="space-y-6">
          {sortedTypes.map(type => (
            <ServiceCard 
              key={type}
              type={type}
              configs={pricesByType[type]}
              contractList={contractList}
            />
          ))}
        </div>
      )}

      {/* Legenda */}
      {hasPrices && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Rozvozové oblasti:</span>
          <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="text-base">🏙️</span> Praha (Direct z CZLC4/CZTC1)
            </span>
            <span className="flex items-center gap-1">
              <span className="text-base">🏭</span> Vratimov (Linehaul → rozvoz)
            </span>
            <span className="flex items-center gap-1">
              <span className="text-base">📦</span> Sklad
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>D7</span>
              = Dodatek č. 7
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
                    {contract.type && (
                      <span 
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ 
                          backgroundColor: getServiceConfig(contract.type).color + '20',
                          color: getServiceConfig(contract.type).color
                        }}
                      >
                        {getServiceConfig(contract.type).label}
                      </span>
                    )}
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
