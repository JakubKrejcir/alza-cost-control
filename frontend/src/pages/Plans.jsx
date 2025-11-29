import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Truck,
  ArrowRight,
  MoreVertical,
  Route,
  TrendingUp,
  TrendingDown,
  Equal,
  Trash2,
  GitCompare,
  MapPin,
  Clock,
  X
} from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// API functions
const plans = {
  getAll: (params) => api.get('/plans', { params }).then(r => r.data),
  getOne: (id) => api.get(`/plans/${id}`).then(r => r.data),
  upload: (file, carrierId, planDate) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    formData.append('plan_date', planDate)
    return api.post('/plans/upload', formData).then(r => r.data)
  },
  compare: (planId, proofId) => api.post(`/plans/${planId}/compare/${proofId}`).then(r => r.data),
  delete: (id) => api.delete(`/plans/${id}`).then(r => r.data),
}

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

export default function Plans() {
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [planDate, setPlanDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [comparisonResult, setComparisonResult] = useState(null)
  
  const queryClient = useQueryClient()

  // Fetch carriers
  const { data: carriers } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => api.get('/carriers').then(r => r.data)
  })

  // Auto-select first carrier
  if (carriers?.length > 0 && !selectedCarrier) {
    setSelectedCarrier(carriers[0].id.toString())
  }

  // Fetch plans
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['plans', selectedCarrier],
    queryFn: () => plans.getAll({ carrier_id: selectedCarrier }),
    enabled: !!selectedCarrier
  })

  // Fetch proofs for comparison
  const { data: proofs } = useQuery({
    queryKey: ['proofs', selectedCarrier],
    queryFn: () => api.get('/proofs', { params: { carrier_id: selectedCarrier } }).then(r => r.data),
    enabled: !!selectedCarrier
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, carrierId, planDate }) => plans.upload(file, carrierId, planDate),
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

  // Compare mutation
  const compareMutation = useMutation({
    mutationFn: ({ planId, proofId }) => plans.compare(planId, proofId),
    onSuccess: (data) => {
      setComparisonResult(data)
      setShowCompareModal(false)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Chyba při porovnávání')
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => plans.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['plans'])
    }
  })

  const handleFiles = useCallback((files) => {
    const file = files[0]
    if (!file) return

    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setUploadResult({
        success: false,
        message: 'Pouze XLSX/XLS soubory jsou podporovány'
      })
      return
    }

    setUploadResult(null)
    uploadMutation.mutate({ file, carrierId: selectedCarrier, planDate })
  }, [selectedCarrier, planDate, uploadMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleCompare = (plan) => {
    setSelectedPlan(plan)
    setShowCompareModal(true)
  }

  const handleDelete = (plan) => {
    if (confirm(`Opravdu smazat plán "${plan.name}"?`)) {
      deleteMutation.mutate(plan.id)
    }
  }

  const runComparison = (proofId) => {
    if (selectedPlan) {
      compareMutation.mutate({ planId: selectedPlan.id, proofId })
    }
  }

  const isLoading = uploadMutation.isPending

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plánování tras</h1>
        <p className="text-gray-500 text-sm mt-1">Nahrání plánu a porovnání s realitou (proof)</p>
      </div>

      {/* Settings Card */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Dopravce</label>
              <div className="relative">
                <Truck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="select pl-10"
                >
                  <option value="">Vyberte dopravce...</option>
                  {carriers?.map(carrier => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="label">Datum plánu</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`card border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300'
        } ${!selectedCarrier ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="card-body py-12 text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            dragOver ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <FileSpreadsheet size={28} className={dragOver ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {isLoading ? 'Nahrávám...' : 'Přetáhněte plánovací soubor sem'}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            XLSX soubor s trasami (např. z routovacího nástroje)
          </p>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="plan-file-input"
            disabled={!selectedCarrier || isLoading}
          />
          <label
            htmlFor="plan-file-input"
            className={`btn btn-primary cursor-pointer ${
              (!selectedCarrier || isLoading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat soubor
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`widget ${uploadResult.success ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
          <div className="widget-body">
            <div className="flex items-start gap-4">
              {uploadResult.success ? (
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-emerald-600" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${uploadResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                  {uploadResult.success ? 'Plán nahrán!' : 'Chyba'}
                </h3>
                
                {uploadResult.success && uploadResult.data?.data && (
                  <div className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500">Last Mile tras</p>
                        <p className="text-xl font-bold text-gray-900">{uploadResult.data.data.totalRoutes}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl">
                        <p className="text-xs text-blue-600">s Linehaulem (LH)</p>
                        <p className="text-xl font-bold text-blue-600">{uploadResult.data.data.routesLh}</p>
                      </div>
                      <div className="p-3 bg-violet-50 rounded-xl">
                        <p className="text-xs text-violet-600">LH kamionů</p>
                        <p className="text-xl font-bold text-violet-600">{uploadResult.data.data.linehaulsPerBatch}</p>
                        <p className="text-xs text-violet-500">pro celý rozvoz</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500">Celkem km</p>
                        <p className="text-xl font-bold text-gray-900">{Math.round(uploadResult.data.data.totalDistanceKm)}</p>
                      </div>
                    </div>
                    
                    {/* Routes breakdown */}
                    {uploadResult.data.data.routes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Detail tras:</p>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="table text-sm">
                            <thead>
                              <tr>
                                <th>Trasa</th>
                                <th>Typ</th>
                                <th className="text-right">Zastávky</th>
                                <th className="text-right">Km</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uploadResult.data.data.routes.map((route, idx) => (
                                <tr key={idx}>
                                  <td className="font-medium">{route.vehicleId}</td>
                                  <td>
                                    <span className="badge badge-info">{route.routeTypeRaw}</span>
                                  </td>
                                  <td className="text-right">{route.stopsCount}</td>
                                  <td className="text-right">{Math.round(route.distanceKm)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {!uploadResult.success && (
                  <p className="text-gray-600 mt-1">{uploadResult.message}</p>
                )}
              </div>
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
                <h3 className="widget-title">Porovnání: Plán vs Realita</h3>
                <p className="widget-subtitle">
                  {comparisonResult.plan?.name} vs Proof {comparisonResult.proof?.period}
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
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-medium mb-1">Plán: Last Mile tras</p>
                <p className="text-2xl font-bold text-gray-900">{comparisonResult.comparison.routes_planned}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 font-medium mb-1">Skutečnost: Last Mile</p>
                <p className="text-2xl font-bold text-gray-900">{comparisonResult.comparison.routes_actual}</p>
              </div>
              <div className={`p-4 rounded-xl ${
                comparisonResult.comparison.routes_difference === 0 ? 'bg-gray-50' :
                comparisonResult.comparison.routes_difference > 0 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <p className={`text-xs font-medium mb-1 ${
                  comparisonResult.comparison.routes_difference === 0 ? 'text-gray-600' :
                  comparisonResult.comparison.routes_difference > 0 ? 'text-amber-600' : 'text-red-600'
                }`}>Rozdíl tras</p>
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
                <p className="text-xs text-violet-600 font-medium mb-1">Náklady (proof)</p>
                <p className="text-xl font-bold text-gray-900">{formatCZK(comparisonResult.comparison.cost_actual)}</p>
              </div>
            </div>

            {/* Plan vs Proof Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Plan breakdown */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-700 mb-3">📋 Plán (1 den)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Mile tras:</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.total_routes || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">- s linehaulem (LH):</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.routes_with_linehaul || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">- direct (DR):</span>
                    <span className="font-medium">{comparisonResult.comparison.plan_breakdown?.direct_routes || 0}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="text-gray-600">Linehaul kamionů:</span>
                    <span className="font-bold text-blue-700">{comparisonResult.comparison.plan_breakdown?.linehauls_per_batch || 2}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    LH-LH = 2 kamiony pro celý rozvoz
                  </p>
                </div>
              </div>

              {/* Proof breakdown */}
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
                </div>
              </div>
            </div>

            {/* Route Type Comparison */}
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

            {/* Differences */}
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

      {/* Plans List */}
      {selectedCarrier && (
        <div className="widget">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Route size={16} className="text-violet-600" />
              </div>
              <div>
                <h3 className="widget-title">Nahrané plány</h3>
                <p className="widget-subtitle">{planList?.length || 0} plánů</p>
              </div>
            </div>
          </div>

          {loadingPlans ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center">
              <FileSpreadsheet size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Žádné plány</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {planList.map(plan => (
                <div key={plan.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Route size={24} className="text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{plan.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {plan.planDate ? format(new Date(plan.planDate), 'd. MMMM yyyy', { locale: cs }) : '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {plan.totalRoutes} tras
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {Math.round(plan.totalDistanceKm)} km
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCompare(plan)}
                        className="btn btn-secondary"
                      >
                        <GitCompare size={16} />
                        Porovnat s proofem
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="p-2.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-info">DR: {plan.routesDr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">LH: {plan.routesLh}</span>
                    </div>
                    {plan.totalStops > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="badge badge-neutral">{plan.totalStops} zastávek</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && selectedPlan && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowCompareModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card w-full max-w-lg animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Vyberte proof k porovnání</h2>
                <button onClick={() => setShowCompareModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">
                  Plán: <span className="font-medium text-gray-900">{selectedPlan.name}</span>
                  <br />
                  Datum: {selectedPlan.planDate ? format(new Date(selectedPlan.planDate), 'd. MMMM yyyy', { locale: cs }) : '—'}
                </p>

                {!proofs?.length ? (
                  <p className="text-gray-500 text-center py-8">Žádné proofy k porovnání</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {proofs.map(proof => (
                      <button
                        key={proof.id}
                        onClick={() => runComparison(proof.id)}
                        disabled={compareMutation.isPending}
                        className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{proof.period}</p>
                            <p className="text-sm text-gray-500">
                              Celkem: {formatCZK(proof.grandTotal)}
                            </p>
                          </div>
                          <ArrowRight size={18} className="text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
