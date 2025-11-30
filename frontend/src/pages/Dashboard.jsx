import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { cs } from 'date-fns/locale'
import { AlertCircle, CheckCircle, AlertTriangle, FileText, TrendingUp } from 'lucide-react'
import { analysis, proofs, invoices } from '../lib/api'

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

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState(getPeriodOptions()[0])

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', selectedPeriod],
    queryFn: () => analysis.getDashboard({ period: selectedPeriod })
  })

  const { data: periodProofs } = useQuery({
    queryKey: ['proofs', selectedPeriod],
    queryFn: () => proofs.getAll({ period: selectedPeriod })
  })

  const { data: periodInvoices } = useQuery({
    queryKey: ['invoices', selectedPeriod],
    queryFn: () => invoices.getAll({ period: selectedPeriod })
  })

  const proof = periodProofs?.[0]
  const invoiceList = periodInvoices || []
  
  const totalInvoiced = invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalWithoutVat || 0), 0)
  const totalProof = proof ? parseFloat(proof.grandTotal || 0) : 0
  const remaining = totalProof - totalInvoiced

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Přehled nákladů na dopravu</p>
        </div>
        
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="input w-full sm:w-48"
        >
          {getPeriodOptions().map(period => (
            <option key={period} value={period}>
              {format(new Date(period.split('/')[1], parseInt(period.split('/')[0]) - 1), 'LLLL yyyy', { locale: cs })}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">Proof</span>
          </div>
          <div className="text-2xl font-bold">{formatCZK(totalProof)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {proof ? 'Nahráno' : 'Chybí proof'}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">Fakturováno</span>
          </div>
          <div className="text-2xl font-bold">{formatCZK(totalInvoiced)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {invoiceList.length} faktur
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-gray-400 text-sm">Zbývá</span>
          </div>
          <div className={`text-2xl font-bold ${remaining > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {formatCZK(remaining)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {remaining > 0 ? 'K dofakturování' : 'Kompletní'}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              !proof ? 'bg-red-500/20' : remaining > 1000 ? 'bg-yellow-500/20' : 'bg-green-500/20'
            }`}>
              {!proof ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : remaining > 1000 ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
            </div>
            <span className="text-gray-400 text-sm">Status</span>
          </div>
          <div className="text-lg font-semibold">
            {!proof ? 'Chybí data' : remaining > 1000 ? 'Neúplné' : 'OK'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {!proof ? 'Nahrajte proof' : remaining > 1000 ? 'Chybí faktury' : 'Vše sedí'}
          </div>
        </div>
      </div>

      {/* Proof Detail */}
      {proof && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold">Detail proofu — {selectedPeriod}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-400 mb-1">FIX</div>
                <div className="text-xl font-semibold">{formatCZK(proof.totalFix)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">KM</div>
                <div className="text-xl font-semibold">{formatCZK(proof.totalKm)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Linehaul</div>
                <div className="text-xl font-semibold">{formatCZK(proof.totalLinehaul)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Depo</div>
                <div className="text-xl font-semibold">{formatCZK(proof.totalDepo)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">Faktury — {selectedPeriod}</h2>
          <span className="badge badge-info">{invoiceList.length} faktur</span>
        </div>
        
        {invoiceList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Žádné faktury pro toto období</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Číslo faktury</th>
                  <th>Typ</th>
                  <th className="text-right">Částka</th>
                  <th className="text-right">DPH</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoiceList.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="font-medium">{invoice.invoiceNumber}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {invoice.items?.map((item, idx) => (
                          <span key={idx} className="badge badge-info">
                            {(item.itemType || '').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right font-medium">{formatCZK(invoice.totalWithoutVat)}</td>
                    <td className="text-right text-gray-400">{formatCZK(invoice.vatAmount)}</td>
                    <td>
                      <span className={`badge ${
                        invoice.status === 'matched' ? 'badge-success' :
                        invoice.status === 'disputed' ? 'badge-error' :
                        'badge-warning'
                      }`}>
                        {invoice.status === 'matched' ? 'Spárováno' :
                         invoice.status === 'disputed' ? 'Sporná' :
                         'Ke kontrole'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
