import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  FileText,
  ArrowRight,
  Calendar,
  TrendingUp
} from 'lucide-react'
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historie</h1>
          <p className="text-gray-500 text-sm mt-1">Posledních 12 měsíců</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">2024</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-emerald-50">
              <CheckCircle size={22} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {periods.filter(p => getDataForPeriod(p).status === 'ok').length}
              </p>
              <p className="text-sm text-gray-500">Kompletní</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-amber-50">
              <AlertTriangle size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {periods.filter(p => ['warning', 'partial'].includes(getDataForPeriod(p).status)).length}
              </p>
              <p className="text-sm text-gray-500">Neúplné</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-gray-100">
              <FileText size={22} className="text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {periods.filter(p => !getDataForPeriod(p).proof && getDataForPeriod(p).periodInvoices.length === 0).length}
              </p>
              <p className="text-sm text-gray-500">Bez dat</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="widget">
        <div className="widget-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-violet-600" />
            </div>
            <div>
              <h3 className="widget-title">Přehled období</h3>
              <p className="widget-subtitle">Kliknutím přejdete na detail</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Období</th>
                <th className="text-center">Proof</th>
                <th className="text-center">Faktury</th>
                <th className="text-right">Proof částka</th>
                <th className="text-right">Fakturováno</th>
                <th className="text-center">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map(period => {
                const { proof, periodInvoices, proofTotal, invoicedTotal, status } = getDataForPeriod(period)
                const hasData = proof || periodInvoices.length > 0
                
                return (
                  <tr 
                    key={period}
                    className="cursor-pointer group"
                    onClick={() => navigate(`/dashboard?period=${period}`)}
                  >
                    <td className="font-medium text-gray-900">
                      {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
                    </td>
                    <td className="text-center">
                      {proof ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                          <CheckCircle size={16} className="text-emerald-600" />
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {periodInvoices.length > 0 ? (
                        <span className="badge badge-info">{periodInvoices.length}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-right font-medium text-gray-900">
                      {proof ? formatCZK(proofTotal) : '—'}
                    </td>
                    <td className="text-right text-gray-700">
                      {periodInvoices.length > 0 ? formatCZK(invoicedTotal) : '—'}
                    </td>
                    <td className="text-center">
                      {!hasData ? (
                        <span className="badge badge-neutral">Žádná data</span>
                      ) : status === 'ok' ? (
                        <span className="badge badge-success">
                          <CheckCircle size={12} className="mr-1" />
                          OK
                        </span>
                      ) : status === 'warning' ? (
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} className="mr-1" />
                          Chybí faktury
                        </span>
                      ) : status === 'partial' ? (
                        <span className="badge badge-info">
                          <FileText size={12} className="mr-1" />
                          Částečně
                        </span>
                      ) : (
                        <span className="badge badge-error">
                          <AlertCircle size={12} className="mr-1" />
                          Rozdíl
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={18} className="text-gray-400" />
                      </div>
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
