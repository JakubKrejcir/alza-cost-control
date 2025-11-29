import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Trash2,
  Route,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Equal,
  CheckSquare,
  Square,
  Info
} from 'lucide-react'
import { proofs, carriers } from '../lib/api'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// Plans API
const plans = {
  getAll: (params) => api.get('/plans', { params }).then(r => r.data),
  getByPeriod: (period, carrierId) => api.get(`/plans/by-period/${period}`, { params: { carrier_id: carrierId } }).then(r => r.data),
  getOne: (id) => api.get(`/plans/${id}`).then(r => r.data),
  upload: (file, carrierId, validFrom) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    formData.append('valid_from', validFrom)
    return api.post('/plans/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
  compareWithProof: (proofId, planIds) => {
    const params = new URLSearchParams()
    planIds.forEach(id => params.append('plan_ids', id))
    return api.post(`/plans/compare-with-proof/${proofId}?${params.toString()}`).then(r => r.data)
  },
  delete: (id) => api.delete(`/plans/${id}`)
}

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
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

export default function Plans() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  
  // Multi-select for comparison
  const [selectedPlanIds, setSelectedPlanIds] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [comparisonResult, setComparisonResult] = useState(null)
  
  const queryClient = useQueryClient()

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['plans', selectedCarrier, selectedPeriod],
    queryFn: () => plans.getAll({ 
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
    mutationFn: ({ file, carrierId, validFrom }) => 
      plans.upload(file, carrierId, validFrom),
    onSuccess: (data) => {
      setUploadResult({ success: true, data })
      queryClient.invalidateQueries(['plans'])
    },
    onError: (error) => {
      setUploadResult({
        success: false,
        message: error.response?.data?.detail || 'Chyba při nahrávání'
      })
    }
  })

  const compareMutation = useMutation({
    mutationFn: ({ proofId, planIds }) => plans.compareWithProof(proofId, planIds),
    onSuccess: (data) => {
      setComparisonResult(data)
      setShowCompareModal(false)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Chyba při porovnávání')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => plans.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['plans'])
    }
  })

  const handleFiles = useCallback((files) => {
    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }
    if (!validFrom) {
      alert('Zadejte datum platnosti od')
      return
    }

    const file = files[0]
    const ext = file.name.split('.').pop().toLowerCase()
    
    if (ext === 'xlsx' || ext === 'xls') {
      uploadMutation.mutate({ file, carrierId: selectedCarrier, validFrom })
    } else {
      setUploadResult({
        success: false,
        message: 'Pouze XLSX soubory jsou podporovány'
      })
    }
  }, [selectedCarrier, validFrom, uploadMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDelete = (plan) => {
    if (confirm(`Opravdu smazat plán "${plan.name}"?`)) {
      deleteMutation.mutate(plan.id)
    }
  }

  const togglePlanSelection = (planId) => {
    setSelectedPlanIds(prev => 
      prev.includes(planId) 
        ? prev.filter(id => id !== planId)
        : [...prev, planId]
    )
  }

  const selectAllPlans = () => {
    if (planList) {
      setSelectedPlanIds(planList.map(p => p.id))
    }
  }

  const deselectAllPlans = () => {
    setSelectedPlanIds([])
  }

  const handleCompare = () => {
    if (selectedPlanIds.length === 0) {
      alert('Vyberte alespoň jeden plán')
      return
    }
    setShowCompareModal(true)
  }

  const executeComparison = (proofId) => {
    compareMutation.mutate({ proofId, planIds: selectedPlanIds })
  }

  const isUploading = uploadMutation.isPending

  // Calculate aggregated stats for selected plans
  const selectedPlansStats = planList?.filter(p => selectedPlanIds.includes(p.id)).reduce((acc, p) => ({
    count: acc.count + 1,
    totalDays: acc.totalDays + p.workingDays,
    totalRoutes: acc.totalRoutes + p.totalRoutes,
    totalKm: acc.totalKm + p.totalDistanceKm,
  }), { count: 0, totalDays: 0, totalRoutes: 0, totalKm: 0 })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plánování tras</h1>
          <p className="text-gray-500 text-sm mt-1">Porovnání plánů s realitou (proof)</p>
        </div>
      </div>

      {/* Settings */}
      <div className="widget">
        <div className="widget-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Dopravce</label>
              <select
                value={selectedCarrier}
                onChange={(e) => {
                  setSelectedCarrier(e.target.value)
                  setSelectedPlanIds([])
                  setComparisonResult(null)
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
                  setSelectedPlanIds([])
                  setComparisonResult(null)
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

            <div>
              <label className="label">Platnost od</label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Platnost do se vypočítá automaticky
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`widget p-8 border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300'
        } ${(!selectedCarrier || !validFrom) ? 'opacity-50' : ''}`}
      >
        <div className="text-center">
          <FileSpreadsheet className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          
          <p className="text-lg font-medium text-gray-900 mb-1">
            {isUploading ? 'Nahrávám...' : 'Přetáhněte plánovací XLSX sem'}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Soubor s trasami (Routes sheet)
          </p>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="plan-file-input"
            disabled={!selectedCarrier || !validFrom || isUploading}
          />
          <label
            htmlFor="plan-file-input"
            className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${
              (!selectedCarrier || !validFrom || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat soubor
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`widget p-4 ${uploadResult.success ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-medium ${uploadResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {uploadResult.success ? 'Plán nahrán!' : 'Chyba'}
              </h3>
              
              {uploadResult.success && uploadResult.data?.data && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Platnost od</p>
                      <p className="text-sm font-medium">{uploadResult.data.data.validFrom}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Platnost do</p>
                      <p className="text-sm font-medium">{uploadResult.data.data.validTo}</p>
                      <p className="text-xs text-gray-400">{uploadResult.data.data.validToNote}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600">Prac. dnů</p>
                      <p className="text-sm font-bold text-blue-600">{uploadResult.data.data.workingDays}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600">Celkem tras</p>
                      <p className="text-sm font-bold text-emerald-600">{uploadResult.data.data.totalRoutes}</p>
                    </div>
                    <div className="p-2 bg-violet-50 rounded-lg">
                      <p className="text-xs text-violet-600">LH kamionů</p>
                      <p className="text-sm font-bold text-violet-600">{uploadResult.data.data.linehaulsPerBatch}</p>
                    </div>
                  </div>
                  
                  {/* Info about updated previous plan */}
                  {uploadResult.data.updatedPreviousPlan && (
                    <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                      <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <strong>Předchozí plán aktualizován:</strong> "{uploadResult.data.updatedPreviousPlan.name}" 
                        nyní platí do {uploadResult.data.updatedPreviousPlan.validTo} ({uploadResult.data.updatedPreviousPlan.workingDays} prac. dnů)
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!uploadResult.success && (
                <p className="text-gray-600 mt-1">{uploadResult.message}</p>
              )}
            </div>
            <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      {selectedCarrier && (
        <div className="widget">
          <div className="widget-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Route size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="widget-title">Plány pro {selectedPeriod}</h3>
                <p className="widget-subtitle">{planList?.length || 0} plánů</p>
              </div>
            </div>
            
            {planList?.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedPlanIds.length === planList.length ? deselectAllPlans : selectAllPlans}
                  className="btn btn-secondary text-sm"
                >
                  {selectedPlanIds.length === planList.length ? 'Zrušit výběr' : 'Vybrat vše'}
                </button>
                <button
                  onClick={handleCompare}
                  disabled={selectedPlanIds.length === 0}
                  className="btn btn-primary text-sm flex items-center gap-2"
                >
                  <GitCompare size={16} />
                  Porovnat ({selectedPlanIds.length})
                </button>
              </div>
            )}
          </div>
          
          {loadingPlans ? (
            <div className="widget-body text-center text-gray-500 py-8">
              Načítám...
            </div>
          ) : !planList?.length ? (
            <div className="widget-body text-center text-gray-500 py-8">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plány pro toto období</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {planList.map(plan => (
                <div 
                  key={plan.id} 
                  className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${
                    selectedPlanIds.includes(plan.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <button
                    onClick={() => togglePlanSelection(plan.id)}
                    className="flex-shrink-0"
                  >
                    {selectedPlanIds.includes(plan.id) ? (
                      <CheckSquare size={20} className="text-blue-600" />
                    ) : (
                      <Square size={20} className="text-gray-400" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{plan.name}</span>
                      <span className="badge badge-info text-xs">
                        {plan.validFrom} → {plan.validTo}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{plan.workingDays} prac. dnů</span>
                      <span>{plan.routesPerDay} tras/den</span>
                      <span className="font-medium text-gray-700">{plan.totalRoutes} tras celkem</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="text-gray-500">LH kamionů</div>
                      <div className="font-semibold text-violet-600">{plan.linehaulsPerBatch}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">Km/den</div>
                      <div className="font-semibold">{Math.round(plan.totalDistanceKm / plan.workingDays)}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(plan)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Aggregated stats for selected plans */}
          {selectedPlanIds.length > 0 && selectedPlansStats && (
            <div className="border-t border-gray-100 p-4 bg-blue-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700">
                  Vybráno: {selectedPlansStats.count} plánů
                </span>
                <div className="flex items-center gap-6 text-sm">
                  <span><strong>{selectedPlansStats.totalDays}</strong> prac. dnů</span>
                  <span><strong>{selectedPlansStats.totalRoutes}</strong> tras celkem</span>
                  <span><strong>{Math.round(selectedPlansStats.totalKm)}</strong> km</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="widget w-full max-w-md animate-slide-up">
            <div className="widget-header flex items-center justify-between">
              <h3 className="widget-title">Vyberte proof k porovnání</h3>
              <button onClick={() => setShowCompareModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="widget-body">
              <p className="text-sm text-gray-600 mb-4">
                Porovnat {selectedPlanIds.length} plánů s proofem za období {selectedPeriod}
              </p>
              
              {proofList?.length > 0 ? (
                <div className="space-y-2">
                  {proofList.map(proof => (
                    <button
                      key={proof.id}
                      onClick={() => executeComparison(proof.id)}
                      disabled={compareMutation.isPending}
                      className="w-full p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
                    >
                      <div className="font-medium text-gray-900">Proof {proof.period}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Celkem: {formatCZK(proof.grandTotal)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Žádný proof pro toto období
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Result */}
      {comparisonResult && (
        <div className="widget border-l-4 border-l-blue-500">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <GitCompare size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="widget-title">Porovnání: Plány vs Proof</h3>
                <p className="widget-subtitle">
                  {comparisonResult.comparison.plans_count} plánů ({comparisonResult.comparison.total_working_days} prac. dnů) vs Proof {comparisonResult.proof?.period}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setComparisonResult(null)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <div className="widget-body">
            {/* Included Plans */}
            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-2">Zahrnuté plány:</p>
              <div className="flex flex-wrap gap-2">
                {comparisonResult.plans?.map(plan => (
                  <span key={plan.id} className="badge badge-info text-xs">
                    {plan.validFrom} - {plan.validTo} ({plan.workingDays} dnů)
                  </span>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-medium mb-1">Plán: Last Mile</p>
                <p className="text-2xl font-bold text-gray-900">{comparisonResult.comparison.routes_planned}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 font-medium mb-1">Skutečnost</p>
                <p className="text-2xl font-bold text-gray-900">{comparisonResult.comparison.routes_actual}</p>
              </div>
              <div className={`p-4 rounded-xl ${
                comparisonResult.comparison.routes_difference === 0 ? 'bg-gray-50' :
                comparisonResult.comparison.routes_difference > 0 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <p className={`text-xs font-medium mb-1 ${
                  comparisonResult.comparison.routes_difference === 0 ? 'text-gray-600' :
                  comparisonResult.comparison.routes_difference > 0 ? 'text-amber-600' : 'text-red-600'
                }`}>Rozdíl</p>
                <p className={`text-2xl font-bold flex items-center gap-2 ${
                  comparisonResult.comparison.routes_difference === 0 ? 'text-gray-900' :
                  comparisonResult.comparison.routes_difference > 0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {comparisonResult.comparison.routes_difference === 0 ? (
                    <><Equal size={20} /> 0</>
                  ) : comparisonResult.comparison.routes_difference > 0 ? (
                    <><TrendingUp size={20} /> +{comparisonResult.comparison.routes_difference}</>
                  ) : (
                    <><TrendingDown size={20} /> {comparisonResult.comparison.routes_difference}</>
                  )}
                </p>
              </div>
              <div className="p-4 bg-violet-50 rounded-xl">
                <p className="text-xs text-violet-600 font-medium mb-1">Náklady</p>
                <p className="text-xl font-bold text-gray-900">{formatCZK(comparisonResult.comparison.cost_actual)}</p>
              </div>
            </div>

            {/* Plan vs Proof Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-700 mb-3">📋 Plány (agregováno)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pracovních dnů:</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.working_days || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tras celkem:</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.total_routes || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">- s linehaulem (LH):</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.routes_lh || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">- direct (DR):</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.routes_dr || 0}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="text-gray-600">LH kamionů / den:</span>
                    <span className="font-bold text-blue-700">{comparisonResult.comparison.plan_breakdown?.linehauls_per_batch || 2}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <h4 className="text-sm font-semibold text-emerald-700 mb-3">📊 Proof (skutečnost)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">LH_DPO (ranní):</span>
                    <span className="font-medium">{comparisonResult.comparison.proof_breakdown?.lh_dpo || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">LH_SD (odpolední):</span>
                    <span className="font-medium">{comparisonResult.comparison.proof_breakdown?.lh_sd || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">LH_SD_SPOJENE:</span>
                    <span className="font-medium">{comparisonResult.comparison.proof_breakdown?.lh_sd_spojene || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DR (direct):</span>
                    <span className="font-medium">{comparisonResult.comparison.proof_breakdown?.dr || 0}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-emerald-200">
                    <span className="text-gray-600">Celkem tras:</span>
                    <span className="font-bold text-emerald-700">{comparisonResult.comparison.proof_breakdown?.total_routes || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Route Type Comparison Table */}
            {comparisonResult.comparison.route_comparison?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Detailní porovnání</h4>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Typ</th>
                        <th className="text-center">Plán</th>
                        <th className="text-center">Skutečnost</th>
                        <th className="text-center">Rozdíl</th>
                        <th>Status</th>
                        <th>Poznámka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResult.comparison.route_comparison.map((row, idx) => (
                        <tr key={idx}>
                          <td className="font-medium text-gray-900">{row.type}</td>
                          <td className="text-center">{row.planned}</td>
                          <td className="text-center">{row.actual}</td>
                          <td className="text-center">
                            <span className={`font-medium ${
                              row.difference === 0 ? 'text-gray-500' :
                              row.difference > 0 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {row.difference > 0 ? '+' : ''}{row.difference}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              row.status === 'ok' ? 'badge-success' :
                              row.status === 'extra' ? 'badge-warning' : 
                              row.status === 'missing' ? 'badge-error' :
                              'badge-info'
                            }`}>
                              {row.status === 'ok' ? 'OK' :
                               row.status === 'extra' ? 'Navíc' : 
                               row.status === 'missing' ? 'Chybí' :
                               'Info'}
                            </span>
                          </td>
                          <td className="text-sm text-gray-500">{row.note || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Differences List */}
            {comparisonResult.comparison.differences?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Zjištěné rozdíly</h4>
                <div className="space-y-2">
                  {comparisonResult.comparison.differences.map((diff, idx) => (
                    <div key={idx} className={`p-3 rounded-xl flex items-center gap-3 ${
                      diff.type === 'extra' ? 'bg-amber-50 border border-amber-100' :
                      diff.type === 'missing' ? 'bg-red-50 border border-red-100' :
                      'bg-blue-50 border border-blue-100'
                    }`}>
                      {diff.type === 'extra' ? (
                        <TrendingUp size={18} className="text-amber-600" />
                      ) : diff.type === 'missing' ? (
                        <TrendingDown size={18} className="text-red-600" />
                      ) : (
                        <AlertCircle size={18} className="text-blue-600" />
                      )}
                      <span className={`text-sm ${
                        diff.type === 'extra' ? 'text-amber-700' :
                        diff.type === 'missing' ? 'text-red-700' :
                        'text-blue-700'
                      }`}>
                        {diff.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
