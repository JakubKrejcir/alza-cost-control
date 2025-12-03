import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Truck, Plus, Edit2, Trash2, Building, FileText, X, 
  Upload, Check, AlertCircle, Loader2, File
} from 'lucide-react'
import { carriers, depots, contracts } from '../lib/api'

export default function Carriers() {
  const [showModal, setShowModal] = useState(false)
  const [editingCarrier, setEditingCarrier] = useState(null)
  const [formData, setFormData] = useState({ name: '', ico: '', dic: '', address: '', contact: '' })
  
  // State pro upload smlouvy
  const [uploadMode, setUploadMode] = useState(false) // false = ruční, true = ze smlouvy
  const [isParsingPdf, setIsParsingPdf] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  
  const queryClient = useQueryClient()

  const { data: carrierList, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  const createMutation = useMutation({
    mutationFn: carriers.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
      closeModal()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => carriers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
      closeModal()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: carriers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
    }
  })

  // Mutation pro vytvoření dopravce ze smlouvy (upload-pdf vytvoří vše)
  const createFromContractMutation = useMutation({
    mutationFn: async ({ file, carrierData }) => {
      // 1. Vytvoř dopravce
      const carrier = await carriers.create(carrierData)
      
      // 2. Nahraj smlouvu k novému dopravci
      await contracts.upload(file, carrier.id)
      
      return carrier
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
      queryClient.invalidateQueries(['contracts'])
      closeModal()
    }
  })

  const openModal = (carrier = null) => {
    if (carrier) {
      setEditingCarrier(carrier)
      setFormData({
        name: carrier.name || '',
        ico: carrier.ico || '',
        dic: carrier.dic || '',
        address: carrier.address || '',
        contact: carrier.contact || ''
      })
      setUploadMode(false)
    } else {
      setEditingCarrier(null)
      setFormData({ name: '', ico: '', dic: '', address: '', contact: '' })
      setUploadMode(false)
    }
    setParsedData(null)
    setParseError(null)
    setSelectedFile(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCarrier(null)
    setFormData({ name: '', ico: '', dic: '', address: '', contact: '' })
    setUploadMode(false)
    setParsedData(null)
    setParseError(null)
    setSelectedFile(null)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Vyberte prosím PDF soubor')
      return
    }
    
    setSelectedFile(file)
    setIsParsingPdf(true)
    setParseError(null)
    setParsedData(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/contracts/parse-preview`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': import.meta.env.VITE_API_KEY || ''
          },
          body: formData
        }
      )
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Chyba při parsování PDF')
      }
      
      const data = await response.json()
      setParsedData(data)
      
      // Vyplň formulář extrahovanými daty
      setFormData({
        name: data.carrier?.name || '',
        ico: data.carrier?.ico || '',
        dic: data.carrier?.dic || '',
        address: data.carrier?.address || '',
        contact: data.carrier?.bankAccount || ''
      })
      
    } catch (err) {
      console.error('Parse error:', err)
      setParseError(err.message || 'Nepodařilo se zpracovat PDF')
    } finally {
      setIsParsingPdf(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (editingCarrier) {
      updateMutation.mutate({ id: editingCarrier.id, data: formData })
    } else if (uploadMode && selectedFile) {
      // Vytvoř dopravce a nahraj smlouvu
      createFromContractMutation.mutate({
        file: selectedFile,
        carrierData: formData
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (carrier) => {
    if (confirm(`Opravdu smazat dopravce "${carrier.name}"?`)) {
      deleteMutation.mutate(carrier.id)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending || createFromContractMutation.isPending

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>Dopravci</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Správa dopravců a dep</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          Přidat dopravce
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Načítám...
        </div>
      ) : carrierList?.length === 0 ? (
        <div className="card p-8 text-center">
          <Truck className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Žádní dopravci</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            Přidat prvního dopravce
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {carrierList?.map(carrier => (
            <div key={carrier.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-dark)' }}>
                      {carrier.name}
                    </h3>
                    <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {carrier.ico && <span>IČO: {carrier.ico}</span>}
                      {carrier.ico && carrier.dic && <span className="mx-2">•</span>}
                      {carrier.dic && <span>DIČ: {carrier.dic}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(carrier)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(carrier)}
                    className="p-2 rounded-lg hover:bg-red-50"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Stats */}
              <div className="flex gap-6 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <Building size={16} />
                  {carrier.depots?.length || 0} dep
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <FileText size={16} />
                  {carrier.proofsCount || 0} proofů
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <FileText size={16} />
                  {carrier.invoicesCount || 0} faktur
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <FileText size={16} />
                  {carrier.contractsCount || 0} smluv
                </div>
              </div>
              
              {/* Depots */}
              {carrier.depots?.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                  <div className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Depa:</div>
                  <div className="flex flex-wrap gap-2">
                    {carrier.depots.map(depot => (
                      <span key={depot.id} className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                        {depot.name}
                        {depot.code && ` (${depot.code})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                {editingCarrier ? 'Upravit dopravce' : 'Nový dopravce'}
              </h2>
              <button onClick={closeModal} style={{ color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {/* Přepínač režimu - pouze při vytváření nového */}
              {!editingCarrier && (
                <div className="mb-6">
                  <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMode(false)
                        setParsedData(null)
                        setParseError(null)
                        setSelectedFile(null)
                      }}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        !uploadMode ? 'text-white' : ''
                      }`}
                      style={{ 
                        backgroundColor: !uploadMode ? 'var(--color-primary)' : 'transparent',
                        color: !uploadMode ? 'white' : 'var(--color-text-muted)'
                      }}
                    >
                      Zadat ručně
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode(true)}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        uploadMode ? 'text-white' : ''
                      }`}
                      style={{ 
                        backgroundColor: uploadMode ? 'var(--color-primary)' : 'transparent',
                        color: uploadMode ? 'white' : 'var(--color-text-muted)'
                      }}
                    >
                      Načíst ze smlouvy
                    </button>
                  </div>
                </div>
              )}

              {/* Upload smlouvy */}
              {uploadMode && !editingCarrier && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Nahrát smlouvu (PDF)
                  </label>
                  
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                    style={{ 
                      borderColor: parseError ? 'var(--color-red)' : selectedFile ? 'var(--color-green)' : 'var(--color-border)',
                      backgroundColor: selectedFile ? 'var(--color-green-light)' : 'var(--color-bg)'
                    }}
                  >
                    {isParsingPdf ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>Analyzuji smlouvu...</span>
                      </div>
                    ) : selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <File className="w-8 h-8" style={{ color: 'var(--color-green)' }} />
                        <span className="font-medium" style={{ color: 'var(--color-green)' }}>
                          {selectedFile.name}
                        </span>
                        {parsedData && (
                          <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-green)' }}>
                            <Check size={14} /> Data extrahována
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null)
                            setParsedData(null)
                            setFormData({ name: '', ico: '', dic: '', address: '', contact: '' })
                          }}
                          className="text-sm underline mt-1"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Změnit soubor
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                        <p style={{ color: 'var(--color-text-muted)' }}>
                          Přetáhněte PDF sem nebo
                        </p>
                        <label className="btn btn-secondary mt-2 cursor-pointer inline-flex items-center gap-2">
                          <Upload size={16} />
                          Vybrat soubor
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                      </>
                    )}
                  </div>
                  
                  {parseError && (
                    <div className="mt-2 p-3 rounded-lg flex items-center gap-2"
                      style={{ backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>
                      <AlertCircle size={16} />
                      <span className="text-sm">{parseError}</span>
                    </div>
                  )}

                  {/* Náhled extrahovaných sazeb */}
                  {parsedData?.rates && (
                    <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-dark)' }}>
                        Extrahované sazby (budou přidány do ceníku):
                      </h4>
                      <div className="text-sm space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                        {parsedData.rates.fixRates?.length > 0 && (
                          <div>FIX: {parsedData.rates.fixRates.map(r => `${r.routeType}: ${r.rate} Kč`).join(', ')}</div>
                        )}
                        {parsedData.rates.kmRates?.length > 0 && (
                          <div>KM: {parsedData.rates.kmRates.map(r => `${r.rate} Kč/km`).join(', ')}</div>
                        )}
                        {parsedData.rates.depoRates?.length > 0 && (
                          <div>DEPO: {parsedData.rates.depoRates.map(r => `${r.depoName}: ${r.rate} Kč`).join(', ')}</div>
                        )}
                        {!parsedData.rates.fixRates?.length && !parsedData.rates.kmRates?.length && !parsedData.rates.depoRates?.length && (
                          <div>Žádné sazby nebyly nalezeny</div>
                        )}
                      </div>
                      {parsedData.contract && (
                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Smlouva: </span>
                          <span style={{ color: 'var(--color-text-dark)' }}>
                            {parsedData.contract.number || 'Neznámá'}
                            {parsedData.contract.serviceType && ` (${parsedData.contract.serviceType})`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Formulář */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Název *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    required
                    placeholder="Název dopravce"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      IČO
                    </label>
                    <input
                      type="text"
                      value={formData.ico}
                      onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                      className="input w-full"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      DIČ
                    </label>
                    <input
                      type="text"
                      value={formData.dic}
                      onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                      className="input w-full"
                      placeholder="CZ12345678"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Adresa
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input w-full"
                    placeholder="Ulice, město, PSČ"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Kontakt / Bankovní účet
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="input w-full"
                    placeholder="Email, telefon nebo číslo účtu"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                    Zrušit
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={isSubmitting || (uploadMode && !selectedFile)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Ukládám...
                      </>
                    ) : uploadMode && selectedFile ? (
                      <>
                        <Check size={16} />
                        Vytvořit dopravce + smlouvu
                      </>
                    ) : (
                      'Uložit'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
