import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, AlertCircle, FileText } from 'lucide-react'
import { proofs, invoices } from '../lib/api'
import { useCarrier } from '../lib/CarrierContext'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function getPeriodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    options.push(format(date, 'MM/yyyy'))
  }
  return options
}

export default function History() {
  const navigate = useNavigate()
  const { selectedCarrierId, setSelectedPeriod } = useCarrier()
  const periods = getPeriodOptions()

  const { data: allProofs } = useQuery({
    queryKey: ['proofs', selectedCarrierId],
    queryFn: () => proofs.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const { data: allInvoices } = useQuery({
    queryKey: ['invoices-all', selectedCarrierId],
    queryFn: () => invoices.getAll({ carrier_id: selectedCarrierId }),
    enabled: !!selectedCarrierId
  })

  const getDataForPeriod = (period) => {
    const proof = allProofs?.find(p => p.period === period)
    const periodInvoices = allInvoices?.filter(i => i.period === period) || []
    
    const proofTotal = proof ? parseFloat(proof.grandTotal || 0) : 0
    const invoicedTotal = periodInvoices.reduce((sum, inv) => 
      sum + parseFloat(inv.totalWithoutVat || 0), 0
    )
    
    let status = 'pending'
    if (proof && periodInvoices.length > 0) {
      const diff = Math.abs(proofTotal - invoicedTotal)
      if (diff < 1000) status = 'ok'
      else if (invoicedTotal < proofTotal * 0.5) status = 'warning'
      else status = 'partial'
    } else if (proof && periodInvoices.length === 0) {
      status = 'warning'
    }

    return { proof, periodInvoices, proofTotal, invoicedTotal, status }
  }

  const handleRowClick = (period) => {
    setSelectedPeriod(period)
    navigate('/dashboard')
  }

  if (!selectedCarrierId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Historie</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Posledních 12 měsíců</p>
        </div>
        <div className="card p-8 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-orange)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-dark)' }}>Vyberte dopravce</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pro zobrazení historie vyberte dopravce v horním menu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>Historie</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Posledních 12 měsíců</p>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Období</th>
                <th className="text-center p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Proof</th>
                <th className="text-center p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Faktury</th>
                <th className="text-right p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Proof částka</th>
                <th className="text-right p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Fakturováno</th>
                <th className="text-center p-4 font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(period => {
                const { proof, periodInvoices, proofTotal, invoicedTotal, status } = getDataForPeriod(period)
                const hasData = proof || periodInvoices.length > 0
                
                return (
                  <tr 
                    key={period}
                    onClick={() => handleRowClick(period)}
                    className="cursor-pointer"
                    style={{ 
                      borderBottom: '1px solid var(--color-border-light)',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="p-4 font-medium" style={{ color: 'var(--color-text-dark)' }}>
                      {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                    </td>
                    <td className="text-center p-4">
                      {proof ? (
                        <CheckCircle className="w-5 h-5 inline" style={{ color: 'var(--color-green)' }} />
                      ) : (
                        <span style={{ color: 'var(--color-text-light)' }}>—</span>
                      )}
                    </td>
                    <td className="text-center p-4">
                      {periodInvoices.length > 0 ? (
                        <span style={{ color: 'var(--color-green)' }}>{periodInvoices.length}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-light)' }}>—</span>
                      )}
                    </td>
                    <td className="text-right p-4" style={{ color: 'var(--color-text)' }}>
                      {proof ? formatCZK(proofTotal) : '—'}
                    </td>
                    <td className="text-right p-4" style={{ color: 'var(--color-text)' }}>
                      {periodInvoices.length > 0 ? formatCZK(invoicedTotal) : '—'}
                    </td>
                    <td className="text-center p-4">
                      {!hasData ? (
                        <span className="badge" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          Žádná data
                        </span>
                      ) : status === 'ok' ? (
                        <span className="badge badge-green">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          OK
                        </span>
                      ) : status === 'warning' ? (
                        <span className="badge badge-orange">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Chybí faktury
                        </span>
                      ) : status === 'partial' ? (
                        <span className="badge badge-blue">
                          <FileText className="w-3 h-3 mr-1" />
                          Částečně
                        </span>
                      ) : (
                        <span className="badge badge-red">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Rozdíl
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
