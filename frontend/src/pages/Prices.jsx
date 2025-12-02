import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { DollarSign, FileText, AlertTriangle, Building2, Truck, Package, Warehouse } from 'lucide-react'
import { prices, contracts } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function PriceRow({ label, value, color = 'var(--color-primary)', dodatek }) {
  const isMissing = dodatek === '?'
  return (
    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold" style={{ color }}>{value}</span>
        {dodatek && (
          <span 
            className="text-xs px-1.5 py-0.5 rounded" 
            style={{ 
              backgroundColor: isMissing ? 'var(--color-orange-light)' : 'var(--color-border)', 
              color: isMissing ? '#e67e22' : 'var(--color-text-light)' 
            }}
            title={isMissing ? 'Chybí ve smlouvách' : `Dodatek č. ${dodatek}`}
          >
            {isMissing ? '?' : `D${dodatek}`}
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

export default function Prices() {
  const { data: contractList } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contracts.getAll()
  })

  const { data: priceList } = useQuery({
    queryKey: ['prices'],
    queryFn: () => prices.getAll({ active: 'true' })
  })

  const missingRates = [
    { name: 'FIX LH SD (druhý závoz)', value: '1 800 Kč' },
    { name: 'Depo Vratimov / den', value: '5 950 Kč' },
    { name: 'Dodávka 6 300 (Vratimov)', value: '6 300 Kč' },
    { name: 'Vratky', value: '3 700 Kč' }
  ]

  const contractHistory = [
    { id: 13, from: '1.11.2025', type: 'DROP 2.0', changes: 'Nový ceník DROP 2.0 (trasy A-I: 8 500 Kč)' },
    { id: 12, from: '1.10.2025', type: 'AlzaBox + XL + NB', changes: 'Depo Nový Bydžov, Linehaul do NB, Bonusový systém' },
    { id: 9, from: '1.7.2025', type: 'AlzaBox', changes: 'Přidány POSILY (Linehaul, Sólo, Dodávka)' },
    { id: 8, from: '1.6.2025', type: 'Třídírna', changes: 'Svozy CZTC1/CZLC4 → Vratimov' },
    { id: 7, from: '1.4.2025', type: 'AlzaBox', changes: 'FIX Direct Praha/Vratimov, Kč/km, Linehaul' }
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Správa ceníků</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Drivecool – přehled sazeb ze smluv</p>
        </div>
      </div>

      {/* Missing Rates - na vrchu */}
      <div className="card" style={{ borderLeft: '4px solid var(--color-orange)' }}>
        <div className="card-header" style={{ backgroundColor: 'var(--color-orange-light)' }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: '#e67e22' }}>
            <AlertTriangle size={20} />
            Položky z proofu CHYBĚJÍCÍ ve smlouvách
          </h3>
        </div>
        <div className="p-6">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Tyto sazby jsou použity v proofech, ale nejsou definovány v dodatcích:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {missingRates.map((item, idx) => (
              <PriceRow key={idx} label={item.name} value={item.value} color="#e67e22" dodatek="?" />
            ))}
          </div>
        </div>
      </div>

      {/* ====== DEPO VRATIMOV ====== */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-purple-light)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-purple)' }}>
            <Building2 size={22} />
            🏭 Depo Vratimov
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Moravskoslezský kraj</p>
        </div>
        <div className="p-6 space-y-6">
          
          {/* Alzaboxy z depa - Direct trasy */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Package size={18} style={{ color: 'var(--color-purple)' }} />
              Alzaboxy z depa (Direct trasy)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PriceSection title="FIX za trasu" color="var(--color-purple)">
                <PriceRow label="DIRECT Praha (DPO)" value="3 200 Kč" color="var(--color-purple)" dodatek={7} />
                <PriceRow label="DIRECT Vratimov (DPO)" value="2 500 Kč" color="var(--color-purple)" dodatek={7} />
                <PriceRow label="DIRECT SD (odpolední)" value="1 800 Kč" color="var(--color-purple)" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="Variabilní náklady" color="var(--color-purple)">
                <PriceRow label="Kč/km" value="10,97 Kč" color="var(--color-purple)" dodatek={7} />
                <PriceRow label="Hodinová sazba DEPO" value="850 Kč" color="var(--color-purple)" dodatek={7} />
              </PriceSection>
              
              <PriceSection title="POSILY (příplatek)" color="var(--color-purple)">
                <PriceRow label="Sólo (18-21 pal)" value="16 500 Kč" color="var(--color-purple)" dodatek={9} />
                <PriceRow label="Dodávka (8-10 pal)" value="10 100 Kč" color="var(--color-purple)" dodatek={9} />
              </PriceSection>
            </div>
          </div>

          {/* Alzaboxy z CZLC4 a CZTC1 (Linehauly do Vratimova) */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Truck size={18} style={{ color: 'var(--color-purple)' }} />
              Alzaboxy z CZLC4 a CZTC1 (svozy do Vratimova)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceSection title="CZLC4 (Log. centrum) → Vratimov" color="var(--color-purple)">
                <PriceRow label="Kamion (33 pal)" value="24 180 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Solo (18-21 pal)" value="16 500 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Dodávka (8-10 pal)" value="10 100 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Dodávka 6 300" value="6 300 Kč" color="var(--color-purple)" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="CZTC1 (Třídírna) → Vratimov" color="var(--color-purple)">
                <PriceRow label="Kamion (33 pal)" value="22 000 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Solo (15-18 pal)" value="14 800 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Dodávka (8-10 pal)" value="9 100 Kč" color="var(--color-purple)" dodatek={8} />
                <PriceRow label="Dodávka 6 300" value="6 300 Kč" color="var(--color-purple)" dodatek={12} />
              </PriceSection>
            </div>
          </div>

          {/* Nájem Depa Vratimov */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Warehouse size={18} style={{ color: 'var(--color-purple)' }} />
              Nájem Depa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceSection title="Provoz depa" color="var(--color-purple)">
                <PriceRow label="Depo Vratimov / den" value="5 950 Kč" color="var(--color-purple)" dodatek="?" />
              </PriceSection>
            </div>
          </div>

        </div>
      </div>

      {/* ====== DEPO NOVÝ BYDŽOV ====== */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-cyan-light)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0891b2' }}>
            <Building2 size={22} />
            🏭 Depo Nový Bydžov
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Královéhradecký kraj (od 1.10.2025)</p>
        </div>
        <div className="p-6 space-y-6">
          
          {/* Alzaboxy z depa NB */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Package size={18} style={{ color: '#0891b2' }} />
              Alzaboxy z depa (Direct trasy)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceSection title="FIX za trasu" color="#0891b2">
                <PriceRow label="DIRECT DPO" value="2 500 Kč" color="#0891b2" dodatek={12} />
                <PriceRow label="DIRECT SD" value="1 800 Kč" color="#0891b2" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="Variabilní náklady" color="#0891b2">
                <PriceRow label="Kč/km" value="10,97 Kč" color="#0891b2" dodatek={12} />
              </PriceSection>
            </div>
          </div>

          {/* Linehauly do NB */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Truck size={18} style={{ color: '#0891b2' }} />
              Linehauly do Nového Bydžova
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PriceSection title="Kamion (33 pal)" color="#0891b2">
                <PriceRow label="CZLC4 → NB" value="9 950 Kč" color="#0891b2" dodatek={12} />
                <PriceRow label="CZTC1 → NB" value="9 500 Kč" color="#0891b2" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="Sólo (18-21 pal)" color="#0891b2">
                <PriceRow label="CZLC4 → NB" value="7 750 Kč" color="#0891b2" dodatek={12} />
                <PriceRow label="CZTC1 → NB" value="7 500 Kč" color="#0891b2" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="Dodávka (8-10 pal)" color="#0891b2">
                <PriceRow label="CZLC4 → NB" value="5 250 Kč" color="#0891b2" dodatek={12} />
                <PriceRow label="CZTC1 → NB" value="5 000 Kč" color="#0891b2" dodatek={12} />
              </PriceSection>
            </div>
          </div>

          {/* Nájem Depa NB */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Warehouse size={18} style={{ color: '#0891b2' }} />
              Nájem Depa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceSection title="Sklad ALL IN" color="#0891b2">
                <PriceRow label="Základní cena" value="410 000 Kč/měs" color="#0891b2" dodatek={12} />
                <PriceRow label="Po slevě (bonusy)" value="396 000 Kč/měs" color="#0891b2" dodatek={12} />
              </PriceSection>
              
              <PriceSection title="Personál" color="#0891b2">
                <PriceRow label="4× skladník" value="194 800 Kč/měs" color="#0891b2" dodatek={12} />
              </PriceSection>
            </div>
            
            {/* Bonus System */}
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-green-light)', border: '1px solid var(--color-green)' }}>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-green)' }}>
                💰 Bonusový systém (kvalita doručení)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { quality: '≥ 98%', total: '445 600' },
                  { quality: '97,51-97,99%', total: '445 600' },
                  { quality: '97,01-97,50%', total: '436 700' },
                  { quality: '96,51-97,00%', total: '427 800' },
                  { quality: '96,01-96,50%', total: '418 900' },
                  { quality: '< 96%', total: '410 000' }
                ].map((b, idx) => (
                  <div key={idx} className="p-3 rounded-lg text-center" style={{ backgroundColor: 'white' }}>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{b.quality}</div>
                    <div className="font-semibold" style={{ color: 'var(--color-green)' }}>{b.total} Kč</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ====== EXTRA SLUŽBY ====== */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-red-light)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-red)' }}>
            <Package size={22} />
            📦 Extra služby
          </h2>
        </div>
        <div className="p-6 space-y-6">
          
          {/* AlzaTrade 2.0 svozy (DROP 2.0) */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
              <Truck size={18} style={{ color: 'var(--color-red)' }} />
              AlzaTrade 2.0 svozy (DROP 2.0)
              <span className="text-xs font-normal px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>
                od 1.11.2025
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <PriceRow label="Trasa A-I" value="8 500 Kč" color="var(--color-red)" dodatek={13} />
              <PriceRow label="Dopoledne" value="8 500 Kč" color="var(--color-red)" dodatek={13} />
              <PriceRow label="Posila C, D, H" value="11 600 Kč" color="var(--color-red)" dodatek={13} />
              <PriceRow label="Sobotní trasa" value="8 500 Kč" color="var(--color-red)" dodatek={13} />
            </div>
          </div>

        </div>
      </div>

      {/* ====== LEGENDA ====== */}
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
        </div>
      </div>

      {/* ====== SEZNAM SMLUV ====== */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <FileText size={22} />
            Historie dodatků ke smlouvě
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {contractHistory.map(d => (
              <div key={d.id} className="grid grid-cols-[100px_100px_1fr] gap-4 p-3 rounded-lg items-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>Dodatek {d.id}</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>od {d.from}</span>
                <span className="text-sm" style={{ color: 'var(--color-text-dark)' }}>{d.type}: {d.changes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
