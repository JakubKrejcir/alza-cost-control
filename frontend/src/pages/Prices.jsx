import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Building2, Truck, Package, Warehouse, ChevronDown, FileText } from 'lucide-react'
import { prices, carriers, contracts } from '../lib/api'

// Formátování měny
function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 2 
  }).format(amount)
}

// Řádek s cenou a dodatkem
function PriceRow({ label, value, dodatek, unit = '' }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/50 transition-colors">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-gray-900">
          {typeof value === 'number' ? formatCZK(value) : value}
          {unit && <span className="text-gray-500 font-normal ml-1">{unit}</span>}
        </span>
        {dodatek && (
          <span 
            className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
            title={`Dodatek č. ${dodatek}`}
          >
            D{dodatek}
          </span>
        )}
      </div>
    </div>
  )
}

// Sekce služeb
function ServiceSection({ title, icon: Icon, color, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null
  
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color }}>
        {Icon && <Icon size={16} />}
        {title}
      </h4>
      <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
        {children}
      </div>
    </div>
  )
}

// Karta depa
function DepotCard({ depot, priceData, color }) {
  const { fixRates, kmRates, linehaulRates, depoRates } = priceData
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ backgroundColor: `${color}15` }}>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color }}>
          <Building2 size={20} />
          {depot}
        </h3>
      </div>
      
      {/* Content */}
      <div className="p-6 space-y-4">
        {/* FIX sazby (rozvoz) */}
        {fixRates.length > 0 && (
          <ServiceSection title="Rozvoz (FIX za trasu)" icon={Package} color={color}>
            {fixRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={rate.routeType || rate.route_type || 'Standardní'}
                value={rate.rate}
                dodatek={rate.dodatek}
              />
            ))}
          </ServiceSection>
        )}
        
        {/* Km sazby */}
        {kmRates.length > 0 && (
          <ServiceSection title="Variabilní náklady" icon={Truck} color={color}>
            {kmRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={rate.description || 'Kč/km'}
                value={rate.rate}
                dodatek={rate.dodatek}
                unit="/km"
              />
            ))}
          </ServiceSection>
        )}
        
        {/* Linehaul */}
        {linehaulRates.length > 0 && (
          <ServiceSection title="Line-haul" icon={Truck} color={color}>
            {linehaulRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={`${rate.fromCode || rate.from_code || '?'} → ${rate.toCode || rate.to_code || depot} (${rate.vehicleType || rate.vehicle_type})`}
                value={rate.rate}
                dodatek={rate.dodatek}
              />
            ))}
          </ServiceSection>
        )}
        
        {/* Depo náklady */}
        {depoRates.length > 0 && (
          <ServiceSection title="Náklady depa" icon={Warehouse} color={color}>
            {depoRates.map((rate, idx) => (
              <PriceRow 
                key={idx}
                label={rate.name || rate.rateType || rate.rate_type || 'Měsíční náklad'}
                value={rate.rate}
                dodatek={rate.dodatek}
                unit="/měs"
              />
            ))}
          </ServiceSection>
        )}
        
        {/* Prázdný stav */}
        {fixRates.length === 0 && kmRates.length === 0 && linehaulRates.length === 0 && depoRates.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Žádné ceny pro toto depo
          </div>
        )}
      </div>
    </div>
  )
}

