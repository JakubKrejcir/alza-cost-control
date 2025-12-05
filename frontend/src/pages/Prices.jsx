/**
 * Prices.jsx - Přehled ceníků
 * Premium UI Design - Logistická aplikace
 * 
 * Design: Luxusní minimalistický styl s důrazem na čitelnost a hierarchii
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Truck, Package, Building2, Warehouse, TrendingUp, 
  ChevronRight, Search, Filter, Loader2, AlertTriangle,
  MapPin, Clock, Zap, Star, ArrowUpRight
} from 'lucide-react'
import { prices, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

// =============================================================================
// KONFIGURACE
// =============================================================================

const DEPOT_CONFIG = {
  'DIRECT': { 
    name: 'Praha & Střední Čechy', 
    color: '#0ea5e9', 
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    icon: '🏢',
    description: 'Přímé rozvozy ze skladu'
  },
  'VRATIMOV': { 
    name: 'Vratimov', 
    color: '#ef4444', 
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    icon: '🔴',
    description: 'Moravskoslezský kraj'
  },
  'NOVY_BYDZOV': { 
    name: 'Nový Bydžov', 
    color: '#3b82f6', 
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    icon: '🔵',
    description: 'Východní Čechy'
  },
  'BRNO': { 
    name: 'Brno', 
    color: '#10b981', 
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    icon: '🟢',
    description: 'Jihomoravský kraj'
  },
  'CESKE_BUDEJOVICE': { 
    name: 'České Budějovice', 
    color: '#f59e0b', 
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    icon: '🟠',
    description: 'Jižní Čechy'
  },
  'RAKOVNIK': { 
    name: 'Rakovník', 
    color: '#8b5cf6', 
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    icon: '🟣',
    description: 'Západní Čechy'
  },
  'UNKNOWN': { 
    name: 'Ostatní', 
    color: '#64748b', 
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
    icon: '⚪',
    description: 'Nezařazené sazby'
  },
}

const VEHICLE_CONFIG = {
  'DODAVKA': { label: 'Dodávka', pallets: '8-10', icon: '🚐' },
  'SOLO': { label: 'Solo', pallets: '15-21', icon: '🚛' },
  'KAMION': { label: 'Kamion', pallets: '33', icon: '🚚' },
}

// =============================================================================
// UTILITY FUNKCE
// =============================================================================

function formatCZK(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function extractDepotFromRouteType(routeType) {
  if (!routeType) return null
  const rt = routeType.toUpperCase()
  if (rt.includes('VRATIMOV')) return 'VRATIMOV'
  if (rt.includes('BYDZOV') || rt.includes('BYDŽOV')) return 'NOVY_BYDZOV'
  if (rt.includes('BRNO')) return 'BRNO'
  if (rt.includes('BUDEJOVIC') || rt.includes('BUDĚJOVIC')) return 'CESKE_BUDEJOVICE'
  if (rt.includes('RAKOVNIK') || rt.includes('RAKOVNÍK')) return 'RAKOVNIK'
  if (rt.includes('PRAHA') || rt.includes('DIRECT')) return 'DIRECT'
  return null
}

// =============================================================================
// KOMPONENTY
// =============================================================================

// Animated Counter
function AnimatedValue({ value, suffix = '' }) {
  return (
    <span className="tabular-nums font-semibold">
      {formatCZK(value)}{suffix}
    </span>
  )
}

// Rate Badge (pro dodatek)
function DodatekBadge({ number }) {
  if (!number) return null
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ 
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
        color: '#7c3aed',
        border: '1px solid rgba(139, 92, 246, 0.2)'
      }}
    >
      <Star size={10} />
      D{number}
    </span>
  )
}

// Kategorie badge
function CategoryBadge({ category }) {
  const isWarehouse = category === 'DIRECT_SKLAD'
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ 
        backgroundColor: isWarehouse ? 'rgba(14, 165, 233, 0.1)' : 'rgba(139, 92, 246, 0.1)',
        color: isWarehouse ? '#0ea5e9' : '#8b5cf6',
      }}
    >
      {isWarehouse ? <Warehouse size={10} /> : <Building2 size={10} />}
      {isWarehouse ? 'Ze skladu' : 'Z depa'}
    </span>
  )
}

// Jednotlivý řádek sazby
function RateRow({ label, value, unit, dodatek, category, highlight, description }) {
  return (
    <div 
      className={`group relative flex items-center justify-between py-3.5 px-4 transition-all duration-200 ${highlight ? 'bg-gradient-to-r from-amber-50 to-transparent' : 'hover:bg-slate-50/80'}`}
      style={{ borderBottom: '1px solid #f1f5f9' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 truncate">
              {label}
            </span>
            {category && <CategoryBadge category={category} />}
          </div>
          {description && (
            <span className="text-xs text-slate-400">{description}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className="text-base font-semibold text-slate-900 tabular-nums">
            {formatCZK(value)}
          </span>
          {unit && (
            <span className="text-sm text-slate-400 ml-1">{unit}</span>
          )}
        </div>
        {dodatek && <DodatekBadge number={dodatek} />}
      </div>
      
      {/* Hover indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// Sekce s typem sazby
function RateSection({ title, icon: Icon, color, rates, children }) {
  const hasRates = rates && rates.length > 0
  
  if (!hasRates && !children) return null
  
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          {title}
        </h4>
        {hasRates && (
          <span className="text-xs text-slate-400 ml-auto">
            {rates.length} {rates.length === 1 ? 'sazba' : rates.length < 5 ? 'sazby' : 'sazeb'}
          </span>
        )}
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
        {children || rates.map((rate, idx) => (
          <RateRow 
            key={idx}
            label={rate.label}
            value={rate.value}
            unit={rate.unit}
            dodatek={rate.dodatek}
            category={rate.category}
            description={rate.description}
          />
        ))}
      </div>
    </div>
  )
}

// Linehaul karta
function LinehaulCard({ rate }) {
  const vehicleInfo = VEHICLE_CONFIG[rate.vehicleType] || VEHICLE_CONFIG['KAMION']
  
  return (
    <div 
      className="group relative bg-white rounded-xl border border-slate-200/60 p-4 hover:shadow-lg hover:border-slate-300 transition-all duration-300"
    >
      {/* Vehicle icon */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{vehicleInfo.icon}</span>
          <div>
            <div className="text-sm font-semibold text-slate-800">{vehicleInfo.label}</div>
            <div className="text-xs text-slate-400">{vehicleInfo.pallets} palet</div>
          </div>
        </div>
        {rate.dodatek && <DodatekBadge number={rate.dodatek} />}
      </div>
      
      {/* Route */}
      <div className="flex items-center gap-2 mb-3 py-2 px-3 rounded-lg bg-slate-50">
        <span className="text-xs font-mono font-medium text-slate-600">{rate.fromCode}</span>
        <ArrowUpRight size={12} className="text-slate-400" />
        <span className="text-xs font-mono font-medium text-slate-600">{rate.toCode}</span>
      </div>
      
      {/* Price */}
      <div className="text-right">
        <span className="text-xl font-bold text-slate-900 tabular-nums">
          {formatCZK(rate.value)}
        </span>
      </div>
      
      {/* Hover effect */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%)',
        }}
      />
    </div>
  )
}

