import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  FileText, 
  Map,
  CheckCircle, 
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  MinusSquare,
  Factory
} from 'lucide-react'
import { proofs, invoices, carriers, routePlans } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

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

function DepotBadge({ depot }) {
  if (!depot || depot === 'BOTH') return null
  const isVratimov = depot === 'VRATIMOV'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
      isVratimov ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
    }`}>
      {isVratimov ? '🏭 Vrat.' : '🏭 Bydž.'}
    </span>
  )
}

// Tab komponenta
function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
        active 
          ? 'bg-alza-orange text-black' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded text-xs ${
          active ? 'bg-black/20' : 'bg-white/10'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function Documents() {
  const [activeTab, setActiveTab] = useState('plans') // 'plans', 'proofs', 'invoices'
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  const [selectedPlans, setSelectedPlans] = useState(new Set())
  const [expandedPlan, setExpandedPlan] = useState(null)
  
  const queryClient = useQueryClient()

  // Carriers
  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Route Plans - všechny pro dopravce
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrier],
    queryFn: () => routePlans.getAll({ carrier_id: selectedCarrier }),
    enabled: !!selectedCarrier
  })

  // Proofs - pro dopravce a období
  const { data: proofList } = useQuery({
    queryKey: ['proofs', selectedCarrier, selectedPeriod],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrier, period: selectedPeriod }),
    enabled: !!selectedCarrier
  })

  // Invoices - pro dopravce a období
  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrier, selectedPeriod],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrier, period: selectedPeriod }),
    enabled: !!selectedCarrier
  })

  // Upload mutations
  const uploadPlanMutation = useMutation({
    mutationFn: ({ file, carrierId }) => routePlans.upload(file, carrierId),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'plan', 
        fileName: variables.file.name, 
        success: true,
        message: `Plán nahrán: ${data.data?.validFrom || 'OK'}`
      }])
      queryClient.invalidateQueries(['route-plans'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'plan', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při nahrávání'
      }])
    }
  })

  const uploadProofMutation = useMutation({
    mutationFn: ({ file, carrierId, period }) => proofs.upload(file, carrierId, period),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'proof', 
        fileName: variables.file.name, 
        success: true,
        message: `Proof nahrán: ${data.period}`
      }])
      queryClient.invalidateQueries(['proofs'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'proof', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při nahrávání'
      }])
    }
  })

  const uploadInvoiceMutation = useMutation({
    mutationFn: ({ file, carrierId, period }) => invoices.upload(file, carrierId, period),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'invoice', 
        fileName: variables.file.name, 
        success: true,
        message: `Faktura nahrána: ${data.invoiceNumber}`
      }])
      queryClient.invalidateQueries(['invoices'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'invoice', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při nahrávání'
      }])
    }
  })

  // Delete mutations
  const deletePlanMutation = useMutation({
    mutationFn: (id) => routePlans.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['route-plans'])
      setSelectedPlans(new Set())
    }
  })

  const deleteProofMutation = useMutation({
    mutationFn: (id) => proofs.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['proofs'])
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => invoices.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['invoices'])
  })

  // Batch delete for plans
  const deleteBatchMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) {
        await routePlans.delete(id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['route-plans'])
      setSelectedPlans(new Set())
    }
  })

  // File handling
  const handleFiles = useCallback((files) => {
    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }

    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase()
      const ext = fileName.split('.').pop()
      
      // Rozpoznání typu souboru
      if (ext === 'pdf') {
        // PDF = faktura
        uploadInvoiceMutation.mutate({ file, carrierId: selectedCarrier, period: selectedPeriod })
      } else if (ext === 'xlsx' || ext === 'xls') {
        // Excel - rozlišit podle názvu
        if (fileName.includes('drivecool') || fileName.includes('plan') || fileName.includes('route')) {
          // Plánovací soubor
          uploadPlanMutation.mutate({ file, carrierId: selectedCarrier })
        } else {
          // Proof
          uploadProofMutation.mutate({ file, carrierId: selectedCarrier, period: selectedPeriod })
        }
      } else {
        setUploadResults(prev => [...prev, { 
          type: 'unknown', 
          fileName: file.name, 
          success: false,
          message: 'Nepodporovaný formát (pouze XLSX, PDF)'
        }])
      }
    })
  }, [selectedCarrier, selectedPeriod, uploadPlanMutation, uploadProofMutation, uploadInvoiceMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // Plan selection helpers
  const togglePlanSelection = (planId) => {
    const newSelected = new Set(selectedPlans)
    if (newSelected.has(planId)) {
      newSelected.delete(planId)
    } else {
      newSelected.add(planId)
    }
    setSelectedPlans(newSelected)
  }

  const toggleSelectAll = () => {
    if (!planList) return
    if (selectedPlans.size === planList.length) {
      setSelectedPlans(new Set())
    } else {
      setSelectedPlans(new Set(planList.map(p => p.id)))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedPlans.size === 0) return
    if (confirm(`Opravdu smazat ${selectedPlans.size} vybraných plánů?`)) {
      deleteBatchMutation.mutate(Array.from(selectedPlans))
    }
  }

  // Group plans by year
  const plansByYear = planList?.reduce((acc, plan) => {
    const year = plan.validFrom ? new Date(plan.validFrom).getFullYear() : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(plan)
    return acc
  }, {}) || {}

  const isUploading = uploadPlanMutation.isPending || uploadProofMutation.isPending || uploadInvoiceMutation.isPending
  const currentProof = proofList?.[0]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dokumenty</h1>
        <p className="text-gray-400 text-sm mt-1">Nahrávejte a spravujte plány, proofy a faktury</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dopravce</label>
            <select
              value={selectedCarrier}
              onChange={(e) => {
                setSelectedCarrier(e.target.value)
                setSelectedPlans(new Set())
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
            <label className="label">Období (pro proofy a faktury)</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
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

      {/* Drop Zone */}
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
          <UploadIcon className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-alza-orange' : 'text-gray-500'}`} />
          
          <p className="text-lg font-medium mb-1">
            {isUploading ? 'Nahrávám...' : 'Přetáhněte soubory sem'}
          </p>
          <p className="text-gray-400 text-sm mb-4">
            nebo klikněte pro výběr
          </p>
          
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="file-input"
            disabled={!selectedCarrier || isUploading}
          />
          <label
            htmlFor="file-input"
            className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${
              (!selectedCarrier || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat soubory
          </label>

          <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Map size={16} className="text-purple-400" />
              Drivecool*.xlsx = Plán
            </div>
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet size={16} className="text-green-400" />
              *.xlsx = Proof
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={16} className="text-red-400" />
              *.pdf = Faktura
            </div>
          </div>
        </div>
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Výsledky nahrávání</h2>
            <button onClick={() => setUploadResults([])} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {uploadResults.map((result, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{result.fileName}</div>
                  <div className={`text-xs ${result.success ? 'text-gray-400' : 'text-red-400'}`}>
                    {result.message}
                  </div>
                </div>
                <span className={`badge ${
                  result.type === 'plan' ? 'badge-purple' : 
                  result.type === 'proof' ? 'badge-success' : 
                  result.type === 'invoice' ? 'badge-info' : 
                  'badge-error'
                }`}>
                  {result.type === 'plan' ? 'Plán' :
                   result.type === 'proof' ? 'Proof' : 
                   result.type === 'invoice' ? 'Faktura' : 
                   'Neznámý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedCarrier && (
        <div className="flex gap-2 border-b border-white/10 pb-3">
          <Tab 
            active={activeTab === 'plans'} 
            onClick={() => setActiveTab('plans')}
            count={planList?.length}
          >
            <Map size={16} />
            Plány tras
          </Tab>
          <Tab 
            active={activeTab === 'proofs'} 
            onClick={() => setActiveTab('proofs')}
            count={proofList?.length}
          >
            <FileSpreadsheet size={16} />
            Proofy
          </Tab>
          <Tab 
            active={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')}
            count={invoiceList?.length}
          >
            <FileText size={16} />
            Faktury
          </Tab>
        </div>
      )}

      {/* Tab Content */}
      {selectedCarrier && activeTab === 'plans' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleSelectAll}
                className="text-gray-400 hover:text-white"
              >
                {planList?.length > 0 && selectedPlans.size === planList.length ? (
                  <CheckSquare size={20} />
                ) : selectedPlans.size > 0 ? (
                  <MinusSquare size={20} />
                ) : (
                  <Square size={20} />
                )}
              </button>
              <h2 className="font-semibold">Plánovací soubory</h2>
              {selectedPlans.size > 0 && (
                <span className="text-sm text-gray-400">({selectedPlans.size} vybráno)</span>
              )}
            </div>
            {selectedPlans.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleteBatchMutation.isPending}
                className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                <Trash2 size={16} />
                Smazat vybrané ({selectedPlans.size})
              </button>
            )}
          </div>
          
          {loadingPlans ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plánovací soubory</p>
              <p className="text-sm mt-1">Nahrajte soubory Drivecool*.xlsx</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {Object.entries(plansByYear)
                .sort(([a], [b]) => String(b).localeCompare(String(a)))
                .map(([year, plans]) => (
                  <div key={year}>
                    <div className="px-4 py-2 bg-white/5 text-sm font-medium text-gray-400">
                      {year} ({plans.length} plánů)
                    </div>
                    {plans.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).map(plan => (
                      <div 
                        key={plan.id} 
                        className={`px-4 py-3 flex items-center gap-3 hover:bg-white/5 ${
                          selectedPlans.has(plan.id) ? 'bg-purple-500/5' : ''
                        }`}
                      >
                        <button onClick={() => togglePlanSelection(plan.id)} className="text-gray-400 hover:text-white">
                          {selectedPlans.has(plan.id) ? (
                            <CheckSquare size={18} className="text-purple-400" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{plan.fileName}</span>
                            <PlanTypeBadge type={plan.planType} />
                            <DepotBadge depot={plan.depot} />
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Platný od {formatDate(plan.validFrom)}
                            {plan.validTo && ` do ${formatDate(plan.validTo)}`}
                            {' • '}{plan.totalRoutes} tras
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            if (confirm(`Smazat plán "${plan.fileName}"?`)) {
                              deletePlanMutation.mutate(plan.id)
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {selectedCarrier && activeTab === 'proofs' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold">Proofy — {selectedPeriod}</h2>
          </div>
          
          {!proofList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádný proof pro toto období</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {proofList.map(proof => (
                <div key={proof.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{proof.period}</div>
                      <div className="text-xs text-gray-500">{proof.fileName}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Smazat proof "${proof.period}"?`)) {
                          deleteProofMutation.mutate(proof.id)
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white/5 rounded p-2">
                      <span className="text-gray-400 text-xs">FIX</span>
                      <div className="font-medium">{formatCZK(proof.totalFix)}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <span className="text-gray-400 text-xs">KM</span>
                      <div className="font-medium">{formatCZK(proof.totalKm)}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <span className="text-gray-400 text-xs">Linehaul</span>
                      <div className="font-medium">{formatCZK(proof.totalLinehaul)}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <span className="text-gray-400 text-xs">Celkem</span>
                      <div className="font-medium text-alza-orange">{formatCZK(proof.grandTotal)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedCarrier && activeTab === 'invoices' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Faktury — {selectedPeriod}</h2>
            <span className="badge badge-info">{invoiceList?.length || 0} faktur</span>
          </div>
          
          {loadingInvoices ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !invoiceList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné faktury pro toto období</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Číslo faktury</th>
                    <th>Typ</th>
                    <th className="text-right">Bez DPH</th>
                    <th className="text-right">Celkem</th>
                    <th>Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="font-medium">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {invoice.items?.map((item, idx) => (
                            <span key={idx} className="badge badge-info text-xs">
                              {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right">{formatCZK(invoice.totalWithoutVat)}</td>
                      <td className="text-right font-medium">{formatCZK(invoice.totalWithVat)}</td>
                      <td>
                        <span className={`badge ${
                          invoice.status === 'matched' ? 'badge-success' :
                          invoice.status === 'disputed' ? 'badge-error' :
                          'badge-warning'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' :
                           invoice.status === 'disputed' ? 'Sporná' :
                           'Kontrola'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (confirm(`Smazat fakturu "${invoice.invoiceNumber}"?`)) {
                              deleteInvoiceMutation.mutate(invoice.id)
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
