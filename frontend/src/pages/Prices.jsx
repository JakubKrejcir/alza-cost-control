import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  DollarSign, 
  FileText, 
  AlertTriangle,
  Plus,
  Calendar,
  Truck,
  ArrowRight,
  Package,
  MapPin,
  Sparkles
} from 'lucide-react'
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

  // Static data from contracts
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Správa ceníků</h1>
          <p className="text-gray-500 text-sm mt-1">Drivecool – přehled sazeb ze smluv</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} />
          Nový ceník
        </button>
      </div>

      {/* Contract History */}
      <div className="widget border-l-4 border-l-blue-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="widget-title">Historie dodatků ke smlouvě</h3>
              <p className="widget-subtitle">Chronologický přehled změn</p>
            </div>
          </div>
        </div>
        <div className="widget-body space-y-2">
          {contractHistory.map(d => (
            <div key={d.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 font-bold text-sm">
                #{d.id}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Dodatek {d.id}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar size={14} />
                    od {d.from}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="badge badge-info mr-2">{d.type}</span>
                  {d.changes}
                </p>
              </div>
              <ArrowRight size={18} className="text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* AlzaBox Prices */}
      <div className="widget border-l-4 border-l-orange-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Package size={16} className="text-orange-600" />
            </div>
            <div>
              <h3 className="widget-title">Ceník AlzaBox</h3>
              <p className="widget-subtitle">Dodatek č. 9, platný od 1.7.2025</p>
            </div>
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">FIX za trasu</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">DIRECT Praha</span>
                  <span className="font-semibold text-blue-600">3 200 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">DIRECT Vratimov</span>
                  <span className="font-semibold text-blue-600">2 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Km a Depo</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Kč/km</span>
                  <span className="font-semibold text-emerald-600">10,97 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Hodinová sazba DEPO</span>
                  <span className="font-semibold text-emerald-600">850 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Linehaul CZLC4 → Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Kamion</span>
                  <span className="font-semibold text-violet-600">24 180 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">POSILY</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Linehaul POSILA</span>
                  <span className="font-semibold text-amber-600">24 180 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Sólo (18-21 pal)</span>
                  <span className="font-semibold text-amber-600">16 500 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-amber-600">10 100 Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tridirna Prices */}
      <div className="widget border-l-4 border-l-violet-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <MapPin size={16} className="text-violet-600" />
            </div>
            <div>
              <h3 className="widget-title">Ceník Třídírna</h3>
              <p className="widget-subtitle">Dodatek č. 8, platný od 1.6.2025 — Svozy na DEPO Vratimov</p>
            </div>
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">CZTC1 (Třídírna) → DEPO Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-violet-600">9 100 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Solo (15-18 pal)</span>
                  <span className="font-semibold text-violet-600">14 800 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Kamion (33 pal)</span>
                  <span className="font-semibold text-violet-600">22 000 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">CZLC4 (Log. centrum) → DEPO Vratimov</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Dodávka (8-10 pal)</span>
                  <span className="font-semibold text-violet-600">10 100 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Solo (18-21 pal)</span>
                  <span className="font-semibold text-violet-600">16 500 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Kamion (33 pal)</span>
                  <span className="font-semibold text-violet-600">24 180 Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Novy Bydzov Prices */}
      <div className="widget border-l-4 border-l-emerald-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Sparkles size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="widget-title">Depo Nový Bydžov</h3>
              <p className="widget-subtitle">Dodatek č. 12, platný od 1.10.2025</p>
            </div>
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Sklad Nový Bydžov</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Sklad ALL IN</span>
                  <span className="font-semibold text-emerald-600">410 000 Kč/měs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">Po slevě</span>
                  <span className="font-semibold text-emerald-600">396 000 Kč/měs</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">4x skladník</span>
                  <span className="font-semibold text-emerald-600">194 800 Kč/měs</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Linehaul → NB (Kamion)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCU → NB</span>
                  <span className="font-semibold text-emerald-600">9 950 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-emerald-600">9 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Linehaul → NB (Sólo)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCU → NB</span>
                  <span className="font-semibold text-emerald-600">7 750 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-emerald-600">7 500 Kč</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm text-gray-500 mb-3 font-medium">Linehaul → NB (Dodávka)</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCU → NB</span>
                  <span className="font-semibold text-emerald-600">5 250 Kč</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700">LCZ/CZTC1 → NB</span>
                  <span className="font-semibold text-emerald-600">5 000 Kč</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus System */}
          <div className="mt-6 p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
            <h4 className="text-sm text-emerald-700 font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={16} />
              Bonusový systém (kvalita doručení)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { quality: '≥ 98%', total: '445 600' },
                { quality: '97,51-97,99%', total: '445 600' },
                { quality: '97,01-97,50%', total: '436 700' },
                { quality: '96,51-97,00%', total: '427 800' },
                { quality: '96,01-96,50%', total: '418 900' },
                { quality: '< 96%', total: '410 000' }
              ].map((b, idx) => (
                <div key={idx} className="p-3 bg-white rounded-xl text-center shadow-sm">
                  <div className="text-xs text-gray-500">{b.quality}</div>
                  <div className="font-bold text-emerald-600 mt-1">{b.total} Kč</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DROP 2.0 */}
      <div className="widget border-l-4 border-l-rose-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <Truck size={16} className="text-rose-600" />
            </div>
            <div>
              <h3 className="widget-title">Ceník DROP 2.0</h3>
              <p className="widget-subtitle">Dodatek č. 13, platný od 1.11.2025</p>
            </div>
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Trasa A-I', value: '8 500 Kč' },
              { name: 'Dopoledne', value: '8 500 Kč' },
              { name: 'Posila C, D, H', value: '11 600 Kč' },
              { name: 'Sobotní trasa', value: '8 500 Kč' }
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-700">{item.name}</span>
                <span className="font-semibold text-rose-600">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Missing Rates */}
      <div className="widget border-l-4 border-l-amber-500">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="widget-title">Chybějící sazby</h3>
              <p className="widget-subtitle">Položky z proofu nenalezené ve smlouvách</p>
            </div>
          </div>
        </div>
        <div className="widget-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {missingRates.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-gray-700">{item.name}</span>
                <span className="font-semibold text-amber-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
