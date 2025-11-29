import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { Upload as UploadIcon, FileSpreadsheet, FileText, CheckCircle, AlertCircle, X, Trash2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()

  const { data: carrierList } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Fetch invoices for selected carrier and period
  const { data: invoiceList, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', selectedCarrier, selectedPeriod],
    queryFn: () => invoices.getAll({ 
      carrier_id: selectedCarrier, 
      period: selectedPeriod 
    }),
    enabled: !!selectedCarrier
  })

  // Fetch proofs for selected carrier and period
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
    if (confirm(`Opravdu smazat proof pro období "${proof.period}"? Toto může ovlivnit spárované faktury.`)) {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Nahrát dokumenty</h1>
        <p className="text-gray-400 text-sm mt-1">Proof (XLSX) nebo faktury (PDF)</p>
      </div>

      {/* Settings */}
      <div className="card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dopravce</label>
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`card p-12 border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-alza-orange bg-alza-orange/5' 
            : 'border-white/20 hover:border-white/40'
        } ${!selectedCarrier ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="text-center">
          <UploadIcon className={`w-16 h-16 mx-auto mb-4 ${dragOver ? 'text-alza-orange' : 'text-gray-500'}`} />
          
          <p className="text-lg font-medium mb-2">
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

          <div className="flex justify-center gap-8 mt-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-green-400" />
              XLSX = Proof
            </div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-red-400" />
              PDF = Faktura
            </div>
          </div>
        </div>
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Výsledky nahrávání</h2>
            <button
              onClick={() => setUploadResults([])}
              className="text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {uploadResults.map((result, idx) => (
              <div key={idx} className="px-6 py-4 flex items-center gap-4">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{result.fileName}</div>
                  <div className={`text-sm ${result.success ? 'text-gray-400' : 'text-red-400'}`}>
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
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Proof — {selectedPeriod}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/proof/${currentProof.id}`)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-alza-orange"
                title="Zobrazit detail"
              >
                <ExternalLink size={18} />
              </button>
              <button
                onClick={() => handleDeleteProof(currentProof)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400"
                title="Smazat proof"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">FIX:</span>
                <span className="ml-2 font-medium">{formatCZK(currentProof.totalFix)}</span>
              </div>
              <div>
                <span className="text-gray-400">KM:</span>
                <span className="ml-2 font-medium">{formatCZK(currentProof.totalKm)}</span>
              </div>
              <div>
                <span className="text-gray-400">Linehaul:</span>
                <span className="ml-2 font-medium">{formatCZK(currentProof.totalLinehaul)}</span>
              </div>
              <div>
                <span className="text-gray-400">Celkem:</span>
                <span className="ml-2 font-medium text-alza-orange">{formatCZK(currentProof.grandTotal)}</span>
              </div>
            </div>
            {currentProof.fileName && (
              <div className="mt-3 text-xs text-gray-500">
                Soubor: {currentProof.fileName}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices List */}
      {selectedCarrier && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Nahrané faktury — {selectedPeriod}</h2>
            <span className="badge badge-info">{invoiceList?.length || 0} faktur</span>
          </div>
          
          {loadingInvoices ? (
            <div className="p-8 text-center text-gray-500">
              Načítám...
            </div>
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
                    <th className="text-right">Částka bez DPH</th>
                    <th className="text-right">DPH</th>
                    <th className="text-right">Celkem</th>
                    <th>Status</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="font-medium">{invoice.invoiceNumber}</td>
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
                      <td className="text-right text-gray-400">{formatCZK(invoice.vatAmount)}</td>
                      <td className="text-right font-medium">{formatCZK(invoice.totalWithVat)}</td>
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
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-50"
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
