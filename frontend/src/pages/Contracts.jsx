import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Building, Calendar, DollarSign } from 'lucide-react'
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
      <div>
        <h1 className="text-2xl font-bold">Nahrát smlouvu / dodatek</h1>
        <p className="text-gray-400 text-sm mt-1">PDF dodatku se automaticky zpracuje a vytvoří dopravce + ceník</p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPreviewMode}
            onChange={(e) => setIsPreviewMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-alza-orange focus:ring-alza-orange"
          />
          <span className="text-sm text-gray-300">Nejdříve zobrazit náhled (doporučeno)</span>
        </label>
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
        }`}
      >
        <div className="text-center">
          <FileText className={`w-16 h-16 mx-auto mb-4 ${dragOver ? 'text-alza-orange' : 'text-gray-500'}`} />
          
          <p className="text-lg font-medium mb-2">
            {isLoading ? 'Zpracovávám...' : 'Přetáhněte PDF dodatku sem'}
          </p>
          <p className="text-gray-400 text-sm mb-4">
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
            className={`btn btn-primary inline-flex items-center gap-2 cursor-pointer ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <UploadIcon size={18} />
            Vybrat PDF
          </label>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="card overflow-hidden">
          <div className="card-header bg-blue-500/10">
            <h2 className="font-semibold text-blue-400">📋 Náhled extrahovaných dat</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Carrier Info */}
            <div>
              <h3 className="font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Building size={18} />
                Dopravce
                {preview.carrier.existsInDb && (
                  <span className="badge badge-success ml-2">Již existuje v DB</span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-lg">
                <div>
                  <span className="text-sm text-gray-500">Název:</span>
                  <p className="font-medium">{preview.carrier.name || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">IČO:</span>
                  <p className="font-medium">{preview.carrier.ico || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">DIČ:</span>
                  <p className="font-medium">{preview.carrier.dic || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Adresa:</span>
                  <p className="font-medium text-sm">{preview.carrier.address || '—'}</p>
                </div>
              </div>
            </div>

            {/* Contract Info */}
            <div>
              <h3 className="font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Calendar size={18} />
                Smlouva
              </h3>
              <div className="grid grid-cols-3 gap-4 bg-black/20 p-4 rounded-lg">
                <div>
                  <span className="text-sm text-gray-500">Číslo:</span>
                  <p className="font-medium">{preview.contract.number || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Typ služby:</span>
                  <p className="font-medium">{preview.contract.serviceType || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Platnost od:</span>
                  <p className="font-medium">
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
                <h3 className="font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <DollarSign size={18} />
                  Extrahované sazby ({preview.rates.fixRates.length + preview.rates.kmRates.length})
                </h3>
                <div className="bg-black/20 p-4 rounded-lg">
                  {preview.rates.fixRates.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">FIX sazby:</p>
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
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">KM sazby:</p>
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
                      <p className="text-sm text-gray-500 mb-2">DEPO sazby:</p>
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

            {/* Confirm button */}
            <div className="flex gap-4 pt-4 border-t border-white/10">
              <button
                onClick={handleConfirmUpload}
                disabled={uploadMutation.isPending}
                className="btn btn-primary flex-1"
              >
                {uploadMutation.isPending ? 'Ukládám...' : '✓ Potvrdit a uložit do databáze'}
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
        <div className={`card p-6 ${uploadResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-start gap-4">
            {uploadResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${uploadResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {uploadResult.success ? 'Úspěšně uloženo!' : 'Chyba'}
              </h3>
              
              {uploadResult.success && uploadResult.data && (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-gray-500" />
                    <span className="text-gray-400">Dopravce:</span>
                    <span className="font-medium">{uploadResult.data.carrier.name}</span>
                    {uploadResult.data.carrier.isNew && (
                      <span className="badge badge-success">Nový</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-500" />
                    <span className="text-gray-400">Smlouva:</span>
                    <span className="font-medium">{uploadResult.data.contract.number}</span>
                    <span className="text-gray-500">({uploadResult.data.contract.type})</span>
                  </div>
                  {uploadResult.data.priceConfig && (
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-gray-500" />
                      <span className="text-gray-400">Ceník:</span>
                      <span className="font-medium">
                        {uploadResult.data.priceConfig.fixRatesCount} FIX sazeb,{' '}
                        {uploadResult.data.priceConfig.kmRatesCount} KM sazeb
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {!uploadResult.success && (
                <p className="text-gray-400 mt-1">{uploadResult.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card p-6 bg-blue-500/5 border-blue-500/20">
        <h3 className="font-semibold text-blue-400 mb-3">💡 Jak to funguje</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>1. Nahrajte PDF dodatku ke smlouvě</li>
          <li>2. Systém automaticky extrahuje: IČO, název dopravce, číslo dodatku, datum platnosti, ceník</li>
          <li>3. Vytvoří se dopravce (pokud neexistuje) a smlouva s ceníkem</li>
          <li>4. Při nahrávání proofu/faktury se dopravce automaticky rozpozná podle IČO</li>
        </ul>
      </div>
    </div>
  )
}
