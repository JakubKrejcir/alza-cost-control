import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Plus, Edit2, Trash2, Building, FileText, X } from 'lucide-react'
import { carriers, depots } from '../lib/api'

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Dopravci</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Správa dopravců a dep</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <Plus size={18} />
          Přidat dopravce
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
          Načítám...
        </div>
      ) : carrierList?.length === 0 ? (
        <div className="card p-8 text-center">
          <Truck className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-light)' }} />
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
                    style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-cyan) 100%)' }}>
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-dark)' }}>{carrier.name}</h3>
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
                    className="btn btn-ghost p-2"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(carrier)}
                    className="btn btn-ghost p-2"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
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
                      <span key={depot.id} className="badge badge-blue">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="card w-full max-w-md animate-fade-in">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                {editingCarrier ? 'Upravit dopravce' : 'Nový dopravce'}
              </h2>
              <button onClick={closeModal} className="btn btn-ghost p-2" style={{ color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>Název *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>IČO</label>
                  <input
                    type="text"
                    value={formData.ico}
                    onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>DIČ</label>
                  <input
                    type="text"
                    value={formData.dic}
                    onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>Adresa</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-dark)' }}>Kontakt</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="input"
                  placeholder="Email nebo telefon"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-ghost flex-1">
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
      )}
    </div>
  )
}
