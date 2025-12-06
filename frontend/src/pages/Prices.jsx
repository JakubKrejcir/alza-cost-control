import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  DollarSign, 
  Truck, 
  Package, 
  Warehouse, 
  FileText, 
  AlertCircle,
  MapPin,
  ArrowRight,
  Building2,
  Factory
} from 'lucide-react'
import { prices, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 2 
  }).format(amount)
}

// Normalizace názvu depa
function normalizeDepotName(name) {
  if (!name) return 'Ostatní'
  const normalized = name.trim()
  // Oprava zkratek
  if (normalized === 'V') return 'Vratimov'
  if (normalized === 'NB' || normalized === 'Novy_Bydzov') return 'Nový Bydžov'
  // Nahrazení podtržítek mezerami
  return normalized.replace(/_/g, ' ')
}

// Mapování zdrojového skladu na čitelný název
function formatSourceWarehouse(code) {
  const warehouses = {
    'CZTC1': 'Úžice (CZTC1)',
    'CZLC4': 'Chrášťany (CZLC4)',
    'LCZ_CZTC1': 'LCZ Úžice',
    'LCU': 'LCU',
    'LCS': 'LCS',
    'SKLC3': 'SKLC3'
  }
  return warehouses[code] || code
}

// Typ vozu s kapacitou palet
function formatVehicleType(type, palletMin, palletMax) {
  const vehicleNames = {
    'DODAVKA': 'Dodávka',
    'SOLO': 'Solo',
    'KAMION': 'Kamion'
  }
  const name = vehicleNames[type?.toUpperCase()] || type
  if (palletMin && palletMax) {
    return `${name} (${palletMin}-${palletMax} pal)`
  }
  if (palletMax) {
    return `${name} (${palletMax} pal)`
  }
  return name
}

// =============================================================================
// BADGE KOMPONENTA PRO ČÍSLO DODATKU
// =============================================================================

function DodatekBadge({ number }) {
  if (!number || number === '?') return null
  
  return (
    <span 
      className="text-xs px-2 py-0.5 rounded-full font-medium ml-2"
      style={{ 
        backgroundColor: 'var(--color-primary-light)', 
        color: 'var(--color-primary)' 
      }}
      title={`Dodatek č. ${number}`}
    >
      D{number}
    </span>
  )
}

// =============================================================================
// TABULKA LINEHAUL
// =============================================================================

