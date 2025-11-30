import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  Map, 
  Calendar, 
  Truck, 
  CheckCircle, 
  AlertTriangle,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react'
import { routePlans, carriers, proofs } from '../lib/api'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return format(new Date(dateStr), 'd. M. yyyy', { locale: cs })
}

function getPeriodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    options.push(format(date, 'MM/yyyy'))
  }
  return options
}

export default function RoutePlans() {
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [comparison, setComparison] = useState(null)
  
  const queryClient = useQueryClient()

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrier, selectedPeriod],
    queryFn: () => routePlans.getAll({ 
      carrier_id: selectedCarrier,
      period: selectedPeriod
    }),
    enabled: !!selectedCarrier
  })

  const { data: proofList } = useQuery({
    queryKey: ['proofs', selectedCarrier, selectedPeriod],
    queryFn: () => proofs.getAll({ 
      carrier_id: selectedCarrier,
      period: selectedPeriod
    }),
    enabled: !!selectedCarrier
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, carrierId }) => routePlans.upload(file, carrierId),
    onSuccess: (data) => {
      setUploadResult({ success: true, data: data.data, message: data.message })
      queryClient.invalidateQueries(['route-plans'])
    },
    onError: (error) => {
      setUploadResult({ 
        success: false, 
        message: error.response?.data?.detail || 'Chyba při nahrávání' 
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => routePlans.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['route-plans'])
      setExpandedPlan(null)
    }
  })

  const compareMutation = useMutation({
    mutationFn: ({ planId, proofId }) => routePlans.compare(planId, proofId),
    onSuccess: (data) => {
      setComparison(data)
    }
  })

  const handleFiles = useCallback((files) => {
    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }

    const file = files[0]
    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setUploadResult({ success: false, message: 'Pouze XLSX soubory jsou podporovány' })
      return
    }

    setUploadResult(null)
    uploadMutation.mutate({ file, carrierId: selectedCarrier })
  }, [selectedCarrier, uploadMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleCompare = (planId) => {
    const proof = proofList?.[0]
    if (!proof) {
      alert('Není k dispozici proof pro porovnání')
      return
    }
    compareMutation.mutate({ planId, proofId: proof.id })
  }

  const currentProof = proofList?.[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Plánování tras</h1>
        <p className="text-gray-400 text-sm mt-1">Nahrávání a porovnání plánovacích souborů s proofy</p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dopravce</label>
            <select
              value={selectedCarrier}
              onChange={(e) => {
                setSelectedCarrier(e.target.value)
                setComparison(null)
              }}
              className="input"
            >
              <option value="">Vyberte dopravce...</option>
              {carrierList?.map(carrier => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Období</label>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value)
                setComparison(null)
              }}
              className="input"
            >
              {getPeriodOptions().map(period => (
                <option key={period} value={period}>
                  {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`card p-8 border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-alza-orange bg-alza-orange/5' 
            : 'border-white/20 hover:border-white/40'
        } ${!selectedCarrier ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="text-center">
          <Map className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-alza-orange' : 'text-gray-500'}`} />
          
          <p className="text-lg font-medium mb-2">
            {uploadMutation.isPending ? 'Nahrávám...' : 'Přetáhněte plánovací soubor (XLSX)'}
          </p>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="plan-file-input"
            disabled={!selectedCarrier || uploadMutation.isPending}
          />
          <label
            htmlFor="plan-file-input"
            className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${
              (!selectedCarrier || uploadMutation.isPending) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat soubor
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`card p-4 ${uploadResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={uploadResult.success ? 'text-green-400' : 'text-red-400'}>
                {uploadResult.message}
              </p>
              {uploadResult.success && uploadResult.data && (
                <div className="mt-2 text-sm text-gray-400">
                  Platnost: {formatDate(uploadResult.data.validFrom)} 
                  {uploadResult.data.validTo && ` → ${formatDate(uploadResult.data.validTo)}`}
                  {' | '}
                  {uploadResult.data.totalRoutes} tras ({uploadResult.data.dpoRoutesCount} DPO, {uploadResult.data.sdRoutesCount} SD)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      {selectedCarrier && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Plánovací soubory — {selectedPeriod}</h2>
            <span className="badge badge-info">{planList?.length || 0} plánů</span>
          </div>

          {loadingPlans ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plány pro toto období</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {planList.map(plan => (
                <div key={plan.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {formatDate(plan.validFrom)}
                          {plan.validTo && (
                            <span className="text-gray-400"> → {formatDate(plan.validTo)}</span>
                          )}
                          {!plan.validTo && (
                            <span className="text-green-400 ml-2 text-sm">aktivní</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {plan.fileName}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="text-gray-300">{plan.totalRoutes} tras</div>
                        <div className="text-gray-500">
                          {plan.dpoRoutesCount} DPO / {plan.sdRoutesCount} SD
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCompare(plan.id)}
                          disabled={!currentProof || compareMutation.isPending}
                          className="btn btn-secondary text-sm"
                        >
                          Porovnat s proof
                        </button>
                        <button
                          onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                          className="p-2 rounded-lg hover:bg-white/5"
                        >
                          {expandedPlan === plan.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Opravdu smazat tento plán?')) {
                              deleteMutation.mutate(plan.id)
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedPlan === plan.id && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">DPO trasy:</span>
                          <span className="ml-2 font-medium">{plan.dpoRoutesCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">SD trasy:</span>
                          <span className="ml-2 font-medium">{plan.sdRoutesCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">DPO Linehauly:</span>
                          <span className="ml-2 font-medium">{plan.dpoLinehaulCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">SD Linehauly:</span>
                          <span className="ml-2 font-medium">{plan.sdLinehaulCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Celkem km:</span>
                          <span className="ml-2 font-medium">{plan.totalDistanceKm?.toLocaleString('cs-CZ')} km</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Celkem zastávek:</span>
                          <span className="ml-2 font-medium">{plan.totalStops}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="card overflow-hidden">
          <div className="card-header bg-purple-500/10">
            <h2 className="font-semibold text-purple-400">📊 Porovnání: Plán vs. Proof</h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <h3 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                  <Map size={18} />
                  Plán
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">DPO trasy:</span>
                    <span className="font-medium">{comparison.plan.dpoRoutesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD trasy:</span>
                    <span className="font-medium">{comparison.plan.sdRoutesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Linehauly (DPO+SD):</span>
                    <span className="font-medium">{comparison.plan.dpoLinehaulCount + comparison.plan.sdLinehaulCount}</span>
                  </div>
                </div>
              </div>

              {/* Proof */}
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                <h3 className="font-medium text-green-400 mb-3 flex items-center gap-2">
                  <Truck size={18} />
                  Proof (skutečnost)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">DPO trasy:</span>
                    <span className="font-medium">{comparison.proof.dpoRoutesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD trasy:</span>
                    <span className="font-medium">{comparison.proof.sdRoutesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD spojené:</span>
                    <span className="font-medium">{comparison.proof.sdSpojenCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Linehauly:</span>
                    <span className="font-medium">{comparison.proof.linehaulCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Differences */}
            {comparison.differences.length > 0 && (
              <div>
                <h3 className="font-medium text-yellow-400 mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Rozdíly
                </h3>
                <div className="space-y-2">
                  {comparison.differences.map((diff, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <span className="text-gray-300">{diff.label}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{diff.planned}</span>
                        <ArrowRight size={16} className="text-gray-500" />
                        <span className="font-medium">{diff.actual}</span>
                        <span className={`font-medium ${diff.diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({diff.diff > 0 ? '+' : ''}{diff.diff})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {comparison.warnings.length > 0 && (
              <div>
                <h3 className="font-medium text-orange-400 mb-3">Upozornění</h3>
                <div className="space-y-2">
                  {comparison.warnings.map((warn, idx) => (
                    <div key={idx} className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg text-sm">
                      {warn.note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            {comparison.differences.length === 0 && comparison.warnings.length === 0 && (
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Plán odpovídá proofu</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card p-6 bg-blue-500/5 border-blue-500/20">
        <h3 className="font-semibold text-blue-400 mb-3">💡 Jak to funguje</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• Nahrajte XLSX soubor s plánováním tras (datum se extrahuje z názvu souboru)</li>
          <li>• Systém automaticky rozpozná DPO (ranní) a SD (odpolední) trasy podle času začátku</li>
          <li>• Porovnání s proofem ukáže rozdíly v počtu tras, linehaulů a spojených trasách</li>
          <li>• Pro jeden měsíc může být více plánů – platnost se nastaví automaticky</li>
        </ul>
      </div>
    </div>
  )
}
