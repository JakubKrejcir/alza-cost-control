import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react'
import { proofs } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
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

export default function History() {
  const { selectedCarrierId, selectedCarrier } = useCarrier()

  // Get all proofs for selected carrier
  const { data: proofList, isLoading } = useQuery({
    queryKey: ['proofs-history', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  // Group by year
  const proofsByYear = proofList?.reduce((acc, proof) => {
    const year = proof.period ? '20' + proof.period.split('/')[1] : 'Bez data'
    if (!acc[year]) acc[year] = []
    acc[year].push(proof)
    return acc
  }, {}) || {}

  // Calculate totals per year
  const yearTotals = Object.entries(proofsByYear).reduce((acc, [year, items]) => {
    acc[year] = items.reduce((sum, p) => sum + (p.grandTotal || 0), 0)
    return acc
  }, {})

  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Historie</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Přehled historických dat</p>
        </div>
        <div className="card p-6" style={{ borderColor: 'var(--color-orange)', backgroundColor: 'var(--color-orange-light)' }}>
          <div className="flex items-center gap-3" style={{ color: '#e67e22' }}>
            <AlertTriangle size={24} />
            <div>
              <div className="font-medium">Vyberte dopravce</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Pro zobrazení historie vyberte dopravce v horním menu
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
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Historie</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {selectedCarrier?.name} — historický přehled proofů
        </p>
      </div>

      {/* Summary Cards */}
      {proofList?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="stat-card">
            <div className="stat-card-label">Celkem období</div>
            <div className="stat-card-value">{proofList.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Celková suma</div>
            <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
              {formatCZK(proofList.reduce((sum, p) => sum + (p.grandTotal || 0), 0))}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Průměr/měsíc</div>
            <div className="stat-card-value" style={{ color: 'var(--color-purple)' }}>
              {formatCZK(proofList.reduce((sum, p) => sum + (p.grandTotal || 0), 0) / proofList.length)}
            </div>
          </div>
        </div>
      )}

      {/* Proof History */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>Měsíční přehled</span>
          <Badge type="purple">{proofList?.length || 0}</Badge>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>Načítám...</div>
        ) : !proofList?.length ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-light)' }}>
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádná historická data</p>
          </div>
        ) : (
          Object.entries(proofsByYear)
            .sort(([a], [b]) => String(b).localeCompare(String(a)))
            .map(([year, items]) => (
              <div key={year}>
                <div className="list-group-header flex items-center justify-between">
                  <span>{year}</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    {formatCZK(yearTotals[year])}
                  </span>
                </div>
                {items
                  .sort((a, b) => b.period.localeCompare(a.period))
                  .map((proof, idx) => {
                    // Calculate month-over-month change
                    const prevProof = items[idx + 1]
                    const change = prevProof 
                      ? ((proof.grandTotal - prevProof.grandTotal) / prevProof.grandTotal * 100)
                      : null

                    return (
                      <div key={proof.id} className="list-item">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                              {proof.period}
                            </span>
                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              ({proof.fileName})
                            </span>
                          </div>
                          <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            <span>FIX: {formatCZK(proof.totalFix)}</span>
                            <span>KM: {formatCZK(proof.totalKm)}</span>
                            <span>LH: {formatCZK(proof.totalLinehaul)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold" style={{ color: 'var(--color-text-dark)' }}>
                            {formatCZK(proof.grandTotal)}
                          </div>
                          {change !== null && (
                            <div className="flex items-center justify-end gap-1 text-sm">
                              {change >= 0 ? (
                                <TrendingUp size={14} style={{ color: 'var(--color-red)' }} />
                              ) : (
                                <TrendingDown size={14} style={{ color: 'var(--color-green)' }} />
                              )}
                              <span style={{ color: change >= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ))
        )}
      </div>
    </div>
  )
}