function LinehaulTable({ rates, title }) {
  if (!rates || rates.length === 0) return null

  // Seskup podle zdrojového skladu
  const bySource = {}
  rates.forEach(rate => {
    const source = rate.fromCode || rate.from_code || 'Neznámý'
    if (!bySource[source]) bySource[source] = []
    bySource[source].push(rate)
  })

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
        <Truck size={16} style={{ color: 'var(--color-primary)' }} />
        {title || 'LINEHAUL (přeprava ze skladu na depo)'}
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Zdroj</th>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Typ vozu</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Sazba</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Dodatek</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bySource).map(([source, sourceRates]) => (
              sourceRates.map((rate, idx) => (
                <tr 
                  key={`${source}-${idx}`} 
                  className="border-b"
                  style={{ borderColor: 'var(--color-border-light)' }}
                >
                  <td className="p-3">
                    {idx === 0 && (
                      <span className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: 'var(--color-text-muted)' }} />
                        {formatSourceWarehouse(source)}
                      </span>
                    )}
                  </td>
                  <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>
                    {formatVehicleType(
                      rate.vehicleType || rate.vehicle_type,
                      rate.palletCapacityMin || rate.pallet_capacity_min,
                      rate.palletCapacityMax || rate.pallet_capacity_max
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                    {formatCZK(rate.rate)}
                  </td>
                  <td className="p-3 text-right">
                    <DodatekBadge number={rate.dodatek} />
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// TABULKA ROZVOZ (FIX + KM)
// =============================================================================

function RozvozTable({ fixRates, kmRates, title }) {
  const hasData = (fixRates && fixRates.length > 0) || (kmRates && kmRates.length > 0)
  if (!hasData) return null

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
        <Package size={16} style={{ color: 'var(--color-green)' }} />
        {title || 'ROZVOZ (FIX za trasu + KM)'}
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Typ trasy</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>FIX/trasa</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Kč/km</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Dodatek</th>
            </tr>
          </thead>
          <tbody>
            {fixRates?.map((fix, idx) => {
              // Najdi odpovídající KM sazbu
              const km = kmRates?.find(k => 
                (k.routeType || k.route_type) === (fix.routeType || fix.route_type)
              ) || kmRates?.[0]
              
              const routeType = fix.routeType || fix.route_type || 'Standardní'
              const displayName = routeType.replace('DIRECT_', '').replace(/_/g, ' ')
              
              return (
                <tr 
                  key={idx}
                  className="border-b"
                  style={{ borderColor: 'var(--color-border-light)' }}
                >
                  <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>
                    {displayName}
                  </td>
                  <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                    {formatCZK(fix.rate)}
                  </td>
                  <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                    {km ? `${Number(km.rate).toFixed(2)} Kč` : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <DodatekBadge number={fix.dodatek} />
                  </td>
                </tr>
              )
            })}
            {/* Pokud jsou jen KM sazby bez FIX */}
            {(!fixRates || fixRates.length === 0) && kmRates?.map((km, idx) => (
              <tr 
                key={idx}
                className="border-b"
                style={{ borderColor: 'var(--color-border-light)' }}
              >
                <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>
                  Standardní
                </td>
                <td className="p-3 text-right" style={{ color: 'var(--color-text-muted)' }}>
                  —
                </td>
                <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                  {Number(km.rate).toFixed(2)} Kč
                </td>
                <td className="p-3 text-right">
                  <DodatekBadge number={km.dodatek} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// TABULKA NÁKLADY DEPA
// =============================================================================

function DepoNakladyTable({ depoRates, title }) {
  if (!depoRates || depoRates.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
        <Building2 size={16} style={{ color: 'var(--color-orange)' }} />
        {title || 'NÁKLADY DEPA (měsíční paušály)'}
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Položka</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Sazba</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Dodatek</th>
            </tr>
          </thead>
          <tbody>
            {depoRates.map((rate, idx) => (
              <tr 
                key={idx}
                className="border-b"
                style={{ borderColor: 'var(--color-border-light)' }}
              >
                <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>
                  {rate.rateType || rate.rate_type || rate.depoName || rate.depo_name || 'Provoz depa'}
                </td>
                <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                  {formatCZK(rate.rate)}
                  {(rate.rateType || rate.rate_type)?.includes('hodin') && '/h'}
                  {(rate.rateType || rate.rate_type)?.includes('den') && '/den'}
                  {(rate.rateType || rate.rate_type)?.includes('měs') && '/měs'}
                </td>
                <td className="p-3 text-right">
                  <DodatekBadge number={rate.dodatek} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// TABULKA SKLADOVÉ SLUŽBY (Bonusy)
// =============================================================================

function SkladoveSluzbyTable({ bonusRates, title }) {
  if (!bonusRates || bonusRates.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
        <Warehouse size={16} style={{ color: 'var(--color-purple)' }} />
        {title || 'SKLADOVÉ SLUŽBY'}
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Kvalita</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Bonus</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Celkem s bonusem</th>
              <th className="text-right p-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Dodatek</th>
            </tr>
          </thead>
          <tbody>
            {bonusRates.map((rate, idx) => (
              <tr 
                key={idx}
                className="border-b"
                style={{ borderColor: 'var(--color-border-light)' }}
              >
                <td className="p-3" style={{ color: 'var(--color-text-dark)' }}>
                  ≥ {rate.qualityMin || rate.quality_min}%
                </td>
                <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-green)' }}>
                  +{formatCZK(rate.bonusAmount || rate.bonus_amount)}
                </td>
                <td className="p-3 text-right font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                  {formatCZK(rate.totalWithBonus || rate.total_with_bonus)}
                </td>
                <td className="p-3 text-right">
                  <DodatekBadge number={rate.dodatek} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// KARTA DEPA
// =============================================================================

function DepoCard({ depoName, data, color }) {
  const { linehaulRates, fixRates, kmRates, depoRates, bonusRates } = data
  
  const hasAnyData = 
    linehaulRates?.length > 0 || 
    fixRates?.length > 0 || 
    kmRates?.length > 0 || 
    depoRates?.length > 0 || 
    bonusRates?.length > 0

  if (!hasAnyData) return null

  return (
    <div className="card overflow-hidden mb-4">
      {/* Header */}
      <div 
        className="px-5 py-3 border-b flex items-center gap-3"
        style={{ 
          backgroundColor: `${color}10`, 
          borderColor: 'var(--color-border)' 
        }}
      >
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
          Depo {depoName}
        </h3>
      </div>
      
      {/* Content */}
      <div className="p-5">
        <LinehaulTable rates={linehaulRates} />
        <RozvozTable fixRates={fixRates} kmRates={kmRates} />
        <DepoNakladyTable depoRates={depoRates} />
        <SkladoveSluzbyTable bonusRates={bonusRates} />
      </div>
    </div>
  )
}

// =============================================================================
// SEKCE TYPU ZÁVOZU
// =============================================================================

function ServiceTypeSection({ title, icon: Icon, color, children, depotCount }) {
  return (
    <div className="mb-8">
      {/* Header sekce */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-dark)' }}>
            {title}
          </h2>
          {depotCount > 0 && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {depotCount} {depotCount === 1 ? 'depo' : 'depa'}
            </p>
          )}
        </div>
      </div>
      
      {/* Obsah */}
      <div className="pl-4">
        {children}
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
  
  // Načti smlouvy pro čísla dodatků
  const { data: contractList } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })
  
  // Načti ceníky
  const { data: priceList, isLoading } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId, active: 'true' }),
    enabled: !!selectedCarrierId
  })
  
  // Zpracuj data - seskup podle typu služby → depo
  const processedData = useMemo(() => {
    if (!priceList) return { alzabox: {}, tridirna: {} }
    
    // Mapa contract_id → číslo dodatku
    const contractMap = {}
    contractList?.forEach(c => {
      contractMap[c.id] = c.amendmentNumber || c.amendment_number || null
    })
    
    const result = {
      alzabox: {},  // Rozvoz AlzaBox
      tridirna: {}  // Svoz Třídírna
    }
    
    // Seřaď podle data platnosti (nejnovější první) pro deduplikaci
    const sortedPriceList = [...priceList].sort((a, b) => 
      new Date(b.validFrom || b.valid_from) - new Date(a.validFrom || a.valid_from)
    )
    
    sortedPriceList.forEach(priceConfig => {
      const dodatek = contractMap[priceConfig.contractId || priceConfig.contract_id]
      
      // Zpracuj Linehaul rates - kategorie podle CÍLOVÉ DESTINACE
      const linehaulRates = priceConfig.linehaulRates || priceConfig.linehaul_rates || []
      linehaulRates.forEach(rate => {
        const toCode = (rate.toCode || rate.to_code || '').toLowerCase()
        const toDepot = normalizeDepotName(rate.toCode || rate.to_code)
        
        // Urči kategorii podle cíle:
        // - Cíl = třídírna (CZTC1) → SVOZ TŘÍDÍRNA
        // - Cíl = depo (Vratimov, NB) → ROZVOZ ALZABOX
        let category = 'alzabox'
        if (toCode.includes('cztc1') || toCode.includes('tridirna') || toCode.includes('třídírna')) {
          category = 'tridirna'
        }
        
        if (!result[category][toDepot]) {
          result[category][toDepot] = {
            linehaulRates: [],
            fixRates: [],
            kmRates: [],
            depoRates: [],
            bonusRates: []
          }
        }
        
        // Deduplikace - přidej pouze pokud neexistuje stejná kombinace
        const key = `${rate.fromCode || rate.from_code}-${rate.vehicleType || rate.vehicle_type}`
        const exists = result[category][toDepot].linehaulRates.some(r => 
          `${r.fromCode || r.from_code}-${r.vehicleType || r.vehicle_type}` === key
        )
        
        if (!exists) {
          result[category][toDepot].linehaulRates.push({ ...rate, dodatek })
        }
      })
      
      // Zpracuj FIX rates - vždy pod ALZABOX (rozvozové sazby)
      const fixRates = priceConfig.fixRates || priceConfig.fix_rates || []
      fixRates.forEach(rate => {
        const routeType = rate.routeType || rate.route_type || ''
        
        // Extrahuj depo z názvu trasy (např. DIRECT_Vratimov → Vratimov)
        let depot = 'Praha/STČ'
        if (routeType.toLowerCase().includes('vratimov')) {
          depot = 'Vratimov'
        } else if (routeType.toLowerCase().includes('bydzov') || routeType.toLowerCase().includes('bydžov')) {
          depot = 'Nový Bydžov'
        }
        
        const category = 'alzabox'  // FIX sazby jsou vždy pro rozvoz
        
        if (!result[category][depot]) {
          result[category][depot] = {
            linehaulRates: [],
            fixRates: [],
            kmRates: [],
            depoRates: [],
            bonusRates: []
          }
        }
        
        // Deduplikace
        const exists = result[category][depot].fixRates.some(r => 
          (r.routeType || r.route_type) === routeType
        )
        
        if (!exists) {
          result[category][depot].fixRates.push({ ...rate, dodatek })
        }
      })
      
      // Zpracuj KM rates - přiřaď ke všem ALZABOX depům
      const kmRates = priceConfig.kmRates || priceConfig.km_rates || []
      kmRates.forEach(rate => {
        Object.keys(result.alzabox).forEach(depot => {
          const exists = result.alzabox[depot].kmRates.some(r => 
            (r.routeType || r.route_type) === (rate.routeType || rate.route_type)
          )
          if (!exists) {
            result.alzabox[depot].kmRates.push({ ...rate, dodatek })
          }
        })
      })
      
      // Zpracuj Depo rates - vždy pod ALZABOX
      const depoRates = priceConfig.depoRates || priceConfig.depo_rates || []
      depoRates.forEach(rate => {
        const depot = normalizeDepotName(rate.depoName || rate.depo_name)
        const category = 'alzabox'
        
        if (!result[category][depot]) {
          result[category][depot] = {
            linehaulRates: [],
            fixRates: [],
            kmRates: [],
            depoRates: [],
            bonusRates: []
          }
        }
        
        const exists = result[category][depot].depoRates.some(r => 
          (r.rateType || r.rate_type) === (rate.rateType || rate.rate_type)
        )
        
        if (!exists) {
          result[category][depot].depoRates.push({ ...rate, dodatek })
        }
      })
      
      // Zpracuj Bonus rates - patří k Nový Bydžov (sklad), pod ALZABOX
      const bonusRates = priceConfig.bonusRates || priceConfig.bonus_rates || []
      bonusRates.forEach(rate => {
        const depot = 'Nový Bydžov'
        const category = 'alzabox'
        
        if (!result[category][depot]) {
          result[category][depot] = {
            linehaulRates: [],
            fixRates: [],
            kmRates: [],
            depoRates: [],
            bonusRates: []
          }
        }
        
        const exists = result[category][depot].bonusRates.some(r => 
          (r.qualityMin || r.quality_min) === (rate.qualityMin || rate.quality_min)
        )
        
        if (!exists) {
          result[category][depot].bonusRates.push({ ...rate, dodatek })
        }
      })
    })
    
    return result
  }, [priceList, contractList])
  
  // Barvy pro depa
  const depotColors = {
    'Vratimov': '#ef4444',
    'Nový Bydžov': '#22c55e',
    'Praha/STČ': '#3b82f6',
    'Praha': '#3b82f6',
    'default': '#6b7280'
  }
  
  const getDepotColor = (depot) => {
    for (const [key, color] of Object.entries(depotColors)) {
      if (depot.toLowerCase().includes(key.toLowerCase())) return color
    }
    return depotColors.default
  }
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
          Ceníky
          {selectedCarrier && (
            <span style={{ color: 'var(--color-primary)' }}>· {selectedCarrier.name}</span>
          )}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Přehled sazeb podle typu závozu a depa
        </p>
      </div>
      
      {/* Loading */}
      {isLoading && (
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-4"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} 
          />
          <p style={{ color: 'var(--color-text-muted)' }}>Načítání ceníků...</p>
        </div>
      )}
      
      {/* Žádný dopravce */}
      {!selectedCarrierId && !isLoading && (
        <div className="card p-12 text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-light)' }} />
          <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>
            Vyberte dopravce
          </h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pro zobrazení ceníků vyberte dopravce v hlavičce aplikace
          </p>
        </div>
      )}
      
      {/* Žádná data */}
      {selectedCarrierId && !isLoading && (!priceList || priceList.length === 0) && (
        <div className="card p-12 text-center">
          <FileText size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-light)' }} />
          <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>
            Žádné ceníky
          </h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pro tohoto dopravce nejsou k dispozici žádné aktivní ceníky
          </p>
        </div>
      )}
      
      {/* Data */}
      {selectedCarrierId && !isLoading && priceList && priceList.length > 0 && (
        <>
          {/* ROZVOZ ALZABOX */}
          {Object.keys(processedData.alzabox).length > 0 && (
            <ServiceTypeSection 
              title="ROZVOZ ALZABOX" 
              icon={Package} 
              color="#3b82f6"
              depotCount={Object.keys(processedData.alzabox).length}
            >
              {Object.entries(processedData.alzabox).map(([depot, data]) => (
                <DepoCard 
                  key={depot}
                  depoName={depot}
                  data={data}
                  color={getDepotColor(depot)}
                />
              ))}
            </ServiceTypeSection>
          )}
          
          {/* SVOZ TŘÍDÍRNA */}
          {Object.keys(processedData.tridirna).length > 0 && (
            <ServiceTypeSection 
              title="SVOZ TŘÍDÍRNA" 
              icon={Factory} 
              color="#8b5cf6"
              depotCount={Object.keys(processedData.tridirna).length}
            >
              {Object.entries(processedData.tridirna).map(([depot, data]) => (
                <DepoCard 
                  key={depot}
                  depoName={depot}
                  data={data}
                  color={getDepotColor(depot)}
                />
              ))}
            </ServiceTypeSection>
          )}
          
          {/* Historie dodatků */}
          {contractList && contractList.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                  <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                  Historie dodatků ke smlouvě
                </h2>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {contractList
                    .filter(c => c.amendmentNumber || c.amendment_number)
                    .sort((a, b) => (b.amendmentNumber || b.amendment_number || 0) - (a.amendmentNumber || a.amendment_number || 0))
                    .map(contract => (
                      <div 
                        key={contract.id} 
                        className="flex items-center gap-4 p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        <DodatekBadge number={contract.amendmentNumber || contract.amendment_number} />
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          od {contract.validFrom || contract.valid_from 
                            ? new Date(contract.validFrom || contract.valid_from).toLocaleDateString('cs-CZ')
                            : '?'}
                        </span>
                        <span className="text-sm flex-1" style={{ color: 'var(--color-text-dark)' }}>
                          {contract.type || contract.number || '—'}
                        </span>
                      </div>
                    ))
                  }
                  {contractList.filter(c => c.amendmentNumber || c.amendment_number).length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                      Žádné dodatky s číslem
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}