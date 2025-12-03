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
  const { selectedCarrierId, selectedPeriod } = useCarrier()
  
  const [activeTab, setActiveTab] = useState('plans') // 'plans', 'proofs', 'invoices', 'contracts', 'alzabox'
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  const [selectedPlans, setSelectedPlans] = useState(new Set())
  const [selectedProofs, setSelectedProofs] = useState(new Set())
  const [selectedContracts, setSelectedContracts] = useState(new Set())
  
  // AlzaBox upload state
  const [alzaboxUploadType, setAlzaboxUploadType] = useState('locations') // 'locations' nebo 'deliveries'
  const [alzaboxDeliveryType, setAlzaboxDeliveryType] = useState('DPO') // 'DPO', 'SD', 'THIRD'
  
  const queryClient = useQueryClient()

  // Route Plans - všechny pro dopravce
  const { data: planList, isLoading: loadingPlans } = useQuery({
    queryKey: ['route-plans', selectedCarrierId],
    queryFn: () => routePlans.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Proofy - VŠECHNY pro dopravce (bez filtru období)
  const { data: allProofList, isLoading: loadingProofs } = useQuery({
    queryKey: ['proofs-all', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Invoices - pro dopravce a období
  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrierId, selectedPeriod],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrierId, period: selectedPeriod }),
    enabled: !!selectedCarrierId
  })

  // Contracts - všechny pro dopravce
  const { data: contractList, isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', selectedCarrierId],
    queryFn: () => contracts.getAll(selectedCarrierId),
    enabled: !!selectedCarrierId
  })

  // AlzaBox stats
  const { data: alzaboxCountries } = useQuery({
    queryKey: ['alzabox-countries'],
    queryFn: () => alzabox.getCountries()
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

  // AlzaBox upload mutations
  const uploadAlzaboxLocationsMutation = useMutation({
    mutationFn: ({ file }) => alzabox.importLocations(file),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-locations', 
        fileName: variables.file.name, 
        success: true,
        message: `Naimportováno: ${data.boxes_created} nových, ${data.boxes_updated} aktualizováno`
      }])
      queryClient.invalidateQueries(['alzabox-countries'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-locations', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při importu'
      }])
    }
  })

  const uploadAlzaboxDeliveriesMutation = useMutation({
    mutationFn: ({ file, deliveryType }) => alzabox.importDeliveries(file, deliveryType),
    onSuccess: (data, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-deliveries', 
        fileName: variables.file.name, 
        success: true,
        message: `Naimportováno: ${data.deliveries_created} nových, ${data.deliveries_updated} aktualizováno, ${data.dates_processed} dní`
      }])
      queryClient.invalidateQueries(['alzabox'])
    },
    onError: (error, variables) => {
      setUploadResults(prev => [...prev, { 
        type: 'alzabox-deliveries', 
        fileName: variables.file.name, 
        success: false,
        message: error.response?.data?.detail || 'Chyba při importu'
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
    if (!selectedCarrierId && activeTab !== 'alzabox') {
      alert('Vyberte dopravce')
      return
    }

    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase()
      const ext = fileName.split('.').pop()
      
      // Rozpoznání typu souboru
      if (ext === 'pdf') {
        // PDF - rozlišit fakturu vs smlouvu
        if (fileName.includes('smlouva') || fileName.includes('contract') || fileName.includes('ramcova')) {
          uploadContractMutation.mutate({ file, carrierId: selectedCarrierId })
        } else {
          uploadInvoiceMutation.mutate({ file, carrierId: selectedCarrierId, period: selectedPeriod })
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        // Excel - rozlišit podle názvu
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
  }, [selectedCarrierId, selectedPeriod, uploadPlanMutation, uploadProofMutation, uploadInvoiceMutation, uploadContractMutation, activeTab])

  // AlzaBox file handling
  const handleAlzaboxFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      const ext = file.name.toLowerCase().split('.').pop()
      
      if (ext !== 'xlsx' && ext !== 'xls') {
        setUploadResults(prev => [...prev, { 
          type: 'alzabox', 
          fileName: file.name, 
          success: false,
          message: 'Nepodporovaný formát (pouze XLSX)'
        }])
        return
      }

      if (alzaboxUploadType === 'locations') {
        uploadAlzaboxLocationsMutation.mutate({ file })
      } else {
        uploadAlzaboxDeliveriesMutation.mutate({ file, deliveryType: alzaboxDeliveryType })
      }
    })
  }, [alzaboxUploadType, alzaboxDeliveryType, uploadAlzaboxLocationsMutation, uploadAlzaboxDeliveriesMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    if (activeTab === 'alzabox') {
      handleAlzaboxFiles(e.dataTransfer.files)
    } else {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles, handleAlzaboxFiles, activeTab])

  // Selection helpers - Plans
  const togglePlanSelection = (id) => {
    const newSelected = new Set(selectedPlans)
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id)
    setSelectedPlans(newSelected)
  }

  const toggleSelectAllPlans = () => {
    if (!planList) return
    setSelectedPlans(selectedPlans.size === planList.length ? new Set() : new Set(planList.map(p => p.id)))
  }

  // Selection helpers - Proofs
  const toggleProofSelection = (id) => {
    const newSelected = new Set(selectedProofs)
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id)
    setSelectedProofs(newSelected)
  }

  const toggleSelectAllProofs = () => {
    if (!allProofList) return
    setSelectedProofs(selectedProofs.size === allProofList.length ? new Set() : new Set(allProofList.map(p => p.id)))
  }

  // Selection helpers - Contracts
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

  // Group plans by year
  const plansByYear = planList?.reduce((acc, plan) => {
    const year = plan.validFrom ? new Date(plan.validFrom).getFullYear() : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(plan)
    return acc
  }, {}) || {}

  // Group proofs by year
  const proofsByYear = allProofList?.reduce((acc, proof) => {
    const year = proof.period ? '20' + proof.period.split('/')[1] : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(proof)
    return acc
  }, {}) || {}

  const isUploading = uploadPlanMutation.isPending || uploadProofMutation.isPending || 
                      uploadInvoiceMutation.isPending || uploadContractMutation.isPending ||
                      uploadAlzaboxLocationsMutation.isPending || uploadAlzaboxDeliveriesMutation.isPending

  // Total alzabox count
  const totalAlzaboxes = alzaboxCountries?.reduce((sum, c) => sum + c.boxCount, 0) || 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dokumenty</h1>
        <p className="text-gray-400 text-sm mt-1">Nahrávejte a spravujte plány, proofy, faktury, smlouvy a AlzaBox data</p>
      </div>

      {/* Warning if no carrier selected (except for AlzaBox tab) */}
      {!selectedCarrierId && activeTab !== 'alzabox' && (
        <div className="card p-6 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm text-gray-400">Pro zobrazení a nahrávání dokumentů vyberte dopravce v horním menu</div>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone - for carrier-dependent tabs */}
      {selectedCarrierId && activeTab !== 'alzabox' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`card p-8 border-2 border-dashed transition-all ${
            dragOver 
              ? 'border-alza-orange bg-alza-orange/5' 
              : 'border-white/20 hover:border-white/40'
          }`}
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
              disabled={isUploading}
            />
            <label
              htmlFor="file-input"
              className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <UploadIcon size={18} />
              Vybrat soubory
            </label>

          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
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
            <div className="flex items-center gap-1.5">
              <FileSignature size={16} className="text-blue-400" />
              *smlouva*.pdf = Smlouva
            </div>
          </div>
        </div>
      </div>
      )}

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
                <span className={`text-xs px-2 py-1 rounded ${
                  result.type === 'plan' ? 'bg-purple-500/20 text-purple-400' : 
                  result.type === 'proof' ? 'bg-green-500/20 text-green-400' : 
                  result.type === 'invoice' ? 'bg-red-500/20 text-red-400' : 
                  result.type === 'contract' ? 'bg-blue-500/20 text-blue-400' :
                  result.type.startsWith('alzabox') ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {result.type === 'plan' ? 'Plán' :
                   result.type === 'proof' ? 'Proof' : 
                   result.type === 'invoice' ? 'Faktura' : 
                   result.type === 'contract' ? 'Smlouva' :
                   result.type === 'alzabox-locations' ? 'AB Lokace' :
                   result.type === 'alzabox-deliveries' ? 'AB Dojezdy' :
                   'Neznámý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
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
        <Tab active={activeTab === 'alzabox'} onClick={() => setActiveTab('alzabox')} count={totalAlzaboxes}>
          <Package size={16} /> AlzaBox
        </Tab>
      </div>

      {/* === ALZABOX === */}
      {activeTab === 'alzabox' && (
        <div className="space-y-6">
          {/* AlzaBox Upload Section */}
          <div className="card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="text-cyan-400" size={20} />
              Import AlzaBox dat
            </h2>
            
            {/* Upload Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setAlzaboxUploadType('locations')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  alzaboxUploadType === 'locations'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className={alzaboxUploadType === 'locations' ? 'text-cyan-400' : 'text-gray-500'} size={24} />
                  <span className="font-medium">Umístění boxů</span>
                </div>
                <p className="text-sm text-gray-400">
                  Import GPS souřadnic, měst, krajů, dopravců
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Soubor: AB_umisteni_a_dalsi_data.xlsx
                </p>
              </button>

              <button
                onClick={() => setAlzaboxUploadType('deliveries')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  alzaboxUploadType === 'deliveries'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Clock className={alzaboxUploadType === 'deliveries' ? 'text-cyan-400' : 'text-gray-500'} size={24} />
                  <span className="font-medium">Dojezdy (plán vs realita)</span>
                </div>
                <p className="text-sm text-gray-400">
                  Import plánovaných a skutečných časů doručení
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Soubor: AB_dojezdy_plan_vs_realita.xlsx
                </p>
              </button>
            </div>

            {/* Delivery Type Selection (only for deliveries) */}
            {alzaboxUploadType === 'deliveries' && (
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Typ závozu:</label>
                <div className="flex gap-2">
                  {[
                    { value: 'DPO', label: 'DPO (ranní)', color: 'blue' },
                    { value: 'SD', label: 'SD (odpolední)', color: 'orange' },
                    { value: 'THIRD', label: '3. závoz', color: 'purple' }
                  ].map(({ value, label, color }) => (
                    <button
                      key={value}
                      onClick={() => setAlzaboxDeliveryType(value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        alzaboxDeliveryType === value
                          ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/50`
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Drop Zone for AlzaBox */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              className={`p-8 border-2 border-dashed rounded-lg transition-all ${
                dragOver 
                  ? 'border-cyan-500 bg-cyan-500/5' 
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <div className="text-center">
                <UploadIcon className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-cyan-400' : 'text-gray-500'}`} />
                
                <p className="font-medium mb-1">
                  {isUploading ? 'Importuji...' : 'Přetáhněte XLSX soubor sem'}
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  {alzaboxUploadType === 'locations' 
                    ? 'Import umístění AlzaBoxů' 
                    : `Import dojezdů (${alzaboxDeliveryType})`}
                </p>
                
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleAlzaboxFiles(e.target.files)}
                  className="hidden"
                  id="alzabox-file-input"
                  disabled={isUploading}
                />
                <label
                  htmlFor="alzabox-file-input"
                  className={`btn inline-flex items-center gap-2 cursor-pointer ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{ backgroundColor: 'var(--color-cyan)', color: 'black' }}
                >
                  <UploadIcon size={18} />
                  Vybrat soubor
                </label>
              </div>
            </div>
          </div>

          {/* AlzaBox Stats */}
          {alzaboxCountries && alzaboxCountries.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Naimportované AlzaBoxy</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {alzaboxCountries.map(c => (
                  <div 
                    key={c.country}
                    className="p-4 rounded-lg bg-white/5 text-center"
                  >
                    <div className="text-2xl mb-1">
                      {c.country === 'CZ' ? '🇨🇿' : 
                       c.country === 'SK' ? '🇸🇰' : 
                       c.country === 'HU' ? '🇭🇺' : 
                       c.country === 'AT' ? '🇦🇹' : 
                       c.country === 'DE' ? '🇩🇪' : '🌍'}
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">{c.boxCount.toLocaleString('cs-CZ')}</div>
                    <div className="text-sm text-gray-400">{c.country}</div>
                  </div>
                ))}
                <div className="p-4 rounded-lg bg-cyan-500/10 text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-2xl font-bold text-white">{totalAlzaboxes.toLocaleString('cs-CZ')}</div>
                  <div className="text-sm text-gray-400">Celkem</div>
                </div>
              </div>
            </div>
          )}
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
              {Object.entries(plansByYear).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, plans]) => (
                <div key={year}>
                  <div className="px-4 py-2 bg-white/5 text-sm font-medium text-gray-400">{year} ({plans.length})</div>
                  {plans.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).map(plan => (
                    <div key={plan.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-white/5 ${selectedPlans.has(plan.id) ? 'bg-purple-500/5' : ''}`}>
                      <button onClick={() => togglePlanSelection(plan.id)} className="text-gray-400 hover:text-white">
                        {selectedPlans.has(plan.id) ? <CheckSquare size={18} className="text-purple-400" /> : <Square size={18} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{plan.fileName}</span>
                          <PlanTypeBadge type={plan.planType} />
                          <DepotBadge depot={plan.depot} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Od {formatDate(plan.validFrom)} • {plan.totalRoutes} tras
                        </div>
                      </div>
                      <button onClick={() => { if (confirm(`Smazat "${plan.fileName}"?`)) deletePlanMutation.mutate(plan.id) }}
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
                        <button onClick={() => { if (confirm(`Smazat proof "${proof.period}"?`)) deleteProofMutation.mutate(proof.id) }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="ml-9 mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div className="bg-white/5 rounded px-2 py-1">
                          <span className="text-gray-500">FIX:</span> <span className="font-medium">{formatCZK(proof.totalFix)}</span>
                        </div>
                        <div className="bg-white/5 rounded px-2 py-1">
                          <span className="text-gray-500">KM:</span> <span className="font-medium">{formatCZK(proof.totalKm)}</span>
                        </div>
                        <div className="bg-white/5 rounded px-2 py-1">
                          <span className="text-gray-500">LH:</span> <span className="font-medium">{formatCZK(proof.totalLinehaul)}</span>
                        </div>
                        <div className="bg-white/5 rounded px-2 py-1">
                          <span className="text-gray-500">Tras:</span> <span className="font-medium">{(proof.totalDpo || 0) + (proof.totalSd || 0)}</span>
                        </div>
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
                          invoice.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {invoice.status === 'matched' ? 'OK' : invoice.status === 'disputed' ? 'Sporná' : 'Kontrola'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => { if (confirm(`Smazat fakturu "${invoice.invoiceNumber}"?`)) deleteInvoiceMutation.mutate(invoice.id) }}
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
              <p className="text-sm mt-1">Nahrajte PDF soubory obsahující "smlouva" v názvu</p>
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
                  <button onClick={() => { if (confirm(`Smazat smlouvu?`)) deleteContractMutation.mutate(contract.id) }}
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
