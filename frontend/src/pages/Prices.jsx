import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { DollarSign, FileText, AlertTriangle } from 'lucide-react'
import { prices, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function PriceCard({ title, color, items }) {
  const colorMap = {
    orange: { bg: 'var(--color-orange-light)', fg: '#e67e22', border: 'var(--color-orange)' },
    purple: { bg: 'var(--color-purple-light)', fg: 'var(--color-purple)', border: 'var(--color-purple)' },
    green: { bg: 'var(--color-green-light)', fg: 'var(--color-green)', border: 'var(--color-green)' },
    red: { bg: 'var(--color-red-light)', fg: 'var(--color-red)', border: 'var(--color-red)' },
    cyan: { bg: 'var(--color-cyan-light)', fg: '#0891b2', border: 'var(--color-cyan)' },
  }
  const c = colorMap[color] || colorMap.orange

  return (
    <div>
      <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>{title}</h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
            <span style={{ color: 'var(--color-text)' }}>{item.name}</span>
            <span className="font-semibold" style={{ color: c.fg }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Prices() {
  const { selectedCarrierId } = useCarrier()

  const { data: contractList } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })

  const { data: priceList } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => prices.getAll({ carrier_id: selectedCarrierId, active: 'true' }),
    enabled: !!selectedCarrierId
  })

  // Static data from contracts (will be dynamic when DB is populated)
  const contractHistory = [
    { id: 13, from: '1.11.2025', type: 'DROP 2.0', changes: 'Nový ceník DROP 2.0 (trasy A-I: 8 500 Kč)' },
    { id: 12, from: '1.10.2025', type: 'AlzaBox + XL + NB', changes: 'Depo Nový Bydžov, Linehaul do NB, Bonusový systém' },
    { id: 9, from: '1.7.2025', type: 'AlzaBox', changes: 'Přidány POSILY (Linehaul, Sólo, Dodávka)' },
    { id: 8, from: '1.6.2025', type: 'Třídírna', changes: 'Svozy CZTC1/CZLC4 → Vratimov' },
    { id: 7, from: '1.4.2025', type: 'AlzaBox', changes: 'FIX Direct Praha/Vratimov, Kč/km, Linehaul' }
  ]

  const missingRates = [
    { name: 'FIX LH SD (druhý závoz)', value: '1 800 Kč' },
    { name: 'Depo Vratimov / den', value: '5 950 Kč' },
    { name: 'Dodávka 6 300 (Vratimov)', value: '6 300 Kč' },
    { name: 'Vratky', value: '3 700 Kč' }
  ]

  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Správa ceníků</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Přehled sazeb ze smluv</p>
        </div>
        <div className="card p-8 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-orange)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>Vyberte dopravce</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pro zobrazení ceníků vyberte dopravce v horním menu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Správa ceníků</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Drivecool — přehled sazeb ze smluv</p>
        </div>
        <button className="btn btn-primary">
          + Nový ceník
        </button>
      </div>

      {/* Contract History */}
      <div className="card" style={{ borderColor: '#0891b230', backgroundColor: 'var(--color-cyan-light)' }}>
        <div className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#0891b2' }}>
            <FileText size={20} />
            Historie dodatků ke smlouvě
          </h3>
          <div className="space-y-2">
            {contractHistory.map(d => (
              <div key={d.id} className="grid grid-cols-[90px_100px_1fr] gap-4 p-3 rounded-lg items-center" style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <span className="font-semibold" style={{ color: '#0891b2' }}>Dodatek {d.id}</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>od {d.from}</span>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{d.type}: {d.changes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AlzaBox Prices */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-orange-light)' }}>
          <h3 className="font-semibold" style={{ color: '#e67e22' }}>🚚 Ceník AlzaBox (Dodatek č. 9, platný od 1.7.2025)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PriceCard 
              title="FIX za trasu" 
              color="orange"
              items={[
                { name: 'DIRECT Praha', value: '3 200 Kč' },
                { name: 'DIRECT Vratimov', value: '2 500 Kč' },
              ]}
            />
            
            <PriceCard 
              title="Km a Depo" 
              color="orange"
              items={[
                { name: 'Kč/km', value: '10,97 Kč' },
                { name: 'Hodinová sazba DEPO', value: '850 Kč' },
              ]}
            />
            
            <PriceCard 
              title="Linehaul CZLC4 → Vratimov" 
              color="orange"
              items={[
                { name: 'Kamion', value: '24 180 Kč' },
              ]}
            />
            
            <PriceCard 
              title="POSILY" 
              color="orange"
              items={[
                { name: 'Linehaul POSILA', value: '24 180 Kč' },
                { name: 'Sólo (18-21 pal)', value: '16 500 Kč' },
                { name: 'Dodávka (8-10 pal)', value: '10 100 Kč' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tridirna Prices */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-purple-light)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-purple)' }}>🏭 Ceník Třídírna (Dodatek č. 8, platný od 1.6.2025)</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Svozy z expedičních skladů (CZTC1 Třídírna, CZLC4 Log. centrum) na DEPO Vratimov</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PriceCard 
              title="CZTC1 (Třídírna) → DEPO Vratimov" 
              color="purple"
              items={[
                { name: 'Dodávka (8-10 pal)', value: '9 100 Kč' },
                { name: 'Solo (15-18 pal)', value: '14 800 Kč' },
                { name: 'Kamion (33 pal)', value: '22 000 Kč' },
              ]}
            />
            
            <PriceCard 
              title="CZLC4 (Log. centrum) → DEPO Vratimov" 
              color="purple"
              items={[
                { name: 'Dodávka (8-10 pal)', value: '10 100 Kč' },
                { name: 'Solo (18-21 pal)', value: '16 500 Kč' },
                { name: 'Kamion (33 pal)', value: '24 180 Kč' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Novy Bydzov Prices */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-green-light)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-green)' }}>🏭 Depo Nový Bydžov (Dodatek č. 12, platný od 1.10.2025)</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Sklad ALL IN + Linehaul do Nového Bydžova + Bonusový systém</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PriceCard 
              title="Sklad Nový Bydžov" 
              color="green"
              items={[
                { name: 'Sklad ALL IN', value: '410 000 Kč/měs' },
                { name: 'Po slevě', value: '396 000 Kč/měs' },
                { name: '4x skladník', value: '194 800 Kč/měs' },
              ]}
            />
            
            <PriceCard 
              title="Linehaul → NB (Kamion)" 
              color="green"
              items={[
                { name: 'LCU → NB', value: '9 950 Kč' },
                { name: 'LCZ/CZTC1 → NB', value: '9 500 Kč' },
              ]}
            />
            
            <PriceCard 
              title="Linehaul → NB (Sólo)" 
              color="green"
              items={[
                { name: 'LCU → NB', value: '7 750 Kč' },
                { name: 'LCZ/CZTC1 → NB', value: '7 500 Kč' },
              ]}
            />
            
            <PriceCard 
              title="Linehaul → NB (Dodávka)" 
              color="green"
              items={[
                { name: 'LCU → NB', value: '5 250 Kč' },
                { name: 'LCZ/CZTC1 → NB', value: '5 000 Kč' },
              ]}
            />
          </div>

          {/* Bonus System */}
          <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-green-light)', border: '1px solid var(--color-green)30' }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-green)' }}>💰 Bonusový systém (kvalita doručení)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { quality: '≥ 98%', total: '445 600' },
                { quality: '97,51-97,99%', total: '445 600' },
                { quality: '97,01-97,50%', total: '436 700' },
                { quality: '96,51-97,00%', total: '427 800' },
                { quality: '96,01-96,50%', total: '418 900' },
                { quality: '< 96%', total: '410 000' }
              ].map((b, idx) => (
                <div key={idx} className="p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{b.quality}</div>
                  <div className="font-semibold" style={{ color: 'var(--color-green)' }}>{b.total} Kč</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DROP 2.0 */}
      <div className="card">
        <div className="card-header" style={{ backgroundColor: 'var(--color-red-light)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-red)' }}>📦 Ceník DROP 2.0 (Dodatek č. 13, platný od 1.11.2025)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Trasa A-I', value: '8 500 Kč' },
              { name: 'Dopoledne', value: '8 500 Kč' },
              { name: 'Posila C, D, H', value: '11 600 Kč' },
              { name: 'Sobotní trasa', value: '8 500 Kč' }
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span style={{ color: 'var(--color-text)' }}>{item.name}</span>
                <span className="font-semibold" style={{ color: 'var(--color-red)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Missing Rates */}
      <div className="card" style={{ borderColor: '#e67e2230', backgroundColor: 'var(--color-orange-light)' }}>
        <div className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#e67e22' }}>
            <AlertTriangle size={20} />
            Položky z proofu CHYBĚJÍCÍ ve smlouvách
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Tyto sazby jsou použity v proofech, ale nejsou definovány v dodatcích:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {missingRates.map((item, idx) => (
              <div key={idx} className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: 'var(--color-text)' }}>{item.name}</span>
                <span className="font-medium" style={{ color: '#e67e22' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
