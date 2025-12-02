import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  Truck,
  Building2,
  Phone,
  Mail,
  Check
} from 'lucide-react'
import { carriers as carriersApi } from '../lib/api'

function Badge({ type, children }) {
  const classes = {
    purple: 'badge-purple',
    blue: 'badge-blue',
    green: 'badge-green',
    orange: 'badge-orange',
    red: 'badge-red',
  }
  return <span className={`badge ${classes[type] || 'badge-blue'}`}>{children}</span>
}

export default function Carriers() {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    ico: '',
    contactEmail: '',
    contactPhone: '',
  })
  
  const queryClient = useQueryClient()

  // Queries
  const { data: carrierList, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriersApi.getAll
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: carriersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => carriersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['carriers'])
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: carriersApi.delete,
    onSuccess: () => queryClient.invalidateQueries(['carriers'])
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      name: '',
      ico: '',
      contactEmail: '',
      contactPhone: '',
    })
  }

  const handleEdit = (carrier) => {
    setEditingId(carrier.id)
    setFormData({
      name: carrier.name || '',
      ico: carrier.ico || '',
      contactEmail: carrier.contactEmail || '',
      contactPhone: carrier.contactPhone || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Dopravci</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Správa dopravců a jejich kontaktních údajů
          </p>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="btn btn-primary"
        >
          <Plus size={18} /> Nový dopravce
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
              {editingId ? 'Upravit dopravce' : 'Nový dopravce'}
            </span>
            <button onClick={resetForm} style={{ color: 'var(--color-text-light)' }}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Název společnosti *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="např. Drive cool s.r.o."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  IČO
                </label>
                <input
                  type="text"
                  value={formData.ico}
                  onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                  className="input"
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="input"
                  placeholder="kontakt@dopravce.cz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="input"
                  placeholder="+420 XXX XXX XXX"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> {editingId ? 'Uložit' : 'Vytvořit'}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-ghost">
                Zrušit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Carrier List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Seznam dopravců</span>
          <Badge type="purple">{carrierList?.length || 0}</Badge>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
        ) : !carrierList?.length ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádní dopravci</p>
            <p className="text-sm mt-1">Přidejte prvního dopravce</p>
          </div>
        ) : (
          carrierList.map(carrier => (
            <div key={carrier.id} className="list-item">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-cyan) 100%)',
                  color: 'white'
                }}
              >
                <Truck size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                    {carrier.name}
                  </span>
                  <Badge type="green">Aktivní</Badge>
                </div>
                <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {carrier.ico && (
                    <span className="flex items-center gap-1">
                      <Building2 size={14} /> IČO: {carrier.ico}
                    </span>
                  )}
                  {carrier.contactEmail && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} /> {carrier.contactEmail}
                    </span>
                  )}
                  {carrier.contactPhone && (
                    <span className="flex items-center gap-1">
                      <Phone size={14} /> {carrier.contactPhone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(carrier)}
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => { 
                    if (confirm(`Smazat dopravce "${carrier.name}"?\n\nToto smaže i všechny související dokumenty!`)) 
                      deleteMutation.mutate(carrier.id) 
                  }}
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--color-text-light)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
