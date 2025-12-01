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
  ArrowRight,
  FileSpreadsheet,
  BarChart3,
  Square,
  CheckSquare,
  MinusSquare
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

function PlanTypeBadge({ type }) {
  const colors = {
    'BOTH': 'bg-purple-500/20 text-purple-400',
    'DPO': 'bg-blue-500/20 text-blue-400',
    'SD': 'bg-orange-500/20 text-orange-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors.BOTH}`}>
      {type || 'BOTH'}
    </span>
  )
}

export default function RoutePlans() {
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [selectedProofPeriod, setSelectedProofPeriod] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [periodComparison, setPeriodComparison] = useState(null)
  const [selectedPlans, setSelectedPlans] = useState(new Set())
  
  const queryClient = useQueryClient()

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Plány - všechny pro dopravce, bez filtru období
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrier],
    queryFn: () => routePlans.getAll({ 
      carrier_id: selectedCarrier
    }),
    enabled: !!selectedCarrier
  })

  // Proofy - všechny pro dopravce (pro výběr k porovnání)
  const { data: proofList } = useQuery({
    queryKey: ['proofs', selectedCarrier],
    queryFn: () => proofs.getAll({ 
      carrier_id: selectedCarrier
    }),
    enabled: !!selectedCarrier
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, carrierId }) => routePlans.upload(file, carrierId),
    onSuccess: (data) => {
      setUploadResult({ success: true, data: data.data, message: data.message })
      queryClient.invalidateQueries(['route-plans'])
      setPeriodComparison(null)
    },
    onError: (error) => {
      setUploadResult({ 
        success: false, 
        message: error.response?.data?.detail || 'Chyba při nahrávání' 
      })
    }
  })

  const uploadBatchMutation = useMutation({
    mutationFn: ({ files, carrierId }) => routePlans.uploadBatch(files, carrierId),
    onSuccess: (data) => {
      setUploadResult({ 
        success: data.success, 
        message: data.message,
        uploaded: data.uploaded,
        errors: data.errors
      })
      queryClient.invalidateQueries(['route-plans'])
      setPeriodComparison(null)
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
      setPeriodComparison(null)
    },
    onError: (error) => {
      alert('Chyba při mazání: ' + (error.response?.data?.detail || error.message))
    }
  })

  const deleteBatchMutation = useMutation({
    mutationFn: async (ids) => {
      // Delete one by one
      for (const id of ids) {
        await routePlans.delete(id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['route-plans'])
      setSelectedPlans(new Set())
      setPeriodComparison(null)
    },
    onError: (error) => {
      alert('Chyba při mazání: ' + (error.response?.data?.detail || error.message))
    }
  })

  // Helper pro toggle výběru plánu
  const togglePlanSelection = (planId) => {
    setSelectedPlans(prev => {
      const next = new Set(prev)
      if (next.has(planId)) {
        next.delete(planId)
      } else {
        next.add(planId)
      }
      return next
    })
  }

  // Helper pro výběr všech plánů
  const toggleSelectAll = () => {
    if (!planList) return
    if (selectedPlans.size === planList.length) {
      setSelectedPlans(new Set())
    } else {
      setSelectedPlans(new Set(planList.map(p => p.id)))
    }
  }

  // Helper pro výběr plánů v roce
  const toggleSelectYear = (yearPlans) => {
    const yearPlanIds = yearPlans.map(p => p.id)
    const allSelected = yearPlanIds.every(id => selectedPlans.has(id))
    
    setSelectedPlans(prev => {
      const next = new Set(prev)
      if (allSelected) {
        yearPlanIds.forEach(id => next.delete(id))
      } else {
        yearPlanIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const handleDeleteSelected = () => {
    if (selectedPlans.size === 0) return
    if (confirm(`Opravdu smazat ${selectedPlans.size} vybraných plánů?`)) {
      deleteBatchMutation.mutate(Array.from(selectedPlans))
    }
  }

  const comparePeriodMutation = useMutation({
    mutationFn: (proofId) => routePlans.comparePeriod(proofId),
    onSuccess: (data) => {
      setPeriodComparison(data)
    }
  })

  const handleFiles = useCallback((files) => {
    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }

    const fileList = Array.from(files)
    if (fileList.length === 0) return

    // Filter only xlsx/xls files
    const validFiles = fileList.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      return ext === 'xlsx' || ext === 'xls'
    })

    if (validFiles.length === 0) {
      setUploadResult({ success: false, message: 'Pouze XLSX soubory jsou podporovány' })
      return
    }

    setUploadResult(null)
    
    if (validFiles.length === 1) {
      // Single file upload
      uploadMutation.mutate({ file: validFiles[0], carrierId: selectedCarrier })
    } else {
      // Batch upload
      uploadBatchMutation.mutate({ files: validFiles, carrierId: selectedCarrier })
    }
  }, [selectedCarrier, uploadMutation, uploadBatchMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleComparePeriod = () => {
    if (!selectedProofPeriod) {
      alert('Vyberte proof pro porovnání')
      return
    }
    const proof = proofList?.find(p => p.period === selectedProofPeriod)
    if (!proof) {
      alert('Proof nenalezen')
      return
    }
    comparePeriodMutation.mutate(proof.id)
  }

  // Seskupit plány podle roku pro přehlednost
  const groupedPlans = planList?.reduce((acc, plan) => {
    const year = plan.validFrom ? new Date(plan.validFrom).getFullYear() : 'Neznámý'
    if (!acc[year]) acc[year] = []
    acc[year].push(plan)
    return acc
  }, {}) || {}

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
                setPeriodComparison(null)
                setSelectedProofPeriod('')
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
            <label className="label">Porovnat s proofem</label>
            <div className="flex gap-2">
              <select
                value={selectedProofPeriod}
                onChange={(e) => {
                  setSelectedProofPeriod(e.target.value)
                  setPeriodComparison(null)
                }}
                className="input flex-1"
                disabled={!selectedCarrier || !proofList?.length}
              >
                <option value="">Vyberte proof...</option>
                {proofList?.map(proof => (
                  <option key={proof.id} value={proof.period}>
                    {proof.period} - {proof.fileName || 'proof'}
                  </option>
                ))}
              </select>
              <button
                onClick={handleComparePeriod}
                disabled={!selectedProofPeriod || comparePeriodMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <BarChart3 size={18} />
                {comparePeriodMutation.isPending ? '...' : 'Porovnat'}
              </button>
            </div>
          </div>
        </div>

        {/* Info o proofech */}
        {selectedCarrier && (
          <div className="mt-4 pt-4 border-t border-white/10 text-sm">
            {proofList?.length ? (
              <span className="text-gray-400">
                {proofList.length} proof{proofList.length > 1 ? 'ů' : ''} k dispozici pro porovnání
              </span>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle size={16} />
                Žádné proofy pro tohoto dopravce - nahrajte proof na stránce Upload
              </div>
            )}
          </div>
        )}
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
          <Map className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-alza-orange' : 'text-gray-400'}`} />
          <p className="text-lg mb-2">Přetáhněte plánovací XLSX soubory</p>
          <p className="text-sm text-gray-400 mb-4">nebo</p>
          <label className="btn btn-primary cursor-pointer">
            <UploadIcon className="w-4 h-4 mr-2" />
            Vybrat soubory
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-500 mt-4">
            Formát názvu: <code className="bg-white/10 px-1 rounded">Drivecool 25-08-22.xlsx</code> (YY-MM-DD)
            {' '}nebo{' '}
            <code className="bg-white/10 px-1 rounded">plan_01.12.2025.xlsx</code>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Můžete nahrát více souborů najednou
          </p>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`card p-4 ${uploadResult.success ? 'bg-green-500/10 border-green-500/30' : uploadResult.errors?.length ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
            ) : uploadResult.errors?.length ? (
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={uploadResult.success ? 'text-green-400' : uploadResult.errors?.length ? 'text-yellow-400' : 'text-red-400'}>
                {uploadResult.message}
              </p>
              
              {/* Single file result */}
              {uploadResult.data && (
                <div className="mt-2 text-sm text-gray-400">
                  <span className="mr-4">Typ: <PlanTypeBadge type={uploadResult.data.planType} /></span>
                  <span className="mr-4">DPO tras: {uploadResult.data.dpoRoutesCount}</span>
                  <span className="mr-4">SD tras: {uploadResult.data.sdRoutesCount}</span>
                  <span>Platí od: {formatDate(uploadResult.data.validFrom)}</span>
                </div>
              )}
              
              {/* Batch upload results */}
              {uploadResult.uploaded?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-400 font-medium">Úspěšně nahráno:</p>
                  {uploadResult.uploaded.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-400 flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-400" />
                      <span>{item.fileName}</span>
                      <span className="text-gray-500">→ {formatDate(item.validFrom)}</span>
                      <PlanTypeBadge type={item.planType} />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Batch upload errors */}
              {uploadResult.errors?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-red-400 font-medium">Chyby:</p>
                  {uploadResult.errors.map((item, idx) => (
                    <div key={idx} className="text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle size={14} />
                      <span>{item.fileName}:</span>
                      <span className="text-gray-400">{item.error}</span>
                    </div>
                  ))}
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
            <div className="flex items-center gap-4">
              <h2 className="font-semibold">Nahrané plány</h2>
              {planList?.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  {selectedPlans.size === planList.length ? (
                    <CheckSquare size={18} className="text-purple-400" />
                  ) : selectedPlans.size > 0 ? (
                    <MinusSquare size={18} className="text-purple-400" />
                  ) : (
                    <Square size={18} />
                  )}
                  <span>
                    {selectedPlans.size === 0 
                      ? 'Vybrat vše' 
                      : selectedPlans.size === planList.length 
                        ? 'Zrušit výběr' 
                        : `Vybráno ${selectedPlans.size}`}
                  </span>
                </button>
              )}
            </div>
            {selectedPlans.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleteBatchMutation.isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>Smazat vybrané ({selectedPlans.size})</span>
              </button>
            )}
          </div>
          
          {loadingPlans ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plány pro tohoto dopravce</p>
            </div>
          ) : (
            <div>
              {Object.entries(groupedPlans)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([year, yearPlans]) => {
                  const yearPlanIds = yearPlans.map(p => p.id)
                  const allYearSelected = yearPlanIds.every(id => selectedPlans.has(id))
                  const someYearSelected = yearPlanIds.some(id => selectedPlans.has(id))
                  
                  return (
                  <div key={year}>
                    <div className="px-4 py-2 bg-white/5 text-sm font-medium text-gray-400 flex items-center gap-3">
                      <button
                        onClick={() => toggleSelectYear(yearPlans)}
                        className="hover:text-white"
                      >
                        {allYearSelected ? (
                          <CheckSquare size={16} className="text-purple-400" />
                        ) : someYearSelected ? (
                          <MinusSquare size={16} className="text-purple-400" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                      <span>{year}</span>
                      <span className="text-xs text-gray-500">({yearPlans.length} plánů)</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {yearPlans.map(plan => (
                        <div 
                          key={plan.id} 
                          className={`p-4 ${selectedPlans.has(plan.id) ? 'bg-purple-500/5' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => togglePlanSelection(plan.id)}
                                className="hover:text-white"
                              >
                                {selectedPlans.has(plan.id) ? (
                                  <CheckSquare size={20} className="text-purple-400" />
                                ) : (
                                  <Square size={20} className="text-gray-500" />
                                )}
                              </button>
                              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {formatDate(plan.validFrom)}
                                  {plan.validTo && (
                                    <span className="text-gray-400"> → {formatDate(plan.validTo)}</span>
                                  )}
                                  {!plan.validTo && (
                                    <span className="text-green-400 text-sm">aktivní</span>
                                  )}
                                  <PlanTypeBadge type={plan.planType} />
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
                                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                                  className="p-2 rounded-lg hover:bg-white/5"
                                >
                                  {expandedPlan === plan.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm('Opravdu smazat tento plán?')) {
                                      deleteMutation.mutate(plan.id)
                                    }
                                  }}
                                  disabled={deleteMutation.isLoading}
                                  className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-50"
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
                  </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Period Comparison Results */}
      {periodComparison && (
        <div className="card overflow-hidden">
          <div className={`card-header ${
            periodComparison.status === 'ok' ? 'bg-green-500/10' :
            periodComparison.status === 'warning' ? 'bg-yellow-500/10' :
            'bg-red-500/10'
          }`}>
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart3 size={20} />
              Porovnání období {periodComparison.proof?.period}
              {periodComparison.status === 'ok' && <CheckCircle className="text-green-400" size={18} />}
              {periodComparison.status === 'warning' && <AlertTriangle className="text-yellow-400" size={18} />}
              {periodComparison.status === 'error' && <AlertCircle className="text-red-400" size={18} />}
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Plans aggregation info */}
            {periodComparison.plans && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <h3 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                  <FileSpreadsheet size={18} />
                  Agregované plány ({periodComparison.plans.plans?.length || 0})
                </h3>
                <div className="space-y-3">
                  {periodComparison.plans.plans?.map((plan, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white/5 rounded">
                      <div className="flex items-center gap-2">
                        <PlanTypeBadge type={plan.planType} />
                        <span className="text-gray-300">{plan.fileName}</span>
                      </div>
                      <div className="text-gray-400">
                        {plan.workingDays} pracovních dnů ({Math.round(plan.weight * 100)}%)
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-white/10 text-sm">
                    <span className="text-gray-400">Celkem pracovních dnů:</span>
                    <span className="font-medium">{periodComparison.plans.totalWorkingDays}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Aggregated Plan */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <h3 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                  <Map size={18} />
                  Plán (agregovaný)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">DPO trasy (celkem):</span>
                    <span className="font-medium">{periodComparison.plans?.dpoRoutesCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD trasy (celkem):</span>
                    <span className="font-medium">{periodComparison.plans?.sdRoutesCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Linehauly (celkem):</span>
                    <span className="font-medium">
                      {(periodComparison.plans?.dpoLinehaulCount || 0) + (periodComparison.plans?.sdLinehaulCount || 0)}
                    </span>
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
                    <span className="font-medium">{periodComparison.proof?.dpoRoutesCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD trasy:</span>
                    <span className="font-medium">{periodComparison.proof?.sdRoutesCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SD spojené:</span>
                    <span className="font-medium">{periodComparison.proof?.sdSpojenCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Přímé (DR):</span>
                    <span className="font-medium">{periodComparison.proof?.drCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Linehauly:</span>
                    <span className="font-medium">{periodComparison.proof?.linehaulCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Differences */}
            {periodComparison.differences?.length > 0 && (
              <div>
                <h3 className="font-medium text-yellow-400 mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Rozdíly
                </h3>
                <div className="space-y-2">
                  {periodComparison.differences.map((diff, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <div>
                        <span className="text-gray-300">{diff.label}</span>
                        <span className="text-gray-500 text-sm ml-2">{diff.note}</span>
                      </div>
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
            {periodComparison.warnings?.length > 0 && (
              <div>
                <h3 className="font-medium text-orange-400 mb-3">Upozornění</h3>
                <div className="space-y-2">
                  {periodComparison.warnings.map((warn, idx) => (
                    <div key={idx} className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span>{warn.note}</span>
                        {warn.count && <span className="font-medium">{warn.count}</span>}
                      </div>
                      {warn.dates && warn.dates.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Dny: {warn.dates.map(d => formatDate(d)).join(', ')}
                          {warn.count > 5 && <span> a další...</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All OK */}
            {periodComparison.status === 'ok' && (
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Plány odpovídají proofu</span>
              </div>
            )}

            {/* Error message */}
            {periodComparison.message && periodComparison.status === 'error' && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-400">{periodComparison.message}</span>
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
          <li>• Použijte příponu <code className="bg-white/10 px-1 rounded">_DPO</code> nebo <code className="bg-white/10 px-1 rounded">_SD</code> pro oddělené ranní/odpolední plány</li>
          <li>• Systém automaticky rozpozná DPO (ranní) a SD (odpolední) trasy podle času začátku</li>
          <li>• <strong>Porovnání období</strong> agreguje všechny plány platné v měsíci a porovná je s proofem</li>
          <li>• Trasy se počítají: plán × počet pracovních dnů platnosti</li>
        </ul>
      </div>
    </div>
  )
}
