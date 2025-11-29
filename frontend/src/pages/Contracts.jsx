import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Upload as UploadIcon, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Building, 
  Calendar, 
  DollarSign,
  Sparkles,
  Info
} from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })


export default function Contracts() {
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [isPreviewMode, setIsPreviewMode] = useState(true)
  
  const queryClient = useQueryClient()

  const previewMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/contracts/parse-preview', formData)
      return data
    },
    onSuccess: (data) => {
      setPreview(data)
      setUploadResult(null)
    },
    onError: (error) => {
      setPreview(null)
      setUploadResult({
        success: false,
        message: error.response?.data?.error || 'Chyba při parsování PDF'
      })
    }
  })

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/contracts/upload-pdf', formData)
      return data
    },
    onSuccess: (data) => {
      setUploadResult(data)
      setPreview(null)
      queryClient.invalidateQueries(['carriers'])
      queryClient.invalidateQueries(['contracts'])
      queryClient.invalidateQueries(['prices'])
    },
    onError: (error) => {
      setUploadResult({
        success: false,
        message: error.response?.data?.error || 'Chyba při nahrávání'
      })
    }
  })

  const [selectedFile, setSelectedFile] = useState(null)

  const handleFiles = useCallback((files) => {
    const file = files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadResult({
        success: false,
        message: 'Pouze PDF soubory jsou podporovány'
      })
      return
    }

    setSelectedFile(file)
    setUploadResult(null)
    
    if (isPreviewMode) {
      previewMutation.mutate(file)
    } else {
      uploadMutation.mutate(file)
    }
  }, [isPreviewMode, previewMutation, uploadMutation])

  const handleConfirmUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

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

  const isLoading = previewMutation.isPending || uploadMutation.isPending

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nahrát smlouvu / dodatek</h1>
        <p className="text-gray-500 text-sm mt-1">PDF dodatku se automaticky zpracuje a vytvoří dopravce + ceník</p>
      </div>

      {/* Mode toggle */}
      <div className="card p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPreviewMode}
            onChange={(e) => setIsPreviewMode(e.target.checked)}
            className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Nejdříve zobrazit náhled</span>
            <p className="text-xs text-gray-500">Doporučeno - umožní zkontrolovat extrahovaná data před uložením</p>
          </div>
        </label>
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
        }`}
      >
        <div className="p-12 text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            dragOver ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <FileText size={28} className={dragOver ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {isLoading ? 'Zpracovávám...' : 'Přetáhněte PDF dodatku sem'}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            nebo klikněte pro výběr souboru
          </p>
          
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="contract-file-input"
            disabled={isLoading}
          />
          <label
            htmlFor="contract-file-input"
            className={`btn btn-primary cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <UploadIcon size={18} />
            Vybrat PDF
          </label>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="widget border-l-4 border-l-blue-500">
          <div className="widget-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Sparkles size={16} className="text-blue-600" />
              </div>
              <h3 className="widget-title">Náhled extrahovaných dat</h3>
            </div>
          </div>
          <div className="widget-body space-y-6">
            {/* Carrier Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building size={18} className="text-gray-400" />
                <h4 className="font-medium text-gray-900">Dopravce</h4>
                {preview.carrier.existsInDb && (
                  <span className="badge badge-success">Již existuje v DB</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-xs text-gray-500">Název</span>
                  <p className="font-medium text-gray-900">{preview.carrier.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">IČO</span>
                  <p className="font-medium text-gray-900">{preview.carrier.ico || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">DIČ</span>
                  <p className="font-medium text-gray-900">{preview.carrier.dic || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Adresa</span>
                  <p className="font-medium text-gray-900 text-sm">{preview.carrier.address || '—'}</p>
                </div>
              </div>
            </div>

            {/* Contract Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-gray-400" />
                <h4 className="font-medium text-gray-900">Smlouva</h4>
              </div>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-xs text-gray-500">Číslo</span>
                  <p className="font-medium text-gray-900">{preview.contract.number || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Typ služby</span>
                  <p className="font-medium text-gray-900">{preview.contract.serviceType || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Platnost od</span>
                  <p className="font-medium text-gray-900">
                    {preview.contract.validFrom 
                      ? new Date(preview.contract.validFrom).toLocaleDateString('cs-CZ')
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Rates */}
            {(preview.rates.fixRates.length > 0 || preview.rates.kmRates.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={18} className="text-gray-400" />
                  <h4 className="font-medium text-gray-900">
                    Extrahované sazby ({preview.rates.fixRates.length + preview.rates.kmRates.length})
                  </h4>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                  {preview.rates.fixRates.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">FIX sazby</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.rates.fixRates.map((rate, idx) => (
                          <span key={idx} className="badge badge-info">
                            {rate.routeType}: {rate.rate.toLocaleString('cs-CZ')} Kč
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.rates.kmRates.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">KM sazby</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.rates.kmRates.map((rate, idx) => (
                          <span key={idx} className="badge badge-success">
                            {rate.routeType}: {rate.rate} Kč/km
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.rates.depoRates.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">DEPO sazby</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.rates.depoRates.map((rate, idx) => (
                          <span key={idx} className="badge badge-warning">
                            {rate.depoName} ({rate.rateType}): {rate.rate.toLocaleString('cs-CZ')} Kč
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirm buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={handleConfirmUpload}
                disabled={uploadMutation.isPending}
                className="btn btn-primary flex-1"
              >
                <CheckCircle size={18} />
                {uploadMutation.isPending ? 'Ukládám...' : 'Potvrdit a uložit'}
              </button>
              <button
                onClick={() => {
                  setPreview(null)
                  setSelectedFile(null)
                }}
                className="btn btn-secondary"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {uploadResult.success ? 'Úspěšně uloženo!' : 'Chyba'}
                </h3>
                
                {uploadResult.success && uploadResult.data && (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Building size={18} className="text-gray-400" />
                      <span className="text-gray-500">Dopravce:</span>
                      <span className="font-medium text-gray-900">{uploadResult.data.carrier.name}</span>
                      {uploadResult.data.carrier.isNew && (
                        <span className="badge badge-success">Nový</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText size={18} className="text-gray-400" />
                      <span className="text-gray-500">Smlouva:</span>
                      <span className="font-medium text-gray-900">{uploadResult.data.contract.number}</span>
                      <span className="badge badge-info">{uploadResult.data.contract.type}</span>
                    </div>
                    {uploadResult.data.priceConfig && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <DollarSign size={18} className="text-gray-400" />
                        <span className="text-gray-500">Ceník:</span>
                        <span className="font-medium text-gray-900">
                          {uploadResult.data.priceConfig.fixRatesCount} FIX, {' '}
                          {uploadResult.data.priceConfig.kmRatesCount} KM
                        </span>
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

      {/* Info */}
      <div className="widget border-l-4 border-l-blue-500">
        <div className="widget-body">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Info size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Jak to funguje</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Nahrajte PDF dodatku ke smlouvě</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Systém automaticky extrahuje: IČO, název dopravce, číslo dodatku, datum platnosti, ceník</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Vytvoří se dopravce (pokud neexistuje) a smlouva s ceníkem</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Při nahrávání proofu/faktury se dopravce automaticky rozpozná podle IČO</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
