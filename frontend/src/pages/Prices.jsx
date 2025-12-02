import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  DollarSign,
  AlertTriangle
} from 'lucide-react'
import { prices as pricesApi } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return format(new Date(dateStr), 'd. M. yyyy', { locale: cs })
}

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

export default function Prices() {
  const { selectedCarrierId, selectedCarrier } = useCarrier()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    serviceType: '',
    pricePerUnit: '',
    unit: 'route',
    validFrom: '',
    validTo: '',
  })
  
  const queryClient = useQueryClient()

  // Queries
  const { data: priceList, isLoading } = useQuery({
    queryKey: ['prices', selectedCarrierId],
    queryFn: () => pricesApi.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => pricesApi.create({ ...data, carrier_id: selectedCarrierId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['prices'])
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => pricesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['prices'])
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => pricesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['prices'])
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      serviceType: '',
      pricePerUnit: '',
      unit: 'route',
      validFrom: '',
      validTo: '',
    })
  }

  const handleEdit = (price) => {
    setEditingId(price.id)
    setFormData({
      serviceType: price.serviceType || '',
      pricePerUnit: price.pricePerUnit?.toString() || '',
      unit: price.unit || 'route',
      validFrom: price.validFrom?.split('T')[0] || '',
      validTo: price.validTo?.split('T')[0] || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      ...formData,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      validFrom: formData.validFrom || null,
      validTo: formData.validTo || null,
    }
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  // Group prices by service type
  const activeGroups = priceList?.filter(p => !p.validTo || new Date(p.validTo) >= new Date())
    .reduce((acc, price) => {
      const type = price.serviceType || 'Ostatní'
      if (!acc[type]) acc[type] = []
      acc[type].push(price)
      return acc
    }, {}) || {}

  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Ceníky</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Správa ceníků dopravců</p>
        </div>
        <div className="card p-6" style={{ borderColor: 'var(--color-orange)', backgroundColor: 'var(--color-orange-light)' }}>
          <div className="flex items-center gap-3" style={{ color: '#e67e22' }}>
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Pro zobrazení ceníků vyberte dopravce v horním menu
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Ceníky</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {selectedCarrier?.name}
          </p>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="btn btn-primary"
        >
          <Plus size={18} /> Nová cena
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
              {editingId ? 'Upravit cenu' : 'Nová cena'}
            </span>
            <button onClick={resetForm} style={{ color: 'var(--color-text-light)' }}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Typ služby
                </label>
                <input
                  type="text"
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="input"
                  placeholder="např. FIX, KM, LINEHAUL"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Cena za jednotku (CZK)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pricePerUnit}
                  onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                  className="input"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Jednotka
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="select"
                >
                  <option value="route">Trasa</option>
                  <option value="km">Kilometr</option>
                  <option value="stop">Zastávka</option>
                  <option value="hour">Hodina</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Platí od
                </label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="input"
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

      {/* Price List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Aktivní ceníky</span>
          <Badge type="blue">{priceList?.length || 0}</Badge>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
        ) : !priceList?.length ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádné ceníky</p>
            <p className="text-sm mt-1">Přidejte první cenovou položku</p>
          </div>
        ) : (
          Object.entries(activeGroups).map(([type, items]) => (
            <div key={type}>
              <div className="list-group-header">
                {type}
              </div>
              {items.map(price => (
                <div key={price.id} className="list-item">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    <DollarSign size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                      {formatCZK(price.pricePerUnit)} / {price.unit === 'route' ? 'trasa' : price.unit === 'km' ? 'km' : price.unit === 'stop' ? 'zastávka' : price.unit}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {price.validFrom ? `Od ${formatDate(price.validFrom)}` : 'Bez omezení'}
                      {price.validTo && ` do ${formatDate(price.validTo)}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(price)}
                      className="p-2 rounded-lg"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => { if (confirm('Smazat tuto cenu?')) deleteMutation.mutate(price.id) }}
                      className="p-2 rounded-lg"
                      style={{ color: 'var(--color-text-light)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
