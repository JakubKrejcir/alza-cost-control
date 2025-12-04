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

// Detekce rozvozového depa ze sazby
function detectDepot(rate, rateType = 'other') {
  const text = `${rate.routeType || ''} ${rate.depoName || ''} ${rate.fromCode || ''} ${rate.toCode || ''} ${rate.description || ''}`.toLowerCase()
  
  // FIX sazby - podle routeType (DIRECT trasy)
  if (rateType === 'fix') {
    if (text.includes('praha') || text.includes('nový bydžov') || text.includes('bydžov') || text.includes('nb')) return 'Nový Bydžov'
    if (text.includes('vratimov')) return 'Vratimov'
  }
  
  // KM sazby - sdílené mezi depy
  if (rateType === 'km') {
    return null // Sdílená sazba
  }
  
  // DEPO sazby
  if (rateType === 'depo') {
    if (text.includes('sklad') || text.includes('all_in') || text.includes('all in') || text.includes('skladník') || text.includes('brigádník') || text.includes('monthly')) return 'Nový Bydžov'
    if (text.includes('vratimov') || text.includes('hourly') || text.includes('hodin')) return 'Vratimov'
  }
  
  // Linehaul - podle cílového depa (toCode)
  if (rateType === 'linehaul') {
    if (text.includes('nový bydžov') || text.includes('novy_bydzov') || text.includes('bydžov') || text.includes('nb')) return 'Nový Bydžov'
    if (text.includes('vratimov')) return 'Vratimov'
    return null // Nespecifikováno
  }
  
  // Bonus sazby
  if (rateType === 'bonus') {
    return 'Nový Bydžov'
  }
  
  return null
}

// Konfigurace rozvozových dep
const DEPOT_CONFIG = {
  'Vratimov': { 
    color: '#3b82f6', 
    icon: '🏭',
    label: 'Depo Vratimov',
  },
  'Nový Bydžov': { 
    color: '#10b981', 
    icon: '📦',
    label: 'Depo Nový Bydžov',
  },
}

// Mapování typu vozu na počet palet
const VEHICLE_PALLETS = {
  'Dodavka': '8-10 pal',
  'Dodávka': '8-10 pal',
  'Solo': '15-21 pal',
  'Kamion': '33 pal',
  'LKW': '33 pal',
}

// Mapování kódu expedičního skladu na název
const WAREHOUSE_NAMES = {
  'CZTC1': 'Úžice (Třídírna)',
  'CZLC4': 'Chrášťany',
  'LCU': 'LCU',
  'LCS': 'LCS',
  'LCZ': 'LCZ',
  'SKLC3': 'SKLC3',
}

// Deduplikace sazeb - ponech jen nejnovější podle klíče
function deduplicateRates(rates, getKey) {
  const map = new Map()
  rates.forEach(rate => {
    const key = getKey(rate)
    const existing = map.get(key)
    if (!existing || new Date(rate.validFrom) > new Date(existing.validFrom)) {
      map.set(key, rate)
    }
  })
  return Array.from(map.values())
}

// Komponenta pro zobrazení štítku dodatku
function ContractBadge({ label }) {
  if (!label) return null
  return (
    <span className="text-xs px-1.5 py-0.5 rounded ml-2" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-light)' }}>
      {label}
    </span>
  )
}

