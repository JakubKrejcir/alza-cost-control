import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Building2, Truck, Package, Warehouse, FileText, AlertCircle } from 'lucide-react'
import { prices, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

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
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="flex items-center gap-3">
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

// Sekce služeb
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

// Karta depa
function DepotCard({ depot, priceData, color }) {
  const { fixRates, kmRates, linehaulRates, depoRates } = priceData
  
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ backgroundColor: `${color}15`, borderColor: 'var(--color-border)' }}>
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
          <div className="text-center py-8" style={{ color: 'var(--color-text-light)' }}>
            Žádné ceny pro toto depo
          </div>
        )}
      </div>
    </div>
  )
}

export default function Prices() {
  // Použij globální CarrierContext (dopravce je vybrán v hlavičce)
  const { selectedCarrierId, carrierList } = useCarrier()
  
  // Vybraný dopravce
  const selectedCarrier = useMemo(() => {
    return carrierList?.find(c => c.id === Number(selectedCarrierId))
  }, [carrierList, selectedCarrierId])
  
  // Načti smlouvy pro vybraného dopravce (pro čísla dodatků)
  const { data: contractList } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })
  
  // Načti ceníky pro vybraného dopravce
  const { data: priceList, isLoading } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })
  
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
    'Vratimov': 'var(--color-purple)',
    'Nový Bydžov': '#0891b2',
    'Praha': 'var(--color-green)',
    'Brno': 'var(--color-orange)',
    'default': 'var(--color-text-muted)'
  }
  
  const getDepotColor = (depot) => {
    for (const [key, color] of Object.entries(depotColors)) {
      if (depot.toLowerCase().includes(key.toLowerCase())) return color
    }
    return depotColors.default
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - bez dropdownu (používá se globální z Layout) */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Správa ceníků</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {selectedCarrier ? `${selectedCarrier.name} – přehled sazeb ze smluv` : 'Přehled sazeb podle typu služby'}
        </p>
      </div>
      
      {/* Prázdný stav - není vybrán dopravce */}
      {!selectedCarrierId && (
        <div className="card p-12 text-center">
          <DollarSign className="mx-auto mb-4" size={48} style={{ color: 'var(--color-text-light)' }} />
          <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Vyberte dopravce</h2>
          <p style={{ color: 'var(--color-text-light)' }}>Pro zobrazení ceníků vyberte dopravce v hlavičce stránky</p>
        </div>
      )}
      
      {/* Loading */}
      {selectedCarrierId && isLoading && (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p style={{ color: 'var(--color-text-muted)' }}>Načítám ceníky...</p>
        </div>
      )}
      
      {/* Smlouvy bez extrahovaných ceníků */}
      {selectedCarrierId && !isLoading && contractList?.length > 0 && Object.keys(pricesByDepot).length === 0 && (
        <div className="card p-6" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={24} style={{ color: 'var(--color-primary)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--color-primary)' }}>Smlouvy bez extrahovaných ceníků</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Máte {contractList.length} smlouvu, ale nepodařilo se z nich extrahovat žádné sazby. 
                Zkontrolujte formát PDF nebo přidejte ceníky ručně.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Ceníky podle dep */}
      {selectedCarrierId && !isLoading && (
        <>
          {Object.keys(pricesByDepot).length === 0 ? (
            <>
              {/* Nahrané smlouvy */}
              {contractList && contractList.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
                      <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                      Nahrané smlouvy ({contractList.length})
                    </h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Smazáním smlouvy se ceníky zachovají
                    </p>
                  </div>
                </div>
              )}
            </>
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
          {Object.keys(pricesByDepot).length > 0 && (
            <div className="p-4 rounded-lg flex flex-wrap items-center gap-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>Legenda:</span>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>D7</span>
                <span>= Dodatek č. 7</span>
              </div>
            </div>
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
              <div className="p-6">
                <div className="space-y-2">
                  {contractList
                    .filter(c => c.amendment_number || c.amendmentNumber)
                    .sort((a, b) => (b.amendment_number || b.amendmentNumber || 0) - (a.amendment_number || a.amendmentNumber || 0))
                    .map(contract => (
                      <div 
                        key={contract.id} 
                        className="flex items-center gap-4 p-3 rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        <span className="font-semibold w-24" style={{ color: 'var(--color-primary)' }}>
                          Dodatek {contract.amendment_number || contract.amendmentNumber}
                        </span>
                        <span className="text-sm w-28" style={{ color: 'var(--color-text-muted)' }}>
                          od {contract.valid_from || contract.validFrom 
                            ? new Date(contract.valid_from || contract.validFrom).toLocaleDateString('cs-CZ')
                            : '?'}
                        </span>
                        <span className="text-sm flex-1" style={{ color: 'var(--color-text-dark)' }}>
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