// Hlavní karta depa
function DepotCard({ depotCode, data, isExpanded, onToggle }) {
  const config = DEPOT_CONFIG[depotCode] || DEPOT_CONFIG['UNKNOWN']
  const { fixRates, kmRates, linehaulRates, depoRates } = data
  
  const totalRates = fixRates.length + kmRates.length + linehaulRates.length + depoRates.length
  
  // Transform rates for display
  const fixRatesFormatted = fixRates.map(r => ({
    label: r.routeType || r.route_type || 'Standardní trasa',
    value: r.rate,
    dodatek: r.dodatek,
    category: r.routeCategory || r.route_category,
  }))
  
  const kmRatesFormatted = kmRates.map(r => ({
    label: r.routeType || r.route_type || 'Kilometrová sazba',
    value: r.rate,
    unit: '/km',
    dodatek: r.dodatek,
  }))
  
  const depoRatesFormatted = depoRates.map(r => ({
    label: r.depoName || r.depo_name || 'Náklady depa',
    value: r.rate,
    unit: (r.rateType || r.rate_type) === 'hourly' ? '/hod' : '/měs',
    dodatek: r.dodatek,
    description: (r.rateType || r.rate_type) === 'hourly' ? 'Hodinová sazba' : 'Měsíční paušál',
  }))
  
  const linehaulRatesFormatted = linehaulRates.map(r => ({
    fromCode: r.fromCode || r.from_code || '?',
    toCode: r.toCode || r.to_code || depotCode,
    vehicleType: r.vehicleType || r.vehicle_type || 'KAMION',
    value: r.rate,
    dodatek: r.dodatek,
  }))
  
  return (
    <div 
      className="relative bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500"
      style={{ 
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
      }}
    >
      {/* Gradient top border */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: config.gradient }}
      />
      
      {/* Header */}
      <div 
        className="relative px-6 py-5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
              style={{ 
                background: `${config.color}10`,
                border: `1px solid ${config.color}20`,
              }}
            >
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {config.name}
              </h3>
              <p className="text-sm text-slate-500">{config.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">{totalRates}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">sazeb</div>
            </div>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'rotate-90' : ''}`}
              style={{ backgroundColor: `${config.color}10` }}
            >
              <ChevronRight size={18} style={{ color: config.color }} />
            </div>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
          {fixRates.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Package size={14} style={{ color: config.color }} />
              <span>{fixRates.length} FIX</span>
            </div>
          )}
          {kmRates.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin size={14} style={{ color: config.color }} />
              <span>{kmRates.length} KM</span>
            </div>
          )}
          {linehaulRates.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Truck size={14} style={{ color: config.color }} />
              <span>{linehaulRates.length} LH</span>
            </div>
          )}
          {depoRates.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Building2 size={14} style={{ color: config.color }} />
              <span>{depoRates.length} DEPO</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Content - expandable */}
      <div 
        className={`overflow-hidden transition-all duration-500 ease-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-6 pb-6 space-y-1">
          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-6" />
          
          {/* FIX sazby */}
          {fixRatesFormatted.length > 0 && (
            <RateSection 
              title="Rozvoz (FIX za trasu)" 
              icon={Package} 
              color={config.color}
              rates={fixRatesFormatted}
            />
          )}
          
          {/* KM sazby */}
          {kmRatesFormatted.length > 0 && (
            <RateSection 
              title="Variabilní náklady" 
              icon={MapPin} 
              color={config.color}
              rates={kmRatesFormatted}
            />
          )}
          
          {/* Linehaul */}
          {linehaulRatesFormatted.length > 0 && (
            <RateSection 
              title="Line-haul" 
              icon={Truck} 
              color={config.color}
              rates={[]}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {linehaulRatesFormatted.map((rate, idx) => (
                  <LinehaulCard key={idx} rate={rate} />
                ))}
              </div>
            </RateSection>
          )}
          
          {/* DEPO náklady */}
          {depoRatesFormatted.length > 0 && (
            <RateSection 
              title="Náklady depa" 
              icon={Building2} 
              color={config.color}
              rates={depoRatesFormatted}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Empty state
function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-6 shadow-inner">
        <Icon size={32} className="text-slate-300" />
      </div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-slate-500 text-center max-w-md">{description}</p>
    </div>
  )
}

// Loading state
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse" />
        <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-white animate-spin" />
      </div>
      <p className="mt-6 text-slate-500 font-medium">Načítám ceníky...</p>
    </div>
  )
}

