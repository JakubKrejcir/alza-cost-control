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
  const [formData, setFormData] = useState({ name: '', alias: '', ico: '', dic: '', address: '', contact: '' })
  
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
        alias: carrier.alias || '',
        ico: carrier.ico || '',
        dic: carrier.dic || '',
        address: carrier.address || '',
        contact: carrier.contact || ''
      })
      setUploadMode(false)
    } else {
      setEditingCarrier(null)
      setFormData({ name: '', alias: '', ico: '', dic: '', address: '', contact: '' })
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
    setFormData({ name: '', alias: '', ico: '', dic: '', address: '', contact: '' })
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
      
      // Vyplň formulář extrahovanými daty (alias se generuje z názvu)
      const extractedName = data.carrier?.name || ''
      setFormData({
        name: extractedName,
        alias: generateAlias(extractedName),
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

  // Helper: generuje alias z oficiálního názvu
  const generateAlias = (name) => {
    if (!name) return ''
    // Odstraň právní formy a zbytečná slova
    let alias = name
      .replace(/s\.r\.o\./gi, '')
      .replace(/a\.s\./gi, '')
      .replace(/spol\./gi, '')
      .replace(/Logistic Group/gi, '')
      .replace(/Group/gi, '')
      .trim()
    // Odstraň mezery navíc
    alias = alias.replace(/\s+/g, ' ').trim()
    return alias
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
        <div className="card p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          <Truck size={48} className="mx-auto mb-4 opacity-50" />
          <p>Zatím nejsou žádní dopravci</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            Přidat prvního dopravce
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {carrierList.map(carrier => (
            <div key={carrier.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--color-primary-light)' }}
                  >
                    <Truck size={24} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-dark)' }}>
                      {carrier.name}
                    </h3>
                    {carrier.alias && carrier.alias !== carrier.name && (
                      <p className="text-sm" style={{ color: 'var(--color-primary)' }}>
                        Alias: {carrier.alias}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {carrier.ico && <span>IČO: {carrier.ico}</span>}
                      {carrier.dic && <span>DIČ: {carrier.dic}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-light)' }}>
                        <FileText size={12} />
                        {carrier.contractsCount || 0} smluv
                      </span>
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-light)' }}>
                        <Building size={12} />
                        {carrier.proofsCount || 0} proofů
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openModal(carrier)}
                    className="p-2 rounded hover:bg-gray-100"
                    title="Upravit"
                  >
                    <Edit2 size={16} style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                  <button 
                    onClick={() => handleDelete(carrier)}
                    className="p-2 rounded hover:bg-red-50"
                    title="Smazat"
                  >
                    <Trash2 size={16} style={{ color: 'var(--color-red)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                {editingCarrier ? 'Upravit dopravce' : 'Nový dopravce'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100">
                <X size={20} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
            
            <div className="p-4">
              {/* Přepínač režimu - pouze pro nového dopravce */}
              {!editingCarrier && (
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => { setUploadMode(false); setParsedData(null); setSelectedFile(null) }}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      !uploadMode 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Ruční zadání
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode(true)}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      uploadMode 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Upload size={16} />
                    Ze smlouvy (PDF)
                  </button>
                </div>
              )}

              {/* Upload zone */}
              {uploadMode && !editingCarrier && (
                <div className="mb-4">
                  <label 
                    className={`
                      flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer
                      transition-colors
                      ${isParsingPdf ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-300'}
                    `}
                  >
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isParsingPdf}
                    />
                    {isParsingPdf ? (
                      <>
                        <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
                        <span className="text-sm text-blue-600">Zpracovávám PDF...</span>
                      </>
                    ) : selectedFile ? (
                      <>
                        <File size={32} className="text-green-500 mb-2" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                        <span className="text-xs text-gray-500 mt-1">Klikněte pro změnu</span>
                      </>
                    ) : (
                      <>
                        <Upload size={32} className="text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Nahrát smlouvu (PDF)</span>
                        <span className="text-xs text-gray-400 mt-1">Automaticky extrahuje údaje</span>
                      </>
                    )}
                  </label>
                  
                  {parseError && (
                    <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded flex items-center gap-2">
                      <AlertCircle size={16} />
                      {parseError}
                    </div>
                  )}
                  
                  {parsedData && (
                    <div className="mt-2 p-3 bg-green-50 rounded text-sm">
                      <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                        <Check size={16} />
                        Data extrahována ze smlouvy
                      </div>
                      {parsedData.contract && (
                        <div className="text-gray-600 pt-2" style={{ borderTop: '1px solid var(--color-border-light)' }}>
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
                    Oficiální název *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    required
                    placeholder="FA Dvořáček s.r.o."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Alias (krátký název pro Excel soubory)
                  </label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="input w-full"
                    placeholder="FADvořáček"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-light)' }}>
                    Používá se pro matching při importu plánovacích souborů
                  </p>
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
