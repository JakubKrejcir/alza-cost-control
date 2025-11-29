import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, AlertCircle, FileText } from 'lucide-react'
import { proofs, invoices } from '../lib/api'

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
  const periods = getPeriodOptions()

  const { data: allProofs } = useQuery({
    queryKey: ['proofs'],
    queryFn: () => proofs.getAll()
  })

  const { data: allInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoices.getAll()
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Historie</h1>
        <p className="text-gray-400 text-sm mt-1">Posledních 12 měsíců</p>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Období</th>
              <th className="text-center">Proof</th>
              <th className="text-center">Faktury</th>
              <th className="text-right">Proof částka</th>
              <th className="text-right">Fakturováno</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(period => {
              const { proof, periodInvoices, proofTotal, invoicedTotal, status } = getDataForPeriod(period)
              const hasData = proof || periodInvoices.length > 0
              
              return (
                <tr 
                  key={period}
                  className="cursor-pointer hover:bg-white/[0.03]"
                  onClick={() => navigate(`/dashboard?period=${period}`)}
                >
                  <td className="font-medium">
                    {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                  </td>
                  <td className="text-center">
                    {proof ? (
                      <CheckCircle className="w-5 h-5 text-green-400 inline" />
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    {periodInvoices.length > 0 ? (
                      <span className="text-green-400">{periodInvoices.length}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    {proof ? formatCZK(proofTotal) : '—'}
                  </td>
                  <td className="text-right">
                    {periodInvoices.length > 0 ? formatCZK(invoicedTotal) : '—'}
                  </td>
                  <td className="text-center">
                    {!hasData ? (
                      <span className="badge bg-gray-500/20 text-gray-400">Žádná data</span>
                    ) : status === 'ok' ? (
                      <span className="badge badge-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        OK
                      </span>
                    ) : status === 'warning' ? (
                      <span className="badge badge-warning">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Chybí faktury
                      </span>
                    ) : status === 'partial' ? (
                      <span className="badge badge-info">
                        <FileText className="w-3 h-3 mr-1" />
                        Částečně
                      </span>
                    ) : (
                      <span className="badge badge-error">
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
  )
}
