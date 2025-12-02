import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  FileText, 
  Map,
  CheckCircle, 
  AlertCircle,
  X,
  Trash2,
  Check,
  FileSignature,
  Calendar,
  AlertTriangle,
  ChevronDown
} from 'lucide-react'
import { proofs, invoices, routePlans, contracts } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

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

function Checkbox({ checked, onChange }) {
  return (
    <div 
      onClick={onChange}
      className={`checkbox ${checked ? 'checked' : ''}`}
    >
      {checked && <Check size={12} />}
    </div>
  )
}

function PlanTypeBadge({ type }) {
  const config = {
    'BOTH': { bg: 'var(--color-purple-light)', fg: 'var(--color-purple)', label: 'BOTH' },
    'DPO': { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)', label: 'DPO' },
    'SD': { bg: 'var(--color-orange-light)', fg: '#e67e22', label: 'SD' },
  }
  const c = config[type] || config.BOTH
  return (
    <span className="badge" style={{ backgroundColor: c.bg, color: c.fg }}>
      {c.label}
    </span>
  )
}

function DepotBadge({ depot }) {
  if (!depot || depot === 'BOTH') return null
  const isVratimov = depot === 'VRATIMOV'
  return (
    <span className="badge" style={{ 
      backgroundColor: isVratimov ? 'var(--color-purple-light)' : 'var(--color-cyan-light)',
      color: isVratimov ? 'var(--color-purple)' : '#0891b2'
    }}>
      {isVratimov ? '🏭 Vrat.' : '🏭 Bydž.'}
    </span>
  )
}

function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`tab ${active ? 'active' : ''}`}
    >
      {children}
      {count !== undefined && (
        <span className="tab-count">{count}</span>
      )}
    </button>
  )
}