// =============================================================================
// HLAVNÍ KOMPONENTA
// =============================================================================

export default function Prices() {
  const { selectedCarrierId, carrierList } = useCarrier()
  const [expandedDepots, setExpandedDepots] = useState(new Set(['DIRECT']))
  const [searchQuery, setSearchQuery] = useState('')
  
  const selectedCarrier = useMemo(() => {
    return carrierList?.find(c => c.id === Number(selectedCarrierId))
  }, [carrierList, selectedCarrierId])
  
  // Načti smlouvy
  const { data: contractList } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })
  
  // Načti ceníky
  const { data: priceList, isLoading, error } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId, active: 'true' }),
    enabled: !!selectedCarrierId
  })
  
  // Zpracuj data - seskup podle depa
  const pricesByDepot = useMemo(() => {
    if (!priceList) return {}
    
    const result = {}
    const contractMap = {}
    contractList?.forEach(c => {
      contractMap[c.id] = c.amendment_number || c.amendmentNumber || null
    })
    
    priceList.forEach(priceConfig => {
      const dodatek = contractMap[priceConfig.contract_id || priceConfig.contractId]
      
      // FIX rates
      ;(priceConfig.fix_rates || priceConfig.fixRates || []).forEach(rate => {
        let depotKey
        if (rate.depot?.code) {
          depotKey = rate.depot.code
        } else if (rate.routeCategory || rate.route_category) {
          const category = rate.routeCategory || rate.route_category
          depotKey = category === 'DIRECT_SKLAD' ? 'DIRECT' : extractDepotFromRouteType(rate.routeType || rate.route_type)
        } else {
          depotKey = extractDepotFromRouteType(rate.routeType || rate.route_type) || 'UNKNOWN'
        }
        
        if (!result[depotKey]) {
          result[depotKey] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        }
        
        const existing = result[depotKey].fixRates.find(r => 
          (r.routeType || r.route_type) === (rate.routeType || rate.route_type)
        )
        if (!existing) {
          result[depotKey].fixRates.push({ ...rate, dodatek })
        }
      })
      
      // KM rates
      ;(priceConfig.km_rates || priceConfig.kmRates || []).forEach(rate => {
        const depotKey = rate.depot?.code || 'UNKNOWN'
        
        if (!result[depotKey]) {
          result[depotKey] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        }
        
        const existing = result[depotKey].kmRates.find(r => 
          (r.routeType || r.route_type) === (rate.routeType || rate.route_type)
        )
        if (!existing) {
          result[depotKey].kmRates.push({ ...rate, dodatek })
        }
      })
      
      // Linehaul rates
      ;(priceConfig.linehaul_rates || priceConfig.linehaulRates || []).forEach(rate => {
        const depotKey = rate.to_code || rate.toCode || 'UNKNOWN'
        
        if (!result[depotKey]) {
          result[depotKey] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        }
        
        const key = `${rate.from_code || rate.fromCode}-${rate.vehicle_type || rate.vehicleType}`
        const existing = result[depotKey].linehaulRates.find(r => 
          `${r.from_code || r.fromCode}-${r.vehicle_type || r.vehicleType}` === key
        )
        if (!existing) {
          result[depotKey].linehaulRates.push({ ...rate, dodatek })
        }
      })
      
      // Depo rates
      ;(priceConfig.depo_rates || priceConfig.depoRates || []).forEach(rate => {
        let depotKey = rate.depot?.code
        if (!depotKey) {
          const depoName = (rate.depo_name || rate.depoName || '').toLowerCase()
          if (depoName.includes('vratimov')) depotKey = 'VRATIMOV'
          else if (depoName.includes('bydžov') || depoName.includes('bydzov')) depotKey = 'NOVY_BYDZOV'
          else if (depoName.includes('brno')) depotKey = 'BRNO'
          else depotKey = 'UNKNOWN'
        }
        
        if (!result[depotKey]) {
          result[depotKey] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        }
        
        const existing = result[depotKey].depoRates.find(r => 
          (r.rateType || r.rate_type) === (rate.rateType || rate.rate_type)
        )
        if (!existing) {
          result[depotKey].depoRates.push({ ...rate, dodatek })
        }
      })
    })
    
    return result
  }, [priceList, contractList])
  
  // Seřaď depa
  const sortedDepots = useMemo(() => {
    const depots = Object.keys(pricesByDepot)
    const order = ['DIRECT', 'VRATIMOV', 'NOVY_BYDZOV', 'BRNO', 'CESKE_BUDEJOVICE', 'RAKOVNIK', 'UNKNOWN']
    return depots.sort((a, b) => {
      const aIndex = order.indexOf(a)
      const bIndex = order.indexOf(b)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [pricesByDepot])
  
  // Toggle depot expansion
  const toggleDepot = (depotCode) => {
    setExpandedDepots(prev => {
      const next = new Set(prev)
      if (next.has(depotCode)) {
        next.delete(depotCode)
      } else {
        next.add(depotCode)
      }
      return next
    })
  }
  
  // Expand/collapse all
  const expandAll = () => setExpandedDepots(new Set(sortedDepots))
  const collapseAll = () => setExpandedDepots(new Set())
  
  // Stats
  const totalRates = useMemo(() => {
    let count = 0
    Object.values(pricesByDepot).forEach(data => {
      count += data.fixRates.length + data.kmRates.length + data.linehaulRates.length + data.depoRates.length
    })
    return count
  }, [pricesByDepot])
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Ceníky
              </h1>
              <p className="text-slate-500">
                {selectedCarrier ? (
                  <>
                    <span className="font-medium text-slate-700">{selectedCarrier.name}</span>
                    {' · '}
                    <span>{sortedDepots.length} dep · {totalRates} sazeb</span>
                  </>
                ) : (
                  'Přehled sazeb podle dep a typů služeb'
                )}
              </p>
            </div>
            
            {selectedCarrierId && sortedDepots.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  Rozbalit vše
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                >
                  Sbalit vše
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        {!selectedCarrierId ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
            <EmptyState 
              title="Vyberte dopravce" 
              description="Pro zobrazení ceníků vyberte dopravce v hlavičce stránky"
              icon={TrendingUp}
            />
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
            <div className="flex items-center gap-4 text-red-600">
              <AlertTriangle size={24} />
              <div>
                <h3 className="font-semibold">Chyba při načítání</h3>
                <p className="text-sm text-red-500">{error.message}</p>
              </div>
            </div>
          </div>
        ) : sortedDepots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
            <EmptyState 
              title="Žádné ceníky" 
              description="Pro tohoto dopravce nejsou nahrány žádné aktivní ceníky. Nahrajte smlouvu v sekci Dokumenty."
              icon={Package}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDepots.map(depotCode => (
              <DepotCard
                key={depotCode}
                depotCode={depotCode}
                data={pricesByDepot[depotCode]}
                isExpanded={expandedDepots.has(depotCode)}
                onToggle={() => toggleDepot(depotCode)}
              />
            ))}
          </div>
        )}
        
        {/* Legend */}
        {sortedDepots.length > 0 && (
          <div className="mt-8 p-4 bg-white/50 rounded-xl border border-slate-200/40">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span className="font-medium text-slate-700">Legenda:</span>
              <div className="flex items-center gap-2 text-slate-500">
                <DodatekBadge number="7" />
                <span>= Dodatek č. 7</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CategoryBadge category="DIRECT_SKLAD" />
                <span>= Trasy ze skladu</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CategoryBadge category="DIRECT_DEPO" />
                <span>= Trasy z depa</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
