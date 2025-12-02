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

function Checkbox({ checked, onChange, className = '' }) {
  return (
    <div 
      onClick={onChange}
      className={`checkbox ${checked ? 'checked' : ''} ${className}`}
    >
      {checked && <Check size={12} />}
    </div>
  )
}

function Badge({ type, children }) {
  const classes = {
    purple: 'badge-purple',
    blue: 'badge-blue',
    green: 'badge-green',
    orange: 'badge-orange',
    red: 'badge-red',
    cyan: 'badge-cyan',
  }
  return <span className={`badge ${classes[type] || 'badge-blue'}`}>{children}</span>
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
      setUploadResults(prev => [...prev, { type: 'proof', fileName: variables.file.name, success: true, message: `Proof nahrán` }])
      queryClient.invalidateQueries(['proofs-all'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { type: 'proof', fileName: variables.file.name, success: false, message: error.response?.data?.detail || 'Chyba' }])
    }
  })

  const uploadInvoiceMutation = useMutation({
    mutationFn: ({ file, carrierId, period }) => invoices.upload(file, carrierId, period),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { type: 'invoice', fileName: variables.file.name, success: true, message: `Faktura nahrána` }])
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
    onSuccess: () => { queryClient.invalidateQueries(['route-plans']); setSelectedPlans(new Set()) }
  })

  const deleteProofMutation = useMutation({
    mutationFn: (id) => proofs.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['proofs-all']); setSelectedProofs(new Set()) }
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => invoices.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['invoices'])
  })

  const deleteContractMutation = useMutation({
    mutationFn: (id) => contracts.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); setSelectedContracts(new Set()) }
  })

  // Batch deletes
  const deletePlansBatchMutation = useMutation({
    mutationFn: async (ids) => { for (const id of ids) await routePlans.delete(id) },
    onSuccess: () => { queryClient.invalidateQueries(['route-plans']); setSelectedPlans(new Set()) }
  })

  const deleteProofsBatchMutation = useMutation({
    mutationFn: async (ids) => { for (const id of ids) await proofs.delete(id) },
    onSuccess: () => { queryClient.invalidateQueries(['proofs-all']); setSelectedProofs(new Set()) }
  })

  const deleteContractsBatchMutation = useMutation({
    mutationFn: async (ids) => { for (const id of ids) await contracts.delete(id) },
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); setSelectedContracts(new Set()) }
  })

  // File handling
  const handleFiles = useCallback((files) => {
    if (!selectedCarrierId) return

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
      }
    })
  }, [selectedCarrierId, selectedPeriod])

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

  // Group data by year
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

  const isUploading = uploadPlanMutation.isPending || uploadProofMutation.isPending || uploadInvoiceMutation.isPending || uploadContractMutation.isPending

  const tabs = [
    { id: 'plans', label: 'Plány', count: planList?.length || 0 },
    { id: 'proofs', label: 'Proofy', count: allProofList?.length || 0 },
    { id: 'invoices', label: 'Faktury', count: invoiceList?.length || 0 },
    { id: 'contracts', label: 'Smlouvy', count: contractList?.length || 0 },
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
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-light)' }}>nebo klikněte pro výběr</p>
          
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="file-input"
            disabled={isUploading}
          />
          <label htmlFor="file-input" className="btn btn-primary cursor-pointer">
            Vybrat soubory
          </label>

          <div className="flex justify-center gap-8 mt-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-purple)' }}></span>
              Drivecool*.xlsx = Plán
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-green)' }}></span>
              *.xlsx = Proof
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-orange)' }}></span>
              *.pdf = Faktura
            </span>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Výsledky nahrávání</span>
            <button onClick={() => setUploadResults([])} style={{ color: 'var(--color-text-light)' }}>
              <X size={18} />
            </button>
          </div>
          <div>
            {uploadResults.map((result, idx) => (
              <div key={idx} className="list-item">
                {result.success ? (
                  <CheckCircle size={20} style={{ color: 'var(--color-green)' }} />
                ) : (
                  <AlertCircle size={20} style={{ color: 'var(--color-red)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: 'var(--color-text-dark)' }}>{result.fileName}</div>
                  <div className="text-sm" style={{ color: result.success ? 'var(--color-text-muted)' : 'var(--color-red)' }}>
                    {result.message}
                  </div>
                </div>
                <Badge type={result.type === 'plan' ? 'purple' : result.type === 'proof' ? 'green' : result.type === 'invoice' ? 'orange' : 'blue'}>
                  {result.type === 'plan' ? 'Plán' : result.type === 'proof' ? 'Proof' : result.type === 'invoice' ? 'Faktura' : 'Smlouva'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedCarrierId && (
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* === PLÁNY === */}
      {selectedCarrierId && activeTab === 'plans' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-4">
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
              <button 
                onClick={() => { if (confirm(`Smazat ${selectedPlans.size} plánů?`)) deletePlansBatchMutation.mutate(Array.from(selectedPlans)) }}
                className="btn btn-danger"
              >
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
                  <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>({plans.length} plánů)</span>
                </div>
                {plans.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).map(plan => (
                  <div 
                    key={plan.id} 
                    className={`list-item cursor-pointer ${selectedPlans.has(plan.id) ? 'selected' : ''}`}
                    onClick={() => togglePlanSelection(plan.id)}
                  >
                    <Checkbox checked={selectedPlans.has(plan.id)} onChange={() => {}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{plan.fileName}</span>
                        <Badge type={plan.planType === 'BOTH' ? 'purple' : plan.planType === 'DPO' ? 'blue' : 'orange'}>
                          {plan.planType || 'BOTH'}
                        </Badge>
                        {plan.depot && plan.depot !== 'BOTH' && (
                          <Badge type={plan.depot === 'VRATIMOV' ? 'purple' : 'cyan'}>
                            {plan.depot === 'VRATIMOV' ? 'Vratimov' : 'Bydžov'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Od {formatDate(plan.validFrom)} • {plan.totalRoutes} tras
                      </div>
                    </div>
                    {selectedPlans.has(plan.id) && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-green)' }}>
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Smazat "${plan.fileName}"?`)) deletePlanMutation.mutate(plan.id) }}
                      className="p-2 rounded-lg"
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
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-4">
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
              <button 
                onClick={() => { if (confirm(`Smazat ${selectedProofs.size} proofů?`)) deleteProofsBatchMutation.mutate(Array.from(selectedProofs)) }}
                className="btn btn-danger"
              >
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
                    className={`list-item cursor-pointer ${selectedProofs.has(proof.id) ? 'selected' : ''}`}
                    onClick={() => toggleProofSelection(proof.id)}
                  >
                    <Checkbox checked={selectedProofs.has(proof.id)} onChange={() => {}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} style={{ color: 'var(--color-text-light)' }} />
                        <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{proof.period}</span>
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({proof.fileName})</span>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span style={{ color: 'var(--color-text-muted)' }}>FIX: <strong style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalFix)}</strong></span>
                        <span style={{ color: 'var(--color-text-muted)' }}>KM: <strong style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalKm)}</strong></span>
                        <span style={{ color: 'var(--color-text-muted)' }}>LH: <strong style={{ color: 'var(--color-text-dark)' }}>{formatCZK(proof.totalLinehaul)}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCZK(proof.grandTotal)}</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Smazat proof "${proof.period}"?`)) deleteProofMutation.mutate(proof.id) }}
                      className="p-2 rounded-lg"
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
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Faktury — {selectedPeriod}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{invoiceList?.length || 0} faktur</span>
          </div>
          
          {loadingInvoices ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
          ) : !invoiceList?.length ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné faktury pro toto období</p>
            </div>
          ) : (
            invoiceList.map(invoice => (
              <div key={invoice.id} className="list-item">
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>{invoice.invoiceNumber}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {invoice.items?.map((item, idx) => (
                      <Badge key={idx} type="blue">
                        {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formatCZK(invoice.totalWithoutVat)}</div>
                  <div className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>{formatCZK(invoice.totalWithVat)}</div>
                </div>
                <Badge type={invoice.status === 'matched' ? 'green' : invoice.status === 'disputed' ? 'red' : 'orange'}>
                  {invoice.status === 'matched' ? 'OK' : invoice.status === 'disputed' ? 'Sporná' : 'Kontrola'}
                </Badge>
                <button 
                  onClick={() => { if (confirm(`Smazat fakturu "${invoice.invoiceNumber}"?`)) deleteInvoiceMutation.mutate(invoice.id) }}
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--color-text-light)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* === SMLOUVY === */}
      {selectedCarrierId && activeTab === 'contracts' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Smlouvy</span>
            </div>
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
              <div key={contract.id} className="list-item">
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
                  className="p-2 rounded-lg"
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
