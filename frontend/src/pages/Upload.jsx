import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Trash2,
  Calendar,
  Truck,
  ArrowRight,
  MoreVertical,
  Sparkles
} from 'lucide-react'
import { proofs, invoices, carriers } from '../lib/api'

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

export default function Upload() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  
  const queryClient = useQueryClient()

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Auto-select first carrier
  if (carrierList?.length > 0 && !selectedCarrier) {
    setSelectedCarrier(carrierList[0].id.toString())
  }

  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrier, selectedPeriod],
    queryFn: () => invoices.getAll({ 
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
        message: error.response?.data?.detail || error.response?.data?.error || 'Chyba při nahrávání'
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
        message: error.response?.data?.detail || error.response?.data?.error || 'Chyba při nahrávání'
      }])
    }
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => invoices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices'])
    }
  })

  const deleteProofMutation = useMutation({
    mutationFn: (id) => proofs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['proofs'])
    }
  })

  const handleDeleteInvoice = (invoice) => {
    if (confirm(`Opravdu smazat fakturu "${invoice.invoiceNumber}"?`)) {
      deleteInvoiceMutation.mutate(invoice.id)
    }
  }

  const handleDeleteProof = (proof) => {
    if (confirm(`Opravdu smazat proof pro období "${proof.period}"?`)) {
      deleteProofMutation.mutate(proof.id)
    }
  }

  const handleFiles = useCallback((files) => {
    if (!selectedCarrier) {
      alert('Vyberte dopravce')
      return
    }

    Array.from(files).forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      
      if (ext === 'xlsx' || ext === 'xls') {
        uploadProofMutation.mutate({ file, carrierId: selectedCarrier, period: selectedPeriod })
      } else if (ext === 'pdf') {
        uploadInvoiceMutation.mutate({ file, carrierId: selectedCarrier, period: selectedPeriod })
      } else {
        setUploadResults(prev => [...prev, { 
          type: 'unknown', 
          fileName: file.name, 
          success: false,
          message: 'Nepodporovaný formát (pouze XLSX, PDF)'
        }])
      }
    })
  }, [selectedCarrier, selectedPeriod, uploadProofMutation, uploadInvoiceMutation])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const isUploading = uploadProofMutation.isPending || uploadInvoiceMutation.isPending
  const currentProof = proofList?.[0]

  const selectedCarrierName = carrierList?.find(c => c.id.toString() === selectedCarrier)?.name

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nahrát dokumenty</h1>
        <p className="text-gray-500 text-sm mt-1">Proof (XLSX) nebo faktury (PDF)</p>
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
                  {carrierList?.map(carrier => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="label">Období</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="select pl-10"
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
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
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
            <UploadIcon size={28} className={dragOver ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {isUploading ? 'Nahrávám...' : 'Přetáhněte soubory sem'}
          </p>
          <p className="text-gray-500 text-sm mb-6">
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
            className={`btn btn-primary cursor-pointer ${
              (!selectedCarrier || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat soubory
          </label>

          <div className="flex justify-center gap-8 mt-8">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet size={16} className="text-emerald-600" />
              </div>
              <span>XLSX = Proof</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <FileText size={16} className="text-rose-600" />
              </div>
              <span>PDF = Faktura</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="widget">
          <div className="widget-header">
            <h3 className="widget-title">Výsledky nahrávání</h3>
            <button
              onClick={() => setUploadResults([])}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X size={18} />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {uploadResults.map((result, idx) => (
              <div key={idx} className="px-5 py-4 flex items-center gap-4">
                {result.success ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle size={16} className="text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle size={16} className="text-red-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{result.fileName}</div>
                  <div className={`text-sm ${result.success ? 'text-gray-500' : 'text-red-600'}`}>
                    {result.message}
                  </div>
                </div>
                <span className={`badge ${
                  result.type === 'proof' ? 'badge-success' : 
                  result.type === 'invoice' ? 'badge-info' : 
                  'badge-error'
                }`}>
                  {result.type === 'proof' ? 'Proof' : 
                   result.type === 'invoice' ? 'Faktura' : 
                   'Neznámý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Proof */}
      {selectedCarrier && currentProof && (
        <div className="widget">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Sparkles size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="widget-title">Proof — {selectedPeriod}</h3>
                <p className="widget-subtitle">{selectedCarrierName}</p>
              </div>
            </div>
            <button
              onClick={() => handleDeleteProof(currentProof)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Smazat proof"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="widget-body">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-medium mb-1">FIX</p>
                <p className="text-lg font-bold text-gray-900">{formatCZK(currentProof.totalFix)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs text-emerald-600 font-medium mb-1">KM</p>
                <p className="text-lg font-bold text-gray-900">{formatCZK(currentProof.totalKm)}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-600 font-medium mb-1">Linehaul</p>
                <p className="text-lg font-bold text-gray-900">{formatCZK(currentProof.totalLinehaul)}</p>
              </div>
              <div className="p-4 bg-violet-50 rounded-xl">
                <p className="text-xs text-violet-600 font-medium mb-1">Celkem</p>
                <p className="text-lg font-bold text-gray-900">{formatCZK(currentProof.grandTotal)}</p>
              </div>
            </div>
            {currentProof.fileName && (
              <p className="text-sm text-gray-500 mt-4">
                Soubor: {currentProof.fileName}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Invoices List */}
      {selectedCarrier && (
        <div className="widget">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <FileText size={16} className="text-violet-600" />
              </div>
              <div>
                <h3 className="widget-title">Nahrané faktury — {selectedPeriod}</h3>
                <p className="widget-subtitle">{selectedCarrierName}</p>
              </div>
            </div>
            <span className="badge badge-info">{invoiceList?.length || 0} faktur</span>
          </div>
          
          {loadingInvoices ? (
            <div className="p-8 text-center text-gray-500">
              Načítám...
            </div>
          ) : !invoiceList?.length ? (
            <div className="p-8 text-center">
              <FileText size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Žádné faktury pro toto období</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Číslo faktury</th>
                    <th>Typ</th>
                    <th className="text-right">Částka bez DPH</th>
                    <th className="text-right">DPH</th>
                    <th className="text-right">Celkem</th>
                    <th>Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="font-medium text-gray-900">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {invoice.items?.map((item, idx) => (
                            <span key={idx} className="badge badge-info">
                              {(item.itemType || '').replace('ALZABOXY ', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right">{formatCZK(invoice.totalWithoutVat)}</td>
                      <td className="text-right text-gray-500">{formatCZK(invoice.vatAmount)}</td>
                      <td className="text-right font-medium text-gray-900">{formatCZK(invoice.totalWithVat)}</td>
                      <td>
                        <span className={`badge ${
                          invoice.status === 'matched' ? 'badge-success' :
                          invoice.status === 'disputed' ? 'badge-error' :
                          'badge-warning'
                        }`}>
                          {invoice.status === 'matched' ? 'Spárováno' :
                           invoice.status === 'disputed' ? 'Sporná' :
                           'Ke kontrole'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          disabled={deleteInvoiceMutation.isPending}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          title="Smazat fakturu"
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
