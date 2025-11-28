import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { Upload as UploadIcon, FileSpreadsheet, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { proofs, invoices, carriers } from '../lib/api'

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
        message: error.response?.data?.error || 'Chyba při nahrávání'
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
        message: error.response?.data?.error || 'Chyba při nahrávání'
      }])
    }
  })

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
    </div>
  )
}
