/**
 * Prices.jsx - Zobrazení ceníků
 * Updated: 2025-12-05 - Využívá depot_id, route_category, from_warehouse_id
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Package, Truck, Building2, Warehouse, TrendingUp, 
  Loader2, AlertTriangle, MapPin
} from 'lucide-react'
import { prices, contracts } from '../lib/api'
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
  'VRATIMOV': '#ef4444',      // červená
  'NOVY_BYDZOV': '#3b82f6',   // modrá
  'BRNO': '#10b981',          // zelená
  'CESKE_BUDEJOVICE': '#f59e0b', // oranžová
  'RAKOVNIK': '#8b5cf6',      // fialová
  'DIRECT': '#06b6d4',        // tyrkysová
  'UNKNOWN': '#6b7280',       // šedá
}

// Názvy dep
const DEPOT_NAMES = {
  'VRATIMOV': 'Vratimov',
  'NOVY_BYDZOV': 'Nový Bydžov',
  'BRNO': 'Brno',
  'CESKE_BUDEJOVICE': 'České Budějovice',
  'RAKOVNIK': 'Rakovník',
  'DIRECT': 'DIRECT (Praha)',
  'DIRECT_SKLAD': 'DIRECT ze skladu',
  'DIRECT_DEPO': 'DIRECT z depa',
  'UNKNOWN': 'Ostatní',
}

// Ikony pro typy vozidel
const VEHICLE_ICONS = {
  'DODAVKA': '🚐',
  'SOLO': '🚛',
  'KAMION': '🚚',
}

// Kapacity palet
const PALLET_CAPACITY = {
  'DODAVKA': '8-10 pal',
  'SOLO': '15-21 pal',
  'KAMION': '33 pal',
}

// =============================================================================
// KOMPONENTY
// =============================================================================

function PriceRow({ label, value, unit, dodatek, routeCategory, depotCode }) {
  return (
    <div className="flex items-center justify-between py-3 px-4" 
      style={{ borderBottom: '1px solid var(--color-border-light)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        {routeCategory && (
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: routeCategory === 'DIRECT_SKLAD' ? '#06b6d420' : '#8b5cf620',
              color: routeCategory === 'DIRECT_SKLAD' ? '#06b6d4' : '#8b5cf6'
            }}
          >
            {routeCategory === 'DIRECT_SKLAD' ? 'Ze skladu' : 'Z depa'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
          {typeof value === 'number' ? formatCZK(value) : value}
          {unit && <span className="font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{unit}</span>}
        </span>
        {dodatek && (
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
            title={`Dodatek č. ${dodatek}`}
          >
            D{dodatek}
          </span>
        )}
      </div>
    </div>
  )
}

function ServiceSection({ title, icon: Icon, color, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null
  
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color }}>
        {Icon && <Icon size={16} />}
        {title}
      </h4>
      <div className="rounded-lg divide-y" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border-light)' }}>
        {children}
      </div>
    </div>
  )
}

function DepotCard({ depotCode, priceData, color }) {
  const { fixRates, kmRates, linehaulRates, depoRates } = priceData
  const depotName = DEPOT_NAMES[depotCode] || depotCode
  
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ backgroundColor: `${color}15`, borderColor: 'var(--color-border)' }}>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color }}>
          <Building2 size={20} />
          {depotName}
          <span className="text-sm font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
            ({fixRates.length + kmRates.length + linehaulRates.length + depoRates.length} sazeb)
          </span>
        </h3>
      </div>
      
      {/* Content */}
      <div className="p-6 space-y-4">
        {/* FIX sazby */}
        {fixRates.length > 0 && (
          <ServiceSection title="Rozvoz (FIX za trasu)" icon={Package} color={color}>
            {fixRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={rate.routeType || rate.route_type || 'Standardní'}
                value={rate.rate}
                routeCategory={rate.routeCategory || rate.route_category}
                dodatek={rate.dodatek}
              />
            ))}
          </ServiceSection>
        )}
        
        {/* KM sazby */}
        {kmRates.length > 0 && (
          <ServiceSection title="Variabilní náklady" icon={Truck} color={color}>
            {kmRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={rate.routeType || rate.route_type || 'Kč/km'}
                value={rate.rate}
                unit="/km"
                dodatek={rate.dodatek}
              />
            ))}
          </ServiceSection>
        )}
        
        {/* Linehaul */}
        {linehaulRates.length > 0 && (
          <ServiceSection title="Line-haul" icon={Truck} color={color}>
            {linehaulRates.map((rate, idx) => {
              const vehicleType = rate.vehicleType || rate.vehicle_type || 'KAMION'
              const fromCode = rate.fromCode || rate.from_code || '?'
              const toCode = rate.toCode || rate.to_code || depotCode
              const palletMin = rate.palletCapacityMin || rate.pallet_capacity_min
              const palletMax = rate.palletCapacityMax || rate.pallet_capacity_max
              const warehouseCode = rate.warehouseCode || rate.warehouse_code || rate.fromWarehouse?.code
              
              return (
                <PriceRow 
                  key={idx}
                  label={
                    <span className="flex items-center gap-2">
                      <span>{VEHICLE_ICONS[vehicleType] || '🚛'}</span>
                      <span>{fromCode} → {toCode}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" 
                        style={{ backgroundColor: 'var(--color-bg-dark)', color: 'var(--color-text-muted)' }}>
                        {vehicleType}
                      </span>
                      {palletMin && palletMax && (
                        <span className="text-xs" style={{ color: 'var(--color-text-light)' }}>
                          ({palletMin === palletMax ? `${palletMin} pal` : `${palletMin}-${palletMax} pal`})
                        </span>
                      )}
                      {warehouseCode && (
                        <span className="text-xs px-1.5 py-0.5 rounded" 
                          style={{ backgroundColor: '#06b6d420', color: '#06b6d4' }}>
                          {warehouseCode}
                        </span>
                      )}
                    </span>
                  }
                  value={rate.rate}
                  dodatek={rate.dodatek}
                />
              )
            })}
          </ServiceSection>
        )}
        
        {/* DEPO náklady */}
        {depoRates.length > 0 && (
          <ServiceSection title="Náklady depa" icon={Warehouse} color={color}>
            {depoRates.map((rate, idx) => {
              const rateType = rate.rateType || rate.rate_type || 'monthly'
              const unit = rateType === 'hourly' ? '/hod' : rateType === 'daily' ? '/den' : '/měs'
              
              return (
                <PriceRow 
                  key={idx}
                  label={rate.depoName || rate.depo_name || 'Depo'}
                  value={rate.rate}
                  unit={unit}
                  dodatek={rate.dodatek}
                />
              )
            })}
          </ServiceSection>
        )}
        
        {/* Prázdný stav */}
        {fixRates.length === 0 && kmRates.length === 0 && linehaulRates.length === 0 && depoRates.length === 0 && (
          <div className="text-center py-8" style={{ color: 'var(--color-text-light)' }}>
            Žádné ceny pro toto depo
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// HLAVNÍ KOMPONENTA
// =============================================================================

export default function Prices() {
  const { selectedCarrierId, carrierList } = useCarrier()
  
  const selectedCarrier = useMemo(() => {
    return carrierList?.find(c => c.id === Number(selectedCarrierId))
  }, [carrierList, selectedCarrierId])
  
  // Načti smlouvy pro dodatky
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
  
  // Zpracuj data - seskup podle depa s využitím depot_id
  const pricesByDepot = useMemo(() => {
    if (!priceList) return {}
    
    const result = {}
    
    // Mapa contract_id -> číslo dodatku
    const contractMap = {}
    contractList?.forEach(c => {
      contractMap[c.id] = c.amendment_number || c.amendmentNumber || '?'
    })
    
    priceList.forEach(priceConfig => {
      const dodatek = contractMap[priceConfig.contract_id || priceConfig.contractId] || '?'
      
      // FIX rates - prioritně podle depot objektu, pak route_category
      ;(priceConfig.fix_rates || priceConfig.fixRates || []).forEach(rate => {
        // NOVÁ LOGIKA: použij depot z relationship nebo route_category
        let depotKey
        if (rate.depot) {
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
        
        // Deduplikace
        const existing = result[depotKey].fixRates.find(r => 
          (r.routeType || r.route_type) === (rate.routeType || rate.route_type)
        )
        if (!existing) {
          result[depotKey].fixRates.push({ ...rate, dodatek })
        }
      })
      
      // KM rates - prioritně podle depot objektu
      ;(priceConfig.km_rates || priceConfig.kmRates || []).forEach(rate => {
        let depotKey
        if (rate.depot) {
          depotKey = rate.depot.code
        } else {
          depotKey = 'UNKNOWN'
        }
        
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
      
      // Linehaul rates - podle to_code (cílové depo)
      ;(priceConfig.linehaul_rates || priceConfig.linehaulRates || []).forEach(rate => {
        const depotKey = rate.to_code || rate.toCode || 'UNKNOWN'
        
        if (!result[depotKey]) {
          result[depotKey] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        }
        
        // Přidej warehouse info z relationship
        const enrichedRate = {
          ...rate,
          warehouseCode: rate.fromWarehouse?.code || rate.from_warehouse?.code,
          dodatek
        }
        
        const key = `${rate.from_code || rate.fromCode}-${rate.vehicle_type || rate.vehicleType}`
        const existing = result[depotKey].linehaulRates.find(r => 
          `${r.from_code || r.fromCode}-${r.vehicle_type || r.vehicleType}` === key
        )
        if (!existing) {
          result[depotKey].linehaulRates.push(enrichedRate)
        }
      })
      
      // Depo rates - podle depot objektu nebo depo_name
      ;(priceConfig.depo_rates || priceConfig.depoRates || []).forEach(rate => {
        let depotKey
        if (rate.depot) {
          depotKey = rate.depot.code
        } else {
          // Extrahuj z depo_name
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
          (r.rateType || r.rate_type) === (rate.rateType || rate.rate_type) &&
          (r.depoName || r.depo_name) === (rate.depoName || rate.depo_name)
        )
        if (!existing) {
          result[depotKey].depoRates.push({ ...rate, dodatek })
        }
      })
    })
    
    return result
  }, [priceList, contractList])
  
  // Seřaď depa - DIRECT první, pak podle abecedy
  const sortedDepots = useMemo(() => {
    const depots = Object.keys(pricesByDepot)
    return depots.sort((a, b) => {
      if (a === 'DIRECT') return -1
      if (b === 'DIRECT') return 1
      if (a === 'UNKNOWN') return 1
      if (b === 'UNKNOWN') return -1
      return (DEPOT_NAMES[a] || a).localeCompare(DEPOT_NAMES[b] || b, 'cs')
    })
  }, [pricesByDepot])
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Ceníky</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Přehled sazeb dle depa a typu služby
          </p>
        </div>
        
        <div className="card p-12 text-center">
          <TrendingUp className="mx-auto mb-4" size={48} style={{ color: 'var(--color-text-light)' }} />
          <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Vyberte dopravce
          </h2>
          <p style={{ color: 'var(--color-text-light)' }}>
            Pro zobrazení ceníků vyberte dopravce v hlavičce stránky
          </p>
        </div>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Ceníky</h1>
        </div>
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Načítám ceníky...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Ceníky</h1>
        </div>
        <div className="card p-6" style={{ borderLeft: '4px solid var(--color-red)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: 'var(--color-red)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-red)' }}>Chyba při načítání</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {error.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            Ceníky — {selectedCarrier?.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {sortedDepots.length} dep • {priceList?.length || 0} ceníků
          </p>
        </div>
      </div>
      
      {/* Karty per depo */}
      {sortedDepots.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertTriangle className="mx-auto mb-4" size={48} style={{ color: 'var(--color-orange)' }} />
          <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Žádné ceníky
          </h2>
          <p style={{ color: 'var(--color-text-light)' }}>
            Pro tohoto dopravce nejsou nahrány žádné aktivní ceníky
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedDepots.map(depotCode => (
            <DepotCard
              key={depotCode}
              depotCode={depotCode}
              priceData={pricesByDepot[depotCode]}
              color={DEPOT_COLORS[depotCode] || DEPOT_COLORS['UNKNOWN']}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HELPER: Extrakce depa z route_type (fallback)
// =============================================================================

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
