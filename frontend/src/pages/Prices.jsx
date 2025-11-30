import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { DollarSign, FileText, AlertTriangle } from 'lucide-react'
import { prices, contracts } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Správa ceníků</h1>
          <p className="text-gray-400 text-sm mt-1">Drivecool – přehled sazeb ze smluv</p>
        </div>
        <button className="btn btn-primary">
          + Nový ceník
        </button>
      </div>

      {/* Contract History */}
      <div className="card p-6 border-cyan-500/20 bg-cyan-500/5">
        <h3 className="font-semibold text-cyan-400 mb-4 flex items-center gap-2">
          <FileText size={20} />
          Historie dodatků ke smlouvě
        </h3>
        <div className="space-y-2">
          {contractHistory.map(d => (
            <div key={d.id} className="grid grid-cols-[90px_100px_1fr] gap-4 p-3 bg-black/20 rounded-lg items-center">
              <span className="font-semibold text-cyan-400">Dodatek {d.id}</span>
              <span className="text-gray-400 text-sm">od {d.from}</span>
              <span className="text-sm">{d.type}: {d.changes}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AlzaBox Prices */}
      <div className="card overflow-hidden">
        <div className="card-header bg-orange-500/10">
          <h3 className="font-semibold text-orange-400">🚚 Ceník AlzaBox (Dodatek č. 9, platný od 1.7.2025)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">FIX za trasu</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>DIRECT Praha</span>
                  <span className="font-semibold text-cyan-400">3 200 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>DIRECT Vratimov</span>
                  <span className="font-semibold text-cyan-400">2 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Km a Depo</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Kč/km</span>
                  <span className="font-semibold text-cyan-400">10,97 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Hodinová sazba DEPO</span>
                  <span className="font-semibold text-cyan-400">850 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Linehaul CZLC4 → Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Kamion</span>
                  <span className="font-semibold text-cyan-400">24 180 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">POSILY</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Linehaul POSILA</span>
                  <span className="font-semibold text-cyan-400">24 180 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Sólo (18-21 pal)</span>
                  <span className="font-semibold text-cyan-400">16 500 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-cyan-400">10 100 Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tridirna Prices */}
      <div className="card overflow-hidden">
        <div className="card-header bg-purple-500/10">
          <h3 className="font-semibold text-purple-400">🏭 Ceník Třídírna (Dodatek č. 8, platný od 1.6.2025)</h3>
          <p className="text-sm text-gray-400 mt-1">Svozy z expedičních skladů (CZTC1 Třídírna, CZLC4 Log. centrum) na DEPO Vratimov</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">CZTC1 (Třídírna) → DEPO Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-purple-400">9 100 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Solo (15-18 pal)</span>
                  <span className="font-semibold text-purple-400">14 800 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Kamion (33 pal)</span>
                  <span className="font-semibold text-purple-400">22 000 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">CZLC4 (Log. centrum) → DEPO Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-purple-400">10 100 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Solo (18-21 pal)</span>
                  <span className="font-semibold text-purple-400">16 500 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Kamion (33 pal)</span>
                  <span className="font-semibold text-purple-400">24 180 Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Novy Bydzov Prices */}
      <div className="card overflow-hidden">
        <div className="card-header bg-green-500/10">
          <h3 className="font-semibold text-green-400">🏭 Depo Nový Bydžov (Dodatek č. 12, platný od 1.10.2025)</h3>
          <p className="text-sm text-gray-400 mt-1">Sklad ALL IN + Linehaul do Nového Bydžova + Bonusový systém</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Sklad Nový Bydžov</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Sklad ALL IN</span>
                  <span className="font-semibold text-green-400">410 000 Kč/měs</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>Po slevě</span>
                  <span className="font-semibold text-green-400">396 000 Kč/měs</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>4x skladník</span>
                  <span className="font-semibold text-green-400">194 800 Kč/měs</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Linehaul → NB (Kamion)</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCU → NB</span>
                  <span className="font-semibold text-green-400">9 950 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-green-400">9 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Linehaul → NB (Sólo)</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCU → NB</span>
                  <span className="font-semibold text-green-400">7 750 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-green-400">7 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-400 mb-3 font-medium">Linehaul → NB (Dodávka)</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCU → NB</span>
                  <span className="font-semibold text-green-400">5 250 Kč</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-lg">
                  <span>LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-green-400">5 000 Kč</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus System */}
          <div className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
            <h4 className="text-sm text-green-400 font-semibold mb-3">💰 Bonusový systém (kvalita doručení)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { quality: '≥ 98%', total: '445 600' },
                { quality: '97,51-97,99%', total: '445 600' },
                { quality: '97,01-97,50%', total: '436 700' },
                { quality: '96,51-97,00%', total: '427 800' },
                { quality: '96,01-96,50%', total: '418 900' },
                { quality: '< 96%', total: '410 000' }
              ].map((b, idx) => (
                <div key={idx} className="p-3 bg-black/20 rounded-lg text-center">
                  <div className="text-xs text-gray-400">{b.quality}</div>
                  <div className="font-semibold text-green-400">{b.total} Kč</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DROP 2.0 */}
      <div className="card overflow-hidden">
        <div className="card-header bg-red-500/10">
          <h3 className="font-semibold text-red-400">📦 Ceník DROP 2.0 (Dodatek č. 13, platný od 1.11.2025)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Trasa A-I', value: '8 500 Kč' },
              { name: 'Dopoledne', value: '8 500 Kč' },
              { name: 'Posila C, D, H', value: '11 600 Kč' },
              { name: 'Sobotní trasa', value: '8 500 Kč' }
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between p-3 bg-black/20 rounded-lg">
                <span>{item.name}</span>
                <span className="font-semibold text-red-400">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Missing Rates */}
      <div className="card p-6 border-yellow-500/30 bg-yellow-500/5">
        <h3 className="font-semibold text-yellow-400 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          Položky z proofu CHYBĚJÍCÍ ve smlouvách
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Tyto sazby jsou použity v proofech, ale nejsou definovány v dodatcích:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {missingRates.map((item, idx) => (
            <div key={idx} className="flex justify-between p-3 bg-black/20 rounded-lg">
              <span>{item.name}</span>
              <span className="font-medium text-yellow-400">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
