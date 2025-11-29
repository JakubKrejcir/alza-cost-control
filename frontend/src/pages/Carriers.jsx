import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Truck, 
  Plus, 
  Edit2, 
  Trash2, 
  Building, 
  FileText, 
  X,
  MoreVertical,
  Receipt,
  FileCheck
} from 'lucide-react'
import { carriers } from '../lib/api'

export default function Carriers() {
  const [showModal, setShowModal] = useState(false)
  const [editingCarrier, setEditingCarrier] = useState(null)
  const [formData, setFormData] = useState({ name: '', ico: '', dic: '', address: '', contact: '' })
  
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
    } else {
      setEditingCarrier(null)
      setFormData({ name: '', ico: '', dic: '', address: '', contact: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCarrier(null)
    setFormData({ name: '', ico: '', dic: '', address: '', contact: '' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingCarrier) {
      updateMutation.mutate({ id: editingCarrier.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (carrier) => {
    if (confirm(`Opravdu smazat dopravce "${carrier.name}"?`)) {
      deleteMutation.mutate(carrier.id)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dopravci</h1>
          <p className="text-gray-500 text-sm mt-1">Správa dopravců a jejich údajů</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={18} />
          Přidat dopravce
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="card p-8 text-center text-gray-500">
          Načítám...
        </div>
      ) : carrierList?.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Žádní dopravci</h3>
          <p className="text-gray-500 mb-6">Začněte přidáním prvního dopravce</p>
          <button onClick={() => openModal()} className="btn btn-primary">
            <Plus size={18} />
            Přidat dopravce
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {carrierList?.map(carrier => (
            <div key={carrier.id} className="card hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Truck size={28} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{carrier.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        {carrier.ico && (
                          <span className="flex items-center gap-1">
                            <Building size={14} />
                            IČO: {carrier.ico}
                          </span>
                        )}
                        {carrier.dic && (
                          <span>DIČ: {carrier.dic}</span>
                        )}
                      </div>
                      {carrier.address && (
                        <p className="text-sm text-gray-400 mt-1">{carrier.address}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(carrier)}
                      className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(carrier)}
                      className="p-2.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex gap-6 mt-5 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileCheck size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Proofy</p>
                      <p className="font-semibold text-gray-900">{carrier.proofsCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Receipt size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Faktury</p>
                      <p className="font-semibold text-gray-900">{carrier.invoicesCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                      <FileText size={16} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Smlouvy</p>
                      <p className="font-semibold text-gray-900">{carrier.contractsCount || 0}</p>
                    </div>
                  </div>
                </div>
                
                {/* Depots */}
                {carrier.depots?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Depa</p>
                    <div className="flex flex-wrap gap-2">
                      {carrier.depots.map(depot => (
                        <span key={depot.id} className="badge badge-neutral">
                          <Building size={12} className="mr-1" />
                          {depot.name}
                          {depot.code && ` (${depot.code})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="card w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">
                  {editingCarrier ? 'Upravit dopravce' : 'Nový dopravce'}
                </h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="label">Název *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="Název společnosti"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">IČO</label>
                    <input
                      type="text"
                      value={formData.ico}
                      onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                      className="input"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="label">DIČ</label>
                    <input
                      type="text"
                      value={formData.dic}
                      onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                      className="input"
                      placeholder="CZ12345678"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Adresa</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input"
                    placeholder="Ulice 123, Město"
                  />
                </div>
                
                <div>
                  <label className="label">Kontakt</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="input"
                    placeholder="Email nebo telefon"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                    Zrušit
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Ukládám...' : 'Uložit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