// Komponenta pro jedno depo - všechny sazby pohromadě
function DepotSection({ depot, linehaulRates, fixRates, kmRates, depoRates, bonusRates }) {
  const depotConfig = DEPOT_CONFIG[depot] || { color: '#6b7280', icon: '📍', label: depot }
  
  // Deduplikace
  const uniqueLinehaulRates = deduplicateRates(linehaulRates, r => `${r.fromCode}_${r.toCode}_${r.vehicleType}`)
  const uniqueFixRates = deduplicateRates(fixRates, r => r.routeType || 'default')
  const uniqueKmRates = deduplicateRates(kmRates, r => r.routeType || 'default')
  const uniqueDepoRates = deduplicateRates(depoRates, r => `${r.depoName}_${r.rateType}`)
  const uniqueBonusRates = deduplicateRates(bonusRates, r => `${r.qualityMin}_${r.qualityMax}`)
  
  const hasRates = uniqueLinehaulRates.length > 0 || uniqueFixRates.length > 0 || 
                   uniqueKmRates.length > 0 || uniqueDepoRates.length > 0 || uniqueBonusRates.length > 0
  
  if (!hasRates) return null

  // Seskupit linehauly podle zdroje
  const linehaulsBySource = uniqueLinehaulRates.reduce((acc, rate) => {
    const source = rate.fromCode || 'Neznámý'
    if (!acc[source]) acc[source] = []
    acc[source].push(rate)
    return acc
  }, {})

  // Rozdělit DEPO sazby na hodinové a měsíční
  const hourlyDepoRates = uniqueDepoRates.filter(r => r.rateType === 'hourly' || r.depoName?.toLowerCase().includes('vratimov'))
  const monthlyDepoRates = uniqueDepoRates.filter(r => r.rateType === 'monthly' || r.depoName?.toLowerCase().includes('sklad'))

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: depotConfig.color + '40' }}>
      {/* Header depa */}
      <div 
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: depotConfig.color + '10' }}
      >
        <span className="text-xl">{depotConfig.icon}</span>
        <span className="font-semibold text-lg" style={{ color: depotConfig.color }}>
          {depotConfig.label}
        </span>
      </div>
      
      {/* Obsah - všechny sekce */}
      <div className="p-4 space-y-6">
        
        {/* 1. LINEHAUL - z expedičních skladů na depo */}
        {Object.keys(linehaulsBySource).length > 0 && (
          <div className="space-y-3">
            <h5 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#ef4444' }}>
              <Truck size={16} />
              Linehaul (z expedičních skladů na depo)
            </h5>
            <div className="space-y-3">
              {Object.entries(linehaulsBySource).map(([source, rates]) => (
                <div key={source} className="space-y-2">
                  <h6 className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Z {WAREHOUSE_NAMES[source] || source} ({source}):
                  </h6>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {rates.map((rate, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {rate.vehicleType}
                          <span className="text-xs ml-1 px-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                            {VEHICLE_PALLETS[rate.vehicleType] || '?'}
                          </span>
                        </span>
                        <div className="flex items-center">
                          <span className="font-semibold" style={{ color: '#ef4444' }}>{formatCZK(rate.rate)}</span>
                          <ContractBadge label={rate.contractLabel} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. ROZVOZ Z DEPA (dodávky) - FIX, KM, DEPO hodiny */}
        {(uniqueFixRates.length > 0 || uniqueKmRates.length > 0 || hourlyDepoRates.length > 0) && (
          <div className="space-y-3">
            <h5 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#8b5cf6' }}>
              <Package size={16} />
              Rozvoz z depa (dodávky)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* FIX sazby */}
              {uniqueFixRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <DollarSign size={12} />
                    FIX sazba
                  </h6>
                  {uniqueFixRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Za trasu</span>
                      <div className="flex items-center">
                        <span className="font-semibold" style={{ color: '#8b5cf6' }}>{formatCZK(rate.rate)}</span>
                        <ContractBadge label={rate.contractLabel} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* KM sazby */}
              {uniqueKmRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <MapPin size={12} />
                    Km sazba
                  </h6>
                  {uniqueKmRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Za km</span>
                      <div className="flex items-center">
                        <span className="font-semibold" style={{ color: '#10b981' }}>{rate.rate} Kč/km</span>
                        <ContractBadge label={rate.contractLabel} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* DEPO hodiny */}
              {hourlyDepoRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Warehouse size={12} />
                    Práce na depu
                  </h6>
                  {hourlyDepoRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Hodinová</span>
                      <div className="flex items-center">
                        <span className="font-semibold" style={{ color: '#0891b2' }}>{formatCZK(rate.rate)}/h</span>
                        <ContractBadge label={rate.contractLabel} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. SKLADOVÉ SLUŽBY + BONUSY (pouze Nový Bydžov) */}
        {(monthlyDepoRates.length > 0 || uniqueBonusRates.length > 0) && (
          <div className="space-y-3">
            <h5 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0891b2' }}>
              <Warehouse size={16} />
              Skladové služby
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Měsíční paušály */}
              {monthlyDepoRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Měsíční paušál
                  </h6>
                  {monthlyDepoRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {rate.depoName?.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center">
                        <span className="font-semibold" style={{ color: '#0891b2' }}>{formatCZK(rate.rate)}/měs</span>
                        <ContractBadge label={rate.contractLabel} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Bonusy */}
              {uniqueBonusRates.length > 0 && (
                <div className="space-y-2">
                  <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Award size={12} />
                    Bonusy za kvalitu
                  </h6>
                  {uniqueBonusRates.map((rate, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {rate.qualityMin >= 98 ? '≥' : ''}{rate.qualityMin}% - {rate.qualityMax}%
                      </span>
                      <div className="flex items-center">
                        <span className="font-semibold" style={{ color: '#f59e0b' }}>+{formatCZK(rate.bonusAmount)}</span>
                        <ContractBadge label={rate.contractLabel} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

  // Seskupit sazby podle rozvozového depa
  const depots = ['Vratimov', 'Nový Bydžov']
  const ratesByDepot = {}
  
  // Najdi která depa mají FIX sazby (pro sdílení KM sazeb)
  const depotsWithFixRates = new Set(
    allFixRates.map(r => detectDepot(r, 'fix')).filter(Boolean)
  )
  
  depots.forEach(depot => {
    // FIX sazby - přesné přiřazení
    const fixRates = allFixRates.filter(r => detectDepot(r, 'fix') === depot)
    
    // KM sazby - sdílené mezi depy které mají FIX sazby
    let kmRates = allKmRates.filter(r => detectDepot(r, 'km') === depot)
    if (depotsWithFixRates.has(depot)) {
      const sharedKmRates = allKmRates.filter(r => detectDepot(r, 'km') === null)
      kmRates = [...kmRates, ...sharedKmRates]
    }
    
    // DEPO sazby
    const depoRates = allDepoRates.filter(r => detectDepot(r, 'depo') === depot)
    
    // Linehaul sazby - přesné + sdílené
    let linehaulRates = allLinehaulRates.filter(r => detectDepot(r, 'linehaul') === depot)
    const sharedLinehaulRates = allLinehaulRates.filter(r => detectDepot(r, 'linehaul') === null)
    linehaulRates = [...linehaulRates, ...sharedLinehaulRates]
    
    // Bonus sazby
    const bonusRates = allBonusRates.filter(r => detectDepot(r, 'bonus') === depot)
    
    ratesByDepot[depot] = { fixRates, kmRates, depoRates, linehaulRates, bonusRates }
  })

  const hasAnyRates = allFixRates.length > 0 || allKmRates.length > 0 || 
                      allDepoRates.length > 0 || allLinehaulRates.length > 0 || 
                      allBonusRates.length > 0

  if (!hasAnyRates) return null
  
  // Najdi depa s nějakými sazbami
  const activeDepots = depots.filter(depot => {
    const d = ratesByDepot[depot]
    return d.fixRates.length > 0 || d.kmRates.length > 0 || d.depoRates.length > 0 || 
           d.linehaulRates.length > 0 || d.bonusRates.length > 0
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
            {activeDepots.length} {activeDepots.length === 1 ? 'depo' : 'depa'} • {activeConfigs.length} aktivní {activeConfigs.length === 1 ? 'ceník' : 'ceníky'}
          </p>
        </div>
      </div>

      {/* Content - Depot sections */}
      <div className="p-6 space-y-4">
        {activeDepots.map(depot => (
          <DepotSection
            key={depot}
            depot={depot}
            linehaulRates={ratesByDepot[depot].linehaulRates}
            fixRates={ratesByDepot[depot].fixRates}
            kmRates={ratesByDepot[depot].kmRates}
            depoRates={ratesByDepot[depot].depoRates}
            bonusRates={ratesByDepot[depot].bonusRates}
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
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Struktura:</span>
          <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span>Expediční sklady: CZTC1, CZLC4, LCU...</span>
            <span>→</span>
            <span>Rozvozová depa: 🏭 Vratimov, 📦 Nový Bydžov</span>
            <span>→</span>
            <span>AlzaBoxy</span>
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
