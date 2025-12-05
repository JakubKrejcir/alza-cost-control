/**
 * Prices.jsx - Přehled ceníků
 * Tabulkové zobrazení - vše viditelné najednou
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Truck, Package, Building2, Award, AlertCircle } from 'lucide-react'
import { prices, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

// =============================================================================
// KONFIGURACE
// =============================================================================

const DEPOT_CONFIG = {
  'VRATIMOV': { name: 'Vratimov', color: '#ef4444', emoji: '🔴' },
  'NOVY_BYDZOV': { name: 'Nový Bydžov', color: '#3b82f6', emoji: '🔵' },
  'BRNO': { name: 'Brno', color: '#10b981', emoji: '🟢' },
  'CESKE_BUDEJOVICE': { name: 'Č. Budějovice', color: '#f59e0b', emoji: '🟠' },
  'RAKOVNIK': { name: 'Rakovník', color: '#8b5cf6', emoji: '🟣' },
  'DIRECT': { name: 'Praha/STČ', color: '#0ea5e9', emoji: '🏢' },
}

const VEHICLE_TYPES = ['DODAVKA', 'SOLO', 'KAMION']
const VEHICLE_LABELS = {
  'DODAVKA': { label: 'Dodávka', emoji: '🚐', pallets: '8-10 pal' },
  'SOLO': { label: 'Solo', emoji: '🚛', pallets: '15-21 pal' },
  'KAMION': { label: 'Kamion', emoji: '🚚', pallets: '33 pal' },
}

// =============================================================================
// UTILITY
// =============================================================================

function formatCZK(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function extractDepotCode(text) {
  if (!text) return null
  const t = text.toUpperCase()
  if (t.includes('VRATIMOV')) return 'VRATIMOV'
  if (t.includes('BYDZOV') || t.includes('BYDŽOV')) return 'NOVY_BYDZOV'
  if (t.includes('BRNO')) return 'BRNO'
  if (t.includes('BUDEJOVIC') || t.includes('BUDĚJOVIC')) return 'CESKE_BUDEJOVICE'
  if (t.includes('RAKOVNIK') || t.includes('RAKOVNÍK')) return 'RAKOVNIK'
  if (t.includes('PRAHA') || t.includes('DIRECT') || t.includes('STČ')) return 'DIRECT'
  return null
}

// =============================================================================
// KOMPONENTY
// =============================================================================

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: '#f1f5f9' }}
      >
        <Icon size={20} className="text-slate-600" />
      </div>
      <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">
        {title}
      </h2>
    </div>
  )
}

function DepotHeader({ depotCode, children }) {
  const config = DEPOT_CONFIG[depotCode] || { name: depotCode, color: '#64748b', emoji: '⚪' }
  return (
    <th 
      className="px-4 py-3 text-center font-semibold text-sm"
      style={{ 
        backgroundColor: `${config.color}15`,
        color: config.color,
        borderBottom: `2px solid ${config.color}`
      }}
    >
      <span className="mr-1">{config.emoji}</span>
      {children || config.name}
    </th>
  )
}

// LINEHAUL TABULKA
function LinehaulTable({ linehaulRates, depots }) {
  if (linehaulRates.length === 0) return null
  
  // Vytvoř matici: vehicle_type -> depot -> rate
  const matrix = {}
  VEHICLE_TYPES.forEach(vt => {
    matrix[vt] = {}
  })
  
  linehaulRates.forEach(rate => {
    const vehicleType = (rate.vehicleType || rate.vehicle_type || 'KAMION').toUpperCase()
    const toDepot = rate.toCode || rate.to_code || extractDepotCode(rate.description) || 'UNKNOWN'
    
    // Normalizuj vehicle type
    let normalizedVT = vehicleType
    if (vehicleType.includes('DODAV') || vehicleType.includes('VAN')) normalizedVT = 'DODAVKA'
    else if (vehicleType.includes('SOLO')) normalizedVT = 'SOLO'
    else if (vehicleType.includes('KAMION') || vehicleType.includes('TRUCK')) normalizedVT = 'KAMION'
    
    if (matrix[normalizedVT]) {
      matrix[normalizedVT][toDepot] = rate.rate
    }
  })
  
  // Zjisti které depoty mají data
  const activeDepots = depots.filter(d => 
    VEHICLE_TYPES.some(vt => matrix[vt][d] != null)
  )
  
  if (activeDepots.length === 0) return null
  
  return (
    <div className="mb-8">
      <SectionHeader icon={Truck} title="Linehaul (přeprava ze skladu na depo)" />
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
                Typ vozu
              </th>
              {activeDepots.map(depot => (
                <DepotHeader key={depot} depotCode={depot} />
              ))}
            </tr>
          </thead>
          <tbody>
            {VEHICLE_TYPES.map((vt, idx) => {
              const info = VEHICLE_LABELS[vt]
              const hasAnyRate = activeDepots.some(d => matrix[vt][d] != null)
              if (!hasAnyRate) return null
              
              return (
                <tr 
                  key={vt} 
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                >
                  <td className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.emoji}</span>
                      <div>
                        <div className="font-medium text-slate-800">{info.label}</div>
                        <div className="text-xs text-slate-400">{info.pallets}</div>
                      </div>
                    </div>
                  </td>
                  {activeDepots.map(depot => (
                    <td 
                      key={depot} 
                      className="px-4 py-3 text-center border-b border-slate-100"
                    >
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {matrix[vt][depot] ? formatCZK(matrix[vt][depot]) : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ROZVOZ TABULKA (FIX + KM)
function RozvozTable({ fixRates, kmRates }) {
  if (fixRates.length === 0 && kmRates.length === 0) return null
  
  // Seskup fix rates podle depa
  const fixByDepot = {}
  fixRates.forEach(rate => {
    const routeType = rate.routeType || rate.route_type || ''
    const depot = rate.depot?.code || extractDepotCode(routeType) || 'DIRECT'
    const category = rate.routeCategory || rate.route_category
    const isFromWarehouse = category === 'DIRECT_SKLAD' || routeType.toUpperCase().includes('DIRECT')
    
    if (!fixByDepot[depot]) {
      fixByDepot[depot] = []
    }
    
    // Extrahuj typ trasy (DPO/SD)
    let tripType = 'DIRECT'
    const rt = routeType.toUpperCase()
    if (rt.includes('DPO')) tripType = 'DPO'
    else if (rt.includes('SD') || rt.includes('SAME')) tripType = 'SD'
    
    fixByDepot[depot].push({
      tripType,
      rate: rate.rate,
      isFromWarehouse,
      routeType
    })
  })
  
  // Seskup km rates podle depa
  const kmByDepot = {}
  kmRates.forEach(rate => {
    const depot = rate.depot?.code || extractDepotCode(rate.routeType || rate.route_type) || 'DIRECT'
    kmByDepot[depot] = rate.rate
  })
  
  // Vytvoř řádky tabulky
  const rows = []
  Object.entries(fixByDepot).forEach(([depot, rates]) => {
    rates.forEach(r => {
      rows.push({
        depot,
        tripType: r.tripType,
        fixRate: r.rate,
        kmRate: kmByDepot[depot],
        source: r.isFromWarehouse ? 'ze skladu' : 'z depa',
        routeType: r.routeType
      })
    })
  })
  
  // Seřaď podle depa
  const depotOrder = ['VRATIMOV', 'NOVY_BYDZOV', 'BRNO', 'CESKE_BUDEJOVICE', 'RAKOVNIK', 'DIRECT']
  rows.sort((a, b) => {
    const aIdx = depotOrder.indexOf(a.depot)
    const bIdx = depotOrder.indexOf(b.depot)
    if (aIdx !== bIdx) return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    return a.tripType.localeCompare(b.tripType)
  })
  
  if (rows.length === 0) return null
  
  return (
    <div className="mb-8">
      <SectionHeader icon={Package} title="Rozvoz (FIX za trasu + KM)" />
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-slate-600 border-b border-slate-200">Depo</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 border-b border-slate-200">Typ trasy</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600 border-b border-slate-200">FIX/trasa</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600 border-b border-slate-200">Kč/km</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 border-b border-slate-200">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const config = DEPOT_CONFIG[row.depot] || { name: row.depot, color: '#64748b', emoji: '⚪' }
              const prevRow = rows[idx - 1]
              const showDepot = !prevRow || prevRow.depot !== row.depot
              
              return (
                <tr 
                  key={`${row.depot}-${row.tripType}-${idx}`}
                  className={showDepot && idx > 0 ? 'border-t-2 border-slate-200' : ''}
                  style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafbfc' }}
                >
                  <td className="px-4 py-3 border-b border-slate-100">
                    {showDepot && (
                      <div className="flex items-center gap-2">
                        <span>{config.emoji}</span>
                        <span className="font-medium" style={{ color: config.color }}>
                          {config.name}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {row.tripType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right border-b border-slate-100">
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatCZK(row.fixRate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right border-b border-slate-100">
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {row.kmRate ? `${Number(row.kmRate).toFixed(2)} Kč` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center border-b border-slate-100">
                    <span 
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.source === 'ze skladu' 
                          ? 'bg-sky-50 text-sky-700' 
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {row.source}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// NÁKLADY DEP TABULKA
function DepoNakladyTable({ depoRates, depots }) {
  if (depoRates.length === 0) return null
  
  // Seskup podle depa a typu
  const byDepot = {}
  depoRates.forEach(rate => {
    const depot = rate.depot?.code || extractDepotCode(rate.depoName || rate.depo_name) || 'UNKNOWN'
    const rateType = rate.rateType || rate.rate_type || 'monthly'
    
    if (!byDepot[depot]) {
      byDepot[depot] = {}
    }
    byDepot[depot][rateType] = rate.rate
  })
  
  const activeDepots = depots.filter(d => byDepot[d])
  if (activeDepots.length === 0) return null
  
  const rateTypes = [
    { key: 'monthly', label: 'Sklad/měsíc' },
    { key: 'hourly', label: 'Hodinová sazba' },
  ]
  
  return (
    <div className="mb-8">
      <SectionHeader icon={Building2} title="Náklady dep (měsíční paušály)" />
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
                Typ nákladu
              </th>
              {activeDepots.map(depot => (
                <DepotHeader key={depot} depotCode={depot} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rateTypes.map((rt, idx) => {
              const hasAnyRate = activeDepots.some(d => byDepot[d]?.[rt.key] != null)
              if (!hasAnyRate) return null
              
              return (
                <tr 
                  key={rt.key}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                >
                  <td className="px-4 py-3 border-b border-slate-100 font-medium text-slate-700">
                    {rt.label}
                  </td>
                  {activeDepots.map(depot => (
                    <td 
                      key={depot} 
                      className="px-4 py-3 text-center border-b border-slate-100"
                    >
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {byDepot[depot]?.[rt.key] 
                          ? `${formatCZK(byDepot[depot][rt.key])}${rt.key === 'hourly' ? '/hod' : ''}` 
                          : '—'
                        }
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// BONUSY TABULKA
function BonusyTable({ bonusRates }) {
  if (bonusRates.length === 0) return null
  
  // Seřaď podle quality_min
  const sorted = [...bonusRates].sort((a, b) => {
    const aMin = a.qualityMin || a.quality_min || 0
    const bMin = b.qualityMin || b.quality_min || 0
    return aMin - bMin
  })
  
  return (
    <div className="mb-8">
      <SectionHeader icon={Award} title="Bonusy za kvalitu" />
      
      <div className="overflow-x-auto">
        <div className="flex gap-0 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          {sorted.map((bonus, idx) => {
            const min = bonus.qualityMin || bonus.quality_min || 0
            const max = bonus.qualityMax || bonus.quality_max || 100
            const amount = bonus.bonusAmount || bonus.bonus_amount || 0
            
            const isLast = idx === sorted.length - 1
            const isFirst = idx === 0
            
            // Gradient barva podle výše bonusu
            const intensity = idx / (sorted.length - 1)
            const bgColor = amount > 0 
              ? `rgba(16, 185, 129, ${0.05 + intensity * 0.15})` 
              : '#fef2f2'
            
            return (
              <div 
                key={idx}
                className="flex-1 text-center py-4 px-3 border-r border-slate-200 last:border-r-0"
                style={{ backgroundColor: bgColor }}
              >
                <div className="text-sm font-medium text-slate-600 mb-2">
                  {isFirst ? `< ${max}%` : isLast ? `≥ ${min}%` : `${min}-${max}%`}
                </div>
                <div 
                  className={`text-lg font-bold ${amount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {amount > 0 ? `+${formatCZK(amount)}` : '0 Kč'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// PRÁZDNÝ STAV
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-xl border border-slate-200">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-slate-400" />
      </div>
      <p className="text-slate-500 text-center">{message}</p>
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
  
  // Načti smlouvy (pro čísla dodatků)
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
  
  // Zpracuj data
  const processedData = useMemo(() => {
    if (!priceList) return { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [], bonusRates: [], depots: [] }
    
    const fixRates = []
    const kmRates = []
    const linehaulRates = []
    const depoRates = []
    const bonusRates = []
    const depotsSet = new Set()
    
    priceList.forEach(pc => {
      ;(pc.fix_rates || pc.fixRates || []).forEach(r => {
        fixRates.push(r)
        const depot = r.depot?.code || extractDepotCode(r.routeType || r.route_type)
        if (depot) depotsSet.add(depot)
      })
      
      ;(pc.km_rates || pc.kmRates || []).forEach(r => {
        kmRates.push(r)
        const depot = r.depot?.code || extractDepotCode(r.routeType || r.route_type)
        if (depot) depotsSet.add(depot)
      })
      
      ;(pc.linehaul_rates || pc.linehaulRates || []).forEach(r => {
        linehaulRates.push(r)
        const depot = r.toCode || r.to_code
        if (depot) depotsSet.add(depot)
      })
      
      ;(pc.depo_rates || pc.depoRates || []).forEach(r => {
        depoRates.push(r)
        const depot = r.depot?.code || extractDepotCode(r.depoName || r.depo_name)
        if (depot) depotsSet.add(depot)
      })
      
      ;(pc.bonus_rates || pc.bonusRates || []).forEach(r => {
        bonusRates.push(r)
      })
    })
    
    // Seřaď depoty
    const depotOrder = ['VRATIMOV', 'NOVY_BYDZOV', 'BRNO', 'CESKE_BUDEJOVICE', 'RAKOVNIK', 'DIRECT']
    const depots = Array.from(depotsSet).sort((a, b) => {
      const aIdx = depotOrder.indexOf(a)
      const bIdx = depotOrder.indexOf(b)
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    })
    
    return { fixRates, kmRates, linehaulRates, depoRates, bonusRates, depots }
  }, [priceList])
  
  // Najdi poslední dodatek
  const latestAmendment = useMemo(() => {
    if (!contractList || contractList.length === 0) return null
    const sorted = [...contractList].sort((a, b) => {
      const aNum = a.amendment_number || a.amendmentNumber || 0
      const bNum = b.amendment_number || b.amendmentNumber || 0
      return bNum - aNum
    })
    return sorted[0]?.amendment_number || sorted[0]?.amendmentNumber
  }, [contractList])
  
  const hasAnyData = processedData.fixRates.length > 0 || 
                     processedData.kmRates.length > 0 || 
                     processedData.linehaulRates.length > 0 || 
                     processedData.depoRates.length > 0 ||
                     processedData.bonusRates.length > 0
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Ceníky
              {selectedCarrier && (
                <span className="text-slate-400 font-normal ml-2">· {selectedCarrier.name}</span>
              )}
            </h1>
          </div>
          
          {latestAmendment && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <span className="text-sm text-slate-500">Aktuální:</span>
              <span className="text-sm font-semibold text-slate-800">Dodatek D{latestAmendment}</span>
            </div>
          )}
        </div>
        
        {/* Content */}
        {!selectedCarrierId ? (
          <EmptyState message="Vyberte dopravce v hlavičce stránky" />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full" />
          </div>
        ) : !hasAnyData ? (
          <EmptyState message="Pro tohoto dopravce nejsou nahrány žádné ceníky. Nahrajte smlouvu v sekci Dokumenty." />
        ) : (
          <>
            <LinehaulTable 
              linehaulRates={processedData.linehaulRates} 
              depots={processedData.depots} 
            />
            
            <RozvozTable 
              fixRates={processedData.fixRates} 
              kmRates={processedData.kmRates} 
            />
            
            <DepoNakladyTable 
              depoRates={processedData.depoRates} 
              depots={processedData.depots} 
            />
            
            <BonusyTable 
              bonusRates={processedData.bonusRates} 
            />
          </>
        )}
      </div>
    </div>
  )
}