export default function Prices() {
  const [selectedCarrierId, setSelectedCarrierId] = useState(null)
  
  // Načti dopravce
  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => carriers.getAll()
  })
  
  // Načti smlouvy pro vybraného dopravce (pro čísla dodatků)
  const { data: contractList } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })
  
  // Načti ceníky pro vybraného dopravce
  const { data: priceList, isLoading } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId, active: 'true' }),
    enabled: !!selectedCarrierId
  })
  
  // Vybraný dopravce
  const selectedCarrier = useMemo(() => {
    return carrierList?.find(c => c.id === selectedCarrierId)
  }, [carrierList, selectedCarrierId])
  
  // Zpracuj data - seskup podle depa
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
      
      // FIX rates
      (priceConfig.fix_rates || priceConfig.fixRates || []).forEach(rate => {
        // Určení depa z route_type nebo defaultně
        const depot = extractDepot(rate.route_type || rate.routeType) || 'Ostatní'
        if (!result[depot]) result[depot] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        
        // Přidej pouze pokud ještě není (deduplikace - nejnovější)
        const existing = result[depot].fixRates.find(r => 
          (r.routeType || r.route_type) === (rate.routeType || rate.route_type)
        )
        if (!existing) {
          result[depot].fixRates.push({ ...rate, dodatek })
        }
      })
      
      // KM rates
      (priceConfig.km_rates || priceConfig.kmRates || []).forEach(rate => {
        const depot = rate.depot || rate.area || 'Ostatní'
        if (!result[depot]) result[depot] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        
        const existing = result[depot].kmRates.find(r => r.description === rate.description)
        if (!existing) {
          result[depot].kmRates.push({ ...rate, dodatek })
        }
      })
      
      // Linehaul rates
      (priceConfig.linehaul_rates || priceConfig.linehaulRates || []).forEach(rate => {
        const depot = rate.to_code || rate.toCode || rate.to_depot || 'Ostatní'
        if (!result[depot]) result[depot] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        
        const key = `${rate.from_code || rate.fromCode}-${rate.vehicle_type || rate.vehicleType}`
        const existing = result[depot].linehaulRates.find(r => 
          `${r.from_code || r.fromCode}-${r.vehicle_type || r.vehicleType}` === key
        )
        if (!existing) {
          result[depot].linehaulRates.push({ ...rate, dodatek })
        }
      })
      
      // Depo rates
      (priceConfig.depo_rates || priceConfig.depoRates || []).forEach(rate => {
        const depot = rate.depot || rate.depot_name || rate.depotName || 'Ostatní'
        if (!result[depot]) result[depot] = { fixRates: [], kmRates: [], linehaulRates: [], depoRates: [] }
        
        const existing = result[depot].depoRates.find(r => 
          (r.rateType || r.rate_type) === (rate.rateType || rate.rate_type)
        )
        if (!existing) {
          result[depot].depoRates.push({ ...rate, dodatek })
        }
      })
    })
    
    return result
  }, [priceList, contractList])
  
  // Pomocná funkce pro extrakci depa z route_type
  function extractDepot(routeType) {
    if (!routeType) return null
    
    // Vzory jako "DIRECT Praha", "DIRECT Vratimov", "DPO Nový Bydžov"
    const patterns = [
      /DIRECT\s+(\w+)/i,
      /DPO\s+(\w+)/i,
      /SD\s+(\w+)/i,
      /(\w+)\s*-/,
    ]
    
    for (const pattern of patterns) {
      const match = routeType.match(pattern)
      if (match) return match[1]
    }
    
    return routeType
  }
  
  // Barvy pro depa
  const depotColors = {
    'Vratimov': '#8b5cf6',
    'Nový Bydžov': '#0891b2',
    'Praha': '#10b981',
    'Brno': '#f59e0b',
    'default': '#6b7280'
  }
  
  const getDepotColor = (depot) => {
    for (const [key, color] of Object.entries(depotColors)) {
      if (depot.toLowerCase().includes(key.toLowerCase())) return color
    }
    return depotColors.default
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header s výběrem dopravce */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Správa ceníků</h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedCarrier ? `${selectedCarrier.name} – přehled sazeb ze smluv` : 'Vyberte dopravce'}
          </p>
        </div>
        
        {/* Dropdown dopravce */}
        <div className="relative">
          <select
            value={selectedCarrierId || ''}
            onChange={(e) => setSelectedCarrierId(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[200px]"
          >
            <option value="">Vyberte dopravce...</option>
            {carrierList?.map(carrier => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
      </div>
      
      {/* Prázdný stav - není vybrán dopravce */}
      {!selectedCarrierId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <DollarSign className="mx-auto text-gray-300 mb-4" size={48} />
          <h2 className="text-lg font-medium text-gray-600 mb-2">Vyberte dopravce</h2>
          <p className="text-gray-400">Pro zobrazení ceníků vyberte dopravce z menu výše</p>
        </div>
      )}
      
      {/* Loading */}
      {selectedCarrierId && isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Načítám ceníky...</p>
        </div>
      )}
      
      {/* Ceníky podle dep */}
      {selectedCarrierId && !isLoading && (
        <>
          {Object.keys(pricesByDepot).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Package className="mx-auto text-gray-300 mb-4" size={48} />
              <h2 className="text-lg font-medium text-gray-600 mb-2">Žádné ceníky</h2>
              <p className="text-gray-400">Pro tohoto dopravce nejsou definovány žádné aktivní ceníky</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(pricesByDepot).map(([depot, data]) => (
                <DepotCard 
                  key={depot} 
                  depot={depot} 
                  priceData={data}
                  color={getDepotColor(depot)}
                />
              ))}
            </div>
          )}
          
          {/* Legenda */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Legenda:</span>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">D7</span>
              <span>= Dodatek č. 7</span>
            </div>
          </div>
          
          {/* Historie dodatků */}
          {contractList && contractList.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                  <FileText size={20} className="text-blue-500" />
                  Historie dodatků ke smlouvě
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  {contractList
                    .filter(c => c.amendment_number || c.amendmentNumber)
                    .sort((a, b) => (b.amendment_number || b.amendmentNumber || 0) - (a.amendment_number || a.amendmentNumber || 0))
                    .map(contract => (
                      <div 
                        key={contract.id} 
                        className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-semibold text-blue-600 w-24">
                          Dodatek {contract.amendment_number || contract.amendmentNumber}
                        </span>
                        <span className="text-sm text-gray-500 w-28">
                          od {contract.valid_from || contract.validFrom 
                            ? new Date(contract.valid_from || contract.validFrom).toLocaleDateString('cs-CZ')
                            : '?'}
                        </span>
                        <span className="text-sm text-gray-700 flex-1">
                          {contract.type || contract.description || '—'}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
