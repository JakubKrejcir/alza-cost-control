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
  Square,
  CheckSquare,
  MinusSquare,
  FileSignature,
  Calendar,
  AlertTriangle,
  Package,
  MapPin,
  Clock
} from 'lucide-react'
import { proofs, invoices, routePlans, contracts, alzabox } from '../lib/api'
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
function Tab({ active, onClick, children, count, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
        active 
          ? 'bg-alza-orange text-black' 
          : highlight
            ? 'text-cyan-400 hover:text-white hover:bg-white/5 border border-cyan-500/30'
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
  const { selectedCarrierId, selectedPeriod } = useCarrier()
  
  // 'alzabox', 'plans', 'proofs', 'invoices', 'contracts'
  const [activeTab, setActiveTab] = useState('alzabox')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  const [selectedPlans, setSelectedPlans] = useState(new Set())
  const [selectedProofs, setSelectedProofs] = useState(new Set())
  const [selectedContracts, setSelectedContracts] = useState(new Set())
  
  const queryClient = useQueryClient()

  // Route Plans - pro dopravce
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrierId],
    queryFn: () => routePlans.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Proofy - pro dopravce
  const { data: allProofList, isLoading: loadingProofs } = useQuery({
    queryKey: ['proofs-all', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Invoices - pro dopravce
  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrierId, selectedPeriod],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrierId, period: selectedPeriod }),
    enabled: !!selectedCarrierId
  })

  // Contracts - pro dopravce
  const { data: contractList, isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })

  // AlzaBox summary - GLOBÁLNÍ (bez dopravce)
  const { data: alzaboxSummary, isLoading: loadingAlzabox } = useQuery({
    queryKey: ['alzabox-summary-global'],
    queryFn: () => alzabox.getSummary()
  })

  // Upload mutations pro dopravce
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
      queryClient.invalidateQueries(['proofs-all'])
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

  const uploadContractMutation = useMutation({
    mutationFn: ({ file, carrierId }) => contracts.upload(file, carrierId),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'contract', 
        fileName: variables.file.name, 
        success: true,
        message: `Smlouva nahrána`
      }])
      queryClient.invalidateQueries(['contracts'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'contract', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při nahrávání'
      }])
    }
  })

  // AlzaBox upload mutations - GLOBÁLNÍ (bez dopravce)
  const uploadAlzaboxLocationsMutation = useMutation({
    mutationFn: (file) => alzabox.importLocations(file),
    onSuccess: (data, file) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-locations', 
        fileName: file?.name || 'soubor', 
        success: true,
        message: `Nahráno ${data.imported || 0} boxů`
      }])
      queryClient.invalidateQueries(['alzabox-summary-global'])
    },
    onError: (error, file) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-locations', 
        fileName: file?.name || 'soubor', 
        success: false,
        message: error.response?.data?.detail || error.message || 'Chyba při nahrávání'
      }])
    }
  })

  const uploadAlzaboxDeliveriesMutation = useMutation({
    mutationFn: (file) => alzabox.importDeliveries(file),
    onSuccess: (data, file) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-deliveries', 
        fileName: file?.name || 'soubor', 
        success: true,
        message: `Nahráno ${data.imported || 0} dojezdů${data.unmatched_carriers?.length ? ` (${data.unmatched_carriers.length} nenamapovaných dopravců)` : ''}`
      }])
      queryClient.invalidateQueries(['alzabox-summary-global'])
    },
    onError: (error, file) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-deliveries', 
        fileName: file?.name || 'soubor', 
        success: false,
        message: error.response?.data?.detail || error.message || 'Chyba při nahrávání'
      }])
    }
  })

  // Delete AlzaBox data mutations
  const deleteAlzaboxLocationsMutation = useMutation({
    mutationFn: () => alzabox.deleteLocations(),
    onSuccess: () => {
      queryClient.invalidateQueries(['alzabox-summary-global'])
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-locations', 
        fileName: 'Všechny boxy', 
        success: true,
        message: 'Data smazána'
      }])
    }
  })

  const deleteAlzaboxDeliveriesMutation = useMutation({
    mutationFn: () => alzabox.deleteDeliveries(),
    onSuccess: () => {
      queryClient.invalidateQueries(['alzabox-summary-global'])
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-deliveries', 
        fileName: 'Všechny dojezdy', 
        success: true,
        message: 'Data smazána'
      }])
    }
  })

  // Delete mutations pro dopravce
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

  // File handling pro DOPRAVCE
  const handleCarrierFiles = useCallback((files) => {
    if (!selectedCarrierId) {
      alert('Vyberte dopravce')
      return
    }

    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase()
      const ext = fileName.split('.').pop()
      
      if (ext === 'pdf') {
        if (fileName.includes('smlouva') || fileName.includes('contract') || fileName.includes('ramcova') || /con\d{5}/.test(fileName)) {
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
        setUploadResults(prev => [...prev, { 
          type: 'unknown', 
          fileName: file.name, 
          success: false,
          message: 'Nepodporovaný formát (pouze XLSX, PDF)'
        }])
      }
    })
  }, [selectedCarrierId, selectedPeriod, uploadPlanMutation, uploadProofMutation, uploadInvoiceMutation, uploadContractMutation])

  // File handling pro ALZABOX (globální)
  const handleAlzaboxFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase()
      const ext = fileName.split('.').pop()
      
      if (ext === 'xlsx' || ext === 'xls') {
        if (fileName.includes('location') || fileName.includes('umisten') || (fileName.includes('box') && !fileName.includes('dojezd'))) {
          uploadAlzaboxLocationsMutation.mutate(file)
        } else if (fileName.includes('dojezd') || fileName.includes('delivery') || fileName.includes('actual')) {
          uploadAlzaboxDeliveriesMutation.mutate(file)
        } else {
          setUploadResults(prev => [...prev, { 
            type: 'alzabox-unknown', 
            fileName: file.name, 
            success: false,
            message: 'Nerozpoznaný typ - použijte "location" nebo "dojezd" v názvu'
          }])
        }
      } else {
        setUploadResults(prev => [...prev, { 
          type: 'alzabox-unknown', 
          fileName: file.name, 
          success: false,
          message: 'Nepodporovaný formát (pouze XLSX)'
        }])
      }
    })
  }, [uploadAlzaboxLocationsMutation, uploadAlzaboxDeliveriesMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    if (activeTab === 'alzabox') {
      handleAlzaboxFiles(e.dataTransfer.files)
    } else {
      handleCarrierFiles(e.dataTransfer.files)
    }
  }, [activeTab, handleAlzaboxFiles, handleCarrierFiles])

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
                      uploadInvoiceMutation.isPending || uploadContractMutation.isPending ||
                      uploadAlzaboxLocationsMutation.isPending || uploadAlzaboxDeliveriesMutation.isPending

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dokumenty</h1>
        <p className="text-gray-400 text-sm mt-1">Nahrávejte a spravujte plány, proofy, faktury, smlouvy a AlzaBox data</p>
      </div>

      {/* Taby - AlzaBox je VŽDY dostupný */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <Tab 
          active={activeTab === 'alzabox'} 
          onClick={() => setActiveTab('alzabox')} 
          count={alzaboxSummary?.total_boxes}
          highlight={!selectedCarrierId && activeTab !== 'alzabox'}
        >
          <Package size={16} /> AlzaBox Data
        </Tab>
        
        {selectedCarrierId && (
          <>
            <Tab active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} count={planList?.length}>
              <Map size={16} /> Plány
            </Tab>
            <Tab active={activeTab === 'proofs'} onClick={() => setActiveTab('proofs')} count={allProofList?.length}>
              <FileSpreadsheet size={16} /> Proofy
            </Tab>
            <Tab active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} count={invoiceList?.length}>
              <FileText size={16} /> Faktury
            </Tab>
            <Tab active={activeTab === 'contracts'} onClick={() => setActiveTab('contracts')} count={contractList?.length}>
              <FileSignature size={16} /> Smlouvy
            </Tab>
          </>
        )}
      </div>

      {/* Warning - jen když není dopravce a nejsme na AlzaBox */}
      {!selectedCarrierId && activeTab !== 'alzabox' && (
        <div className="card p-6 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm text-gray-400">Pro plány, proofy, faktury a smlouvy vyberte dopravce</div>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone pro dopravce */}
      {selectedCarrierId && activeTab !== 'alzabox' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`card p-8 border-2 border-dashed transition-all ${
            dragOver ? 'border-alza-orange bg-alza-orange/5' : 'border-white/20 hover:border-white/40'
          }`}
        >
          <div className="text-center">
            <UploadIcon className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-alza-orange' : 'text-gray-500'}`} />
            <p className="text-lg font-medium mb-1">{isUploading ? 'Nahrávám...' : 'Přetáhněte soubory sem'}</p>
            <p className="text-gray-400 text-sm mb-4">nebo klikněte pro výběr</p>
            
            <input type="file" multiple accept=".xlsx,.xls,.pdf" onChange={(e) => handleCarrierFiles(e.target.files)}
              className="hidden" id="file-input-carrier" disabled={isUploading} />
            <label htmlFor="file-input-carrier"
              className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
              <UploadIcon size={18} /> Vybrat soubory
            </label>

            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><Map size={16} className="text-purple-400" /> Drivecool*.xlsx = Plán</div>
              <div className="flex items-center gap-1.5"><FileSpreadsheet size={16} className="text-green-400" /> *.xlsx = Proof</div>
              <div className="flex items-center gap-1.5"><FileText size={16} className="text-red-400" /> *.pdf = Faktura</div>
              <div className="flex items-center gap-1.5"><FileSignature size={16} className="text-blue-400" /> *smlouva*.pdf = Smlouva</div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Výsledky nahrávání</h2>
            <button onClick={() => setUploadResults([])} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>
          <div className="divide-y divide-white/5">
            {uploadResults.map((result, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center gap-3">
                {result.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{result.fileName}</div>
                  <div className={`text-xs ${result.success ? 'text-gray-400' : 'text-red-400'}`}>{result.message}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  result.type === 'plan' ? 'bg-purple-500/20 text-purple-400' : 
                  result.type === 'proof' ? 'bg-green-500/20 text-green-400' : 
                  result.type === 'invoice' ? 'bg-red-500/20 text-red-400' :
                  result.type === 'contract' ? 'bg-blue-500/20 text-blue-400' :
                  result.type.startsWith('alzabox') ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {result.type === 'plan' ? 'Plán' : result.type === 'proof' ? 'Proof' : result.type === 'invoice' ? 'Faktura' :
                   result.type === 'contract' ? 'Smlouva' : result.type === 'alzabox-locations' ? 'AlzaBoxy' :
                   result.type === 'alzabox-deliveries' ? 'Dojezdy' : 'Neznámý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === ALZABOX DATA === */}
      {activeTab === 'alzabox' && (
        <div className="space-y-6">
          {/* Drop Zone pro AlzaBox */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className={`card p-8 border-2 border-dashed transition-all ${
              dragOver ? 'border-cyan-500 bg-cyan-500/5' : 'border-white/20 hover:border-white/40'
            }`}
          >
            <div className="text-center">
              <Package className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-cyan-400' : 'text-gray-500'}`} />
              <p className="text-lg font-medium mb-1">{isUploading ? 'Nahrávám...' : 'Přetáhněte AlzaBox soubory sem'}</p>
              <p className="text-gray-400 text-sm mb-4">Data jsou globální - platí pro všechny dopravce</p>
              
              <input type="file" multiple accept=".xlsx,.xls" onChange={(e) => handleAlzaboxFiles(e.target.files)}
                className="hidden" id="file-input-alzabox" disabled={isUploading} />
              <label htmlFor="file-input-alzabox"
                className={`btn bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                <UploadIcon size={18} /> Vybrat soubory
              </label>

              <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><MapPin size={16} className="text-cyan-400" /> *location*.xlsx = Umístění boxů</div>
                <div className="flex items-center gap-1.5"><Clock size={16} className="text-green-400" /> *dojezd*.xlsx = Dojezdy k boxům</div>
              </div>
            </div>
          </div>

          {/* AlzaBox Summary */}
          <div className="card overflow-hidden">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Package size={18} className="text-cyan-400" /> AlzaBox Data</h2>
              <span className="text-sm text-gray-400">Globální data (všichni dopravci)</span>
            </div>
            
            {loadingAlzabox ? (
              <div className="p-8 text-center text-gray-500">Načítám...</div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-8 h-8 text-cyan-400" />
                      <div>
                        <div className="text-2xl font-bold">{alzaboxSummary?.total_boxes?.toLocaleString() || 0}</div>
                        <div className="text-sm text-gray-400">AlzaBoxů</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button onClick={() => { if (confirm('Smazat všechny boxy?')) deleteAlzaboxLocationsMutation.mutate() }}
                        disabled={deleteAlzaboxLocationsMutation.isPending || !alzaboxSummary?.total_boxes}
                        className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
                        <Trash2 size={14} /> Smazat
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-8 h-8 text-green-400" />
                      <div>
                        <div className="text-2xl font-bold">{alzaboxSummary?.total_deliveries?.toLocaleString() || 0}</div>
                        <div className="text-sm text-gray-400">Dojezdů</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button onClick={() => { if (confirm('Smazat všechny dojezdy?')) deleteAlzaboxDeliveriesMutation.mutate() }}
                        disabled={deleteAlzaboxDeliveriesMutation.isPending || !alzaboxSummary?.total_deliveries}
                        className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
                        <Trash2 size={14} /> Smazat
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className={`w-8 h-8 ${(alzaboxSummary?.on_time_rate || 0) >= 99 ? 'text-green-400' : (alzaboxSummary?.on_time_rate || 0) >= 95 ? 'text-yellow-400' : 'text-red-400'}`} />
                      <div>
                        <div className="text-2xl font-bold">{(alzaboxSummary?.on_time_rate || 0).toFixed(1)}%</div>
                        <div className="text-sm text-gray-400">Včasnost (cíl 99%)</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-cyan-400 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-cyan-400 mb-1">Globální data</div>
                      <div className="text-gray-400">
                        AlzaBox data (umístění boxů a dojezdy) jsou sdílená pro všechny dopravce. 
                        Filtrování podle dopravce probíhá při zobrazení statistik v sekci "AlzaBox BI".
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === PLÁNY === */}
      {selectedCarrierId && activeTab === 'plans' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAllPlans} className="text-gray-400 hover:text-white">
                {planList?.length > 0 && selectedPlans.size === planList.length ? <CheckSquare size={20} /> : 
                 selectedPlans.size > 0 ? <MinusSquare size={20} /> : <Square size={20} />}
              </button>
              <h2 className="font-semibold">Plánovací soubory</h2>
              {selectedPlans.size > 0 && <span className="text-sm text-gray-400">({selectedPlans.size} vybráno)</span>}
            </div>
            {selectedPlans.size > 0 && (
              <button onClick={handleDeleteSelectedPlans} disabled={deletePlansBatchMutation.isPending}
                className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30">
                <Trash2 size={16} /> Smazat ({selectedPlans.size})
              </button>
            )}
          </div>
          
          {loadingPlans ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !planList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné plánovací soubory</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {Object.entries(plansByYear).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, planItems]) => (
                <div key={year}>
                  <div className="px-4 py-2 bg-white/5 text-sm font-medium text-gray-400">{year} ({planItems.length})</div>
                  {planItems.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).map(plan => (
                    <div key={plan.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-white/5 ${selectedPlans.has(plan.id) ? 'bg-purple-500/5' : ''}`}>
                      <button onClick={() => togglePlanSelection(plan.id)} className="text-gray-400 hover:text-white">
                        {selectedPlans.has(plan.id) ? <CheckSquare size={18} className="text-purple-400" /> : <Square size={18} />}
                      </button>
                      <Map size={20} className="text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{plan.fileName}</span>
                          <PlanTypeBadge type={plan.planType} />
                          <DepotBadge depot={plan.depot} />
                        </div>
                        <div className="text-xs text-gray-500">
                          Od {formatDate(plan.validFrom)} {plan.routeCount && `• ${plan.routeCount} tras`}
                        </div>
                      </div>
                      <button onClick={() => { if (confirm(`Smazat?`)) deletePlanMutation.mutate(plan.id) }}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded">
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

      {/* === PROOFY === */}
      {selectedCarrierId && activeTab === 'proofs' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAllProofs} className="text-gray-400 hover:text-white">
                {allProofList?.length > 0 && selectedProofs.size === allProofList.length ? <CheckSquare size={20} /> : 
                 selectedProofs.size > 0 ? <MinusSquare size={20} /> : <Square size={20} />}
              </button>
              <h2 className="font-semibold">Proofy</h2>
              {selectedProofs.size > 0 && <span className="text-sm text-gray-400">({selectedProofs.size} vybráno)</span>}
            </div>
            {selectedProofs.size > 0 && (
              <button onClick={handleDeleteSelectedProofs} disabled={deleteProofsBatchMutation.isPending}
                className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30">
                <Trash2 size={16} /> Smazat ({selectedProofs.size})
              </button>
            )}
          </div>
          
          {loadingProofs ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !allProofList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné proofy</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {Object.entries(proofsByYear).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, proofItems]) => (
                <div key={year}>
                  <div className="px-4 py-2 bg-white/5 text-sm font-medium text-gray-400">{year} ({proofItems.length})</div>
                  {proofItems.sort((a, b) => b.period.localeCompare(a.period)).map(proof => (
                    <div key={proof.id} className={`px-4 py-3 hover:bg-white/5 ${selectedProofs.has(proof.id) ? 'bg-green-500/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleProofSelection(proof.id)} className="text-gray-400 hover:text-white">
                          {selectedProofs.has(proof.id) ? <CheckSquare size={18} className="text-green-400" /> : <Square size={18} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-500" />
                            <span className="font-medium text-sm">{proof.period}</span>
                            <span className="text-xs text-gray-500 truncate">({proof.fileName})</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-alza-orange">{formatCZK(proof.grandTotal)}</div>
                        <button onClick={() => { if (confirm(`Smazat?`)) deleteProofMutation.mutate(proof.id) }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="ml-9 mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-gray-500">FIX:</span> <span className="font-medium">{formatCZK(proof.totalFix)}</span></div>
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-gray-500">KM:</span> <span className="font-medium">{formatCZK(proof.totalKm)}</span></div>
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-gray-500">LH:</span> <span className="font-medium">{formatCZK(proof.totalLinehaul)}</span></div>
                        <div className="bg-white/5 rounded px-2 py-1"><span className="text-gray-500">Tras:</span> <span className="font-medium">{(proof.totalDpo || 0) + (proof.totalSd || 0)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === FAKTURY === */}
      {selectedCarrierId && activeTab === 'invoices' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Faktury — {selectedPeriod}</h2>
            <span className="text-sm text-gray-400">{invoiceList?.length || 0} faktur</span>
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
                <thead><tr><th>Číslo</th><th>Typ</th><th className="text-right">Bez DPH</th><th className="text-right">Celkem</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {invoiceList.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="font-medium">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {invoice.items?.map((item, idx) => (
                            <span key={idx} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                              {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right">{formatCZK(invoice.totalWithoutVat)}</td>
                      <td className="text-right font-medium">{formatCZK(invoice.totalWithVat)}</td>
                      <td>
                        <span className={`text-xs px-2 py-1 rounded ${
                          invoice.status === 'matched' ? 'bg-green-500/20 text-green-400' :
                          invoice.status === 'disputed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' : invoice.status === 'disputed' ? 'Sporná' : 'Kontrola'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => { if (confirm(`Smazat?`)) deleteInvoiceMutation.mutate(invoice.id) }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded">
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
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAllContracts} className="text-gray-400 hover:text-white">
                {contractList?.length > 0 && selectedContracts.size === contractList.length ? <CheckSquare size={20} /> : 
                 selectedContracts.size > 0 ? <MinusSquare size={20} /> : <Square size={20} />}
              </button>
              <h2 className="font-semibold">Smlouvy</h2>
              {selectedContracts.size > 0 && <span className="text-sm text-gray-400">({selectedContracts.size} vybráno)</span>}
            </div>
            {selectedContracts.size > 0 && (
              <button onClick={handleDeleteSelectedContracts} disabled={deleteContractsBatchMutation.isPending}
                className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30">
                <Trash2 size={16} /> Smazat ({selectedContracts.size})
              </button>
            )}
          </div>
          
          {loadingContracts ? (
            <div className="p-8 text-center text-gray-500">Načítám...</div>
          ) : !contractList?.length ? (
            <div className="p-8 text-center text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žádné smlouvy</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {contractList.map(contract => (
                <div key={contract.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-white/5 ${selectedContracts.has(contract.id) ? 'bg-blue-500/5' : ''}`}>
                  <button onClick={() => toggleContractSelection(contract.id)} className="text-gray-400 hover:text-white">
                    {selectedContracts.has(contract.id) ? <CheckSquare size={18} className="text-blue-400" /> : <Square size={18} />}
                  </button>
                  <FileSignature size={20} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{contract.name || contract.fileName || `Smlouva #${contract.id}`}</div>
                    <div className="text-xs text-gray-500">
                      {contract.validFrom && `Od ${formatDate(contract.validFrom)}`}
                      {contract.validTo && ` do ${formatDate(contract.validTo)}`}
                    </div>
                  </div>
                  <button onClick={() => { if (confirm(`Smazat?`)) deleteContractMutation.mutate(contract.id) }}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