export default function Documents() {
  const { selectedCarrierId, selectedPeriod } = useCarrier()
  
  const [activeTab, setActiveTab] = useState('plans')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  const [selectedPlans, setSelectedPlans] = useState(new Set())
  const [selectedProofs, setSelectedProofs] = useState(new Set())
  const [selectedContracts, setSelectedContracts] = useState(new Set())
  
  const queryClient = useQueryClient()

  // Queries
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrierId],
    queryFn: () => routePlans.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: allProofList, isLoading: loadingProofs } = useQuery({
    queryKey: ['proofs-all', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrierId, selectedPeriod],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrierId, period: selectedPeriod }),
    enabled: !!selectedCarrierId
  })

  const { data: contractList, isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })

  // Upload mutations
  const uploadPlanMutation = useMutation({
    mutationFn: ({ file, carrierId }) => routePlans.upload(file, carrierId),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { type: 'plan', fileName: variables.file.name, success: true, message: `Plán nahrán` }])
      queryClient.invalidateQueries(['route-plans'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { type: 'plan', fileName: variables.file.name, success: false, message: error.response?.data?.detail || 'Chyba' }])
    }
  })

  const uploadProofMutation = useMutation({
    mutationFn: ({ file, carrierId, period }) => proofs.upload(file, carrierId, period),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { type: 'proof', fileName: variables.file.name, success: true, message: `Proof nahrán: ${data.period}` }])
      queryClient.invalidateQueries(['proofs-all'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { type: 'proof', fileName: variables.file.name, success: false, message: error.response?.data?.detail || 'Chyba' }])
    }
  })

  const uploadInvoiceMutation = useMutation({
    mutationFn: ({ file, carrierId, period }) => invoices.upload(file, carrierId, period),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { type: 'invoice', fileName: variables.file.name, success: true, message: `Faktura nahrána: ${data.invoiceNumber}` }])
      queryClient.invalidateQueries(['invoices'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { type: 'invoice', fileName: variables.file.name, success: false, message: error.response?.data?.detail || 'Chyba' }])
    }
  })

  const uploadContractMutation = useMutation({
    mutationFn: ({ file, carrierId }) => contracts.upload(file, carrierId),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { type: 'contract', fileName: variables.file.name, success: true, message: `Smlouva nahrána` }])
      queryClient.invalidateQueries(['contracts'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { type: 'contract', fileName: variables.file.name, success: false, message: error.response?.data?.detail || 'Chyba' }])
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
    onSuccess: () => {
      queryClient.invalidateQueries(['proofs-all'])
      setSelectedProofs(new Set())
    }
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => invoices.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['invoices'])
  })

  const deleteContractMutation = useMutation({
    mutationFn: (id) => contracts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      setSelectedContracts(new Set())
    }
  })

  // Batch delete mutations
  const deletePlansBatchMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) await routePlans.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['route-plans'])
      setSelectedPlans(new Set())
    }
  })

  const deleteProofsBatchMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) await proofs.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['proofs-all'])
      setSelectedProofs(new Set())
    }
  })

  const deleteContractsBatchMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) await contracts.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      setSelectedContracts(new Set())
    }
  })

  // File handling
  const handleFiles = useCallback((files) => {
    if (!selectedCarrierId) {
      alert('Vyberte dopravce')
      return
    }

    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase()
      const ext = fileName.split('.').pop()
      
      if (ext === 'pdf') {
        if (fileName.includes('smlouva') || fileName.includes('contract') || fileName.includes('ramcova')) {
          uploadContractMutation.mutate({ file, carrierId: selectedCarrierId })
        } else {
          uploadInvoiceMutation.mutate({ file, carrierId: selectedCarrierId, period: selectedPeriod })
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (fileName.includes('drivecool') || fileName.includes('plan') || fileName.includes('route')) {
          uploadPlanMutation.mutate({ file, carrierId: selectedCarrierId })
        } else {
          uploadProofMutation.mutate({ file, carrierId: selectedCarrierId, period: selectedPeriod })
        }
      } else {
        setUploadResults(prev => [...prev, { type: 'unknown', fileName: file.name, success: false, message: 'Nepodporovaný formát' }])
      }
    })
  }, [selectedCarrierId, selectedPeriod, uploadPlanMutation, uploadProofMutation, uploadInvoiceMutation, uploadContractMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // Selection helpers
  const togglePlanSelection = (id) => {
    const newSelected = new Set(selectedPlans)
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id)
    setSelectedPlans(newSelected)
  }

  const toggleSelectAllPlans = () => {
    if (!planList) return
    setSelectedPlans(selectedPlans.size === planList.length ? new Set() : new Set(planList.map(p => p.id)))
  }

  const toggleProofSelection = (id) => {
    const newSelected = new Set(selectedProofs)
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id)
    setSelectedProofs(newSelected)
  }

  const toggleSelectAllProofs = () => {
    if (!allProofList) return
    setSelectedProofs(selectedProofs.size === allProofList.length ? new Set() : new Set(allProofList.map(p => p.id)))
  }

  const toggleContractSelection = (id) => {
    const newSelected = new Set(selectedContracts)
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id)
    setSelectedContracts(newSelected)
  }

  const toggleSelectAllContracts = () => {
    if (!contractList) return
    setSelectedContracts(selectedContracts.size === contractList.length ? new Set() : new Set(contractList.map(c => c.id)))
  }

  // Delete handlers
  const handleDeleteSelectedPlans = () => {
    if (selectedPlans.size === 0) return
    if (confirm(`Opravdu smazat ${selectedPlans.size} vybraných plánů?`)) {
      deletePlansBatchMutation.mutate(Array.from(selectedPlans))
    }
  }

  const handleDeleteSelectedProofs = () => {
    if (selectedProofs.size === 0) return
    if (confirm(`Opravdu smazat ${selectedProofs.size} vybraných proofů?`)) {
      deleteProofsBatchMutation.mutate(Array.from(selectedProofs))
    }
  }

  const handleDeleteSelectedContracts = () => {
    if (selectedContracts.size === 0) return
    if (confirm(`Opravdu smazat ${selectedContracts.size} vybraných smluv?`)) {
      deleteContractsBatchMutation.mutate(Array.from(selectedContracts))
    }
  }

  // Group data
  const plansByYear = planList?.reduce((acc, plan) => {
    const year = plan.validFrom ? new Date(plan.validFrom).getFullYear() : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(plan)
    return acc
  }, {}) || {}

  const proofsByYear = allProofList?.reduce((acc, proof) => {
    const year = proof.period ? '20' + proof.period.split('/')[1] : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(proof)
    return acc
  }, {}) || {}

  const isUploading = uploadPlanMutation.isPending || uploadProofMutation.isPending || 
                      uploadInvoiceMutation.isPending || uploadContractMutation.isPending

  const tabs = [
    { id: 'plans', label: 'Plány', icon: Map, count: planList?.length || 0 },
    { id: 'proofs', label: 'Proofy', icon: FileSpreadsheet, count: allProofList?.length || 0 },
    { id: 'invoices', label: 'Faktury', icon: FileText, count: invoiceList?.length || 0 },
    { id: 'contracts', label: 'Smlouvy', icon: FileSignature, count: contractList?.length || 0 },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Dokumenty</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Nahrávejte a spravujte plány, proofy, faktury a smlouvy
        </p>
      </div>

      {/* Warning if no carrier */}
      {!selectedCarrierId && (
        <div className="card p-6" style={{ borderColor: 'var(--color-orange)', backgroundColor: 'var(--color-orange-light)' }}>
          <div className="flex items-center gap-3" style={{ color: '#e67e22' }}>
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Pro zobrazení a nahrávání dokumentů vyberte dopravce v horním menu
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {selectedCarrierId && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        >
          <div className="upload-zone-icon">
            <UploadIcon size={32} />
          </div>
          <p className="font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>
            {isUploading ? 'Nahrávám...' : 'Přetáhněte soubory sem'}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>nebo klikněte pro výběr</p>
          
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="file-input"
            disabled={isUploading}
          />
          <label htmlFor="file-input" className={`btn btn-primary ${isUploading ? 'opacity-50' : ''}`}>
            <UploadIcon size={18} />
            Vybrat soubory
          </label>

          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <Map size={16} style={{ color: 'var(--color-purple)' }} />
              Drivecool*.xlsx = Plán
            </div>
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet size={16} style={{ color: 'var(--color-green)' }} />
              *.xlsx = Proof
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={16} style={{ color: 'var(--color-red)' }} />
              *.pdf = Faktura
            </div>
            <div className="flex items-center gap-1.5">
              <FileSignature size={16} style={{ color: 'var(--color-primary)' }} />
              *smlouva*.pdf = Smlouva
            </div>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Výsledky nahrávání</span>
            <button onClick={() => setUploadResults([])} className="btn btn-ghost p-2">
              <X size={18} />
            </button>
          </div>
          <div>
            {uploadResults.map((result, idx) => (
              <div key={idx} className="list-item">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--color-green)' }} />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--color-red)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: 'var(--color-text-dark)' }}>{result.fileName}</div>
                  <div className="text-xs" style={{ color: result.success ? 'var(--color-text-muted)' : 'var(--color-red)' }}>
                    {result.message}
                  </div>
                </div>
                <span className={`badge badge-${
                  result.type === 'plan' ? 'purple' : 
                  result.type === 'proof' ? 'green' : 
                  result.type === 'invoice' ? 'red' : 
                  result.type === 'contract' ? 'blue' : 'orange'
                }`}>
                  {result.type === 'plan' ? 'Plán' :
                   result.type === 'proof' ? 'Proof' : 
                   result.type === 'invoice' ? 'Faktura' : 
                   result.type === 'contract' ? 'Smlouva' : 'Neznámý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedCarrierId && (
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <Tab 
              key={tab.id}
              active={activeTab === tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              count={tab.count}
            >
              <tab.icon size={16} /> {tab.label}
            </Tab>
          ))}
        </div>
      )}

      {/* === PLÁNY === */}
      {selectedCarrierId && activeTab === 'plans' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={planList?.length > 0 && selectedPlans.size === planList.length}
                onChange={toggleSelectAllPlans}
              />
              <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Plánovací soubory</span>
              {selectedPlans.size > 0 && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({selectedPlans.size} vybráno)</span>
              )}
            </div>
            {selectedPlans.size > 0 && (
              <button onClick={handleDeleteSelectedPlans} className="btn btn-danger">
                <Trash2 size={16} /> Smazat ({selectedPlans.size})
              </button>
            )}
          </div>
          
          {loadingPlans ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plánovací soubory</p>
            </div>
          ) : (
            Object.entries(plansByYear).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, plans]) => (
              <div key={year}>
                <div className="list-group-header flex items-center gap-2">
                  <ChevronDown size={14} />
                  {year}
                  <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>({plans.length})</span>
                </div>
                {plans.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).map(plan => (
                  <div 
                    key={plan.id} 
                    className={`list-item ${selectedPlans.has(plan.id) ? 'selected' : ''}`}
                  >
                    <Checkbox checked={selectedPlans.has(plan.id)} onChange={() => togglePlanSelection(plan.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text-dark)' }}>{plan.fileName}</span>
                        <PlanTypeBadge type={plan.planType} />
                        <DepotBadge depot={plan.depot} />
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Od {formatDate(plan.validFrom)} • {plan.totalRoutes} tras
                      </div>
                    </div>
                    <button 
                      onClick={() => { if (confirm(`Smazat "${plan.fileName}"?`)) deletePlanMutation.mutate(plan.id) }}
                      className="btn btn-ghost p-2"
                      style={{ color: 'var(--color-text-light)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* === PROOFY === */}
      {selectedCarrierId && activeTab === 'proofs' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={allProofList?.length > 0 && selectedProofs.size === allProofList.length}
                onChange={toggleSelectAllProofs}
              />
              <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Proofy</span>
              {selectedProofs.size > 0 && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({selectedProofs.size} vybráno)</span>
              )}
            </div>
            {selectedProofs.size > 0 && (
              <button onClick={handleDeleteSelectedProofs} className="btn btn-danger">
                <Trash2 size={16} /> Smazat ({selectedProofs.size})
              </button>
            )}
          </div>
          
          {loadingProofs ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !allProofList?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné proofy</p>
            </div>
          ) : (
            Object.entries(proofsByYear).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, proofItems]) => (
              <div key={year}>
                <div className="list-group-header flex items-center gap-2">
                  <ChevronDown size={14} />
                  {year}
                  <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>({proofItems.length})</span>
                </div>
                {proofItems.sort((a, b) => b.period.localeCompare(a.period)).map(proof => (
                  <div 
                    key={proof.id} 
                    className={`list-item ${selectedProofs.has(proof.id) ? 'selected' : ''}`}
                  >
                    <Checkbox checked={selectedProofs.has(proof.id)} onChange={() => toggleProofSelection(proof.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} style={{ color: 'var(--color-text-light)' }} />
                        <span className="font-medium text-sm" style={{ color: 'var(--color-text-dark)' }}>{proof.period}</span>
                        <span className="text-xs truncate" style={{ color: 'var(--color-text-light)' }}>({proof.fileName})</span>
                      </div>
                      {/* Detail breakdown */}
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-light)' }}>FIX:</span>{' '}
                          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalFix)}</span>
                        </div>
                        <div className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-light)' }}>KM:</span>{' '}
                          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalKm)}</span>
                        </div>
                        <div className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-light)' }}>LH:</span>{' '}
                          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalLinehaul)}</span>
                        </div>
                        <div className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
                          <span style={{ color: 'var(--color-text-light)' }}>Tras:</span>{' '}
                          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{(proof.totalDpo || 0) + (proof.totalSd || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCZK(proof.grandTotal)}</div>
                    </div>
                    <button 
                      onClick={() => { if (confirm(`Smazat proof "${proof.period}"?`)) deleteProofMutation.mutate(proof.id) }}
                      className="btn btn-ghost p-2"
                      style={{ color: 'var(--color-text-light)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* === FAKTURY === */}
      {selectedCarrierId && activeTab === 'invoices' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Faktury — {selectedPeriod}</span>
            <span className="badge badge-blue">{invoiceList?.length || 0} faktur</span>
          </div>
          
          {loadingInvoices ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !invoiceList?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné faktury pro toto období</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Číslo faktury</th>
                    <th className="text-left p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Typ</th>
                    <th className="text-right p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Bez DPH</th>
                    <th className="text-right p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Celkem</th>
                    <th className="text-center p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map(invoice => (
                    <tr key={invoice.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td className="p-4 font-medium" style={{ color: 'var(--color-text-dark)' }}>{invoice.invoiceNumber}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {invoice.items?.map((item, idx) => (
                            <span key={idx} className="badge badge-blue">
                              {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right" style={{ color: 'var(--color-text)' }}>{formatCZK(invoice.totalWithoutVat)}</td>
                      <td className="p-4 text-right font-medium" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(invoice.totalWithVat)}</td>
                      <td className="p-4 text-center">
                        <span className={`badge badge-${
                          invoice.status === 'matched' ? 'green' :
                          invoice.status === 'disputed' ? 'red' : 'orange'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' : invoice.status === 'disputed' ? 'Sporná' : 'Kontrola'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => { if (confirm(`Smazat fakturu "${invoice.invoiceNumber}"?`)) deleteInvoiceMutation.mutate(invoice.id) }}
                          className="btn btn-ghost p-2"
                          style={{ color: 'var(--color-text-light)' }}
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

      {/* === SMLOUVY === */}
      {selectedCarrierId && activeTab === 'contracts' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={contractList?.length > 0 && selectedContracts.size === contractList.length}
                onChange={toggleSelectAllContracts}
              />
              <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Smlouvy</span>
              {selectedContracts.size > 0 && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({selectedContracts.size} vybráno)</span>
              )}
            </div>
            {selectedContracts.size > 0 && (
              <button onClick={handleDeleteSelectedContracts} className="btn btn-danger">
                <Trash2 size={16} /> Smazat ({selectedContracts.size})
              </button>
            )}
          </div>
          
          {loadingContracts ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !contractList?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné smlouvy</p>
              <p className="text-sm mt-1">Nahrajte PDF soubory obsahující "smlouva" v názvu</p>
            </div>
          ) : (
            contractList.map(contract => (
              <div 
                key={contract.id} 
                className={`list-item ${selectedContracts.has(contract.id) ? 'selected' : ''}`}
              >
                <Checkbox checked={selectedContracts.has(contract.id)} onChange={() => toggleContractSelection(contract.id)} />
                <FileSignature size={20} style={{ color: 'var(--color-primary)' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                    {contract.name || contract.fileName || `Smlouva #${contract.id}`}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {contract.validFrom && `Od ${formatDate(contract.validFrom)}`}
                    {contract.validTo && ` do ${formatDate(contract.validTo)}`}
                  </div>
                </div>
                <button 
                  onClick={() => { if (confirm(`Smazat smlouvu?`)) deleteContractMutation.mutate(contract.id) }}
                  className="btn btn-ghost p-2"
                  style={{ color: 'var(--color-text-light)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
