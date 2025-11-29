import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, 
  FileText, Truck, Calendar, Package, MapPin, Receipt
} from 'lucide-react'
import { analysis } from '../lib/api'

function formatCZK(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK',
    maximumFractionDigits: 0 
  }).format(amount)
}

function StatusIcon({ status, size = 18 }) {
  if (status === 'ok') return <CheckCircle size={size} className="text-green-400" />
  if (status === 'warning' || status === 'partial' || status === 'missing') 
    return <AlertTriangle size={size} className="text-yellow-400" />
  if (status === 'error') return <XCircle size={size} className="text-red-400" />
  return null
}

function StatusBadge({ status }) {
  const styles = {
    ok: 'badge-success',
    warning: 'badge-warning',
    partial: 'badge-warning',
    missing: 'badge-warning',
    error: 'badge-error'
  }
  const labels = {
    ok: 'OK',
    warning: 'Varování',
    partial: 'Částečně',
    missing: 'Chybí',
    error: 'Chyba'
  }
  return (
    <span className={`badge ${styles[status] || 'badge-info'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function ProofDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['proofDetail', id],
    queryFn: () => analysis.getProofDetail(id),
    enabled: !!id
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Načítám detail proofu...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
        <p className="text-red-400">Chyba při načítání: {error.message}</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary mt-4">
          Zpět
        </button>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Detail proofu</h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {detail.carrierName} — {detail.period}
          </p>
        </div>
        {detail.fileName && (
          <div className="text-sm text-gray-500">
            <FileText size={16} className="inline mr-1" />
            {detail.fileName}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">FIX</div>
          <div className="text-lg font-bold">{formatCZK(detail.summary.totalFix)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">KM</div>
          <div className="text-lg font-bold">{formatCZK(detail.summary.totalKm)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">Linehaul</div>
          <div className="text-lg font-bold">{formatCZK(detail.summary.totalLinehaul)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">DEPO</div>
          <div className="text-lg font-bold">{formatCZK(detail.summary.totalDepo)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">Bonus</div>
          <div className="text-lg font-bold text-green-400">{formatCZK(detail.summary.totalBonus)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">Pokuty</div>
          <div className="text-lg font-bold text-red-400">{formatCZK(detail.summary.totalPenalty)}</div>
        </div>
        <div className="card p-4 bg-alza-orange/10 border-alza-orange/30">
          <div className="text-xs text-alza-orange mb-1">CELKEM</div>
          <div className="text-lg font-bold text-alza-orange">{formatCZK(detail.summary.grandTotal)}</div>
        </div>
      </div>

      {/* Checks */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckCircle size={18} />
            Kontroly
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {detail.checks.map((check, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center gap-4">
              <StatusIcon status={check.status} />
              <div className="flex-1">
                <div className="font-medium">{check.name}</div>
                <div className="text-sm text-gray-400">{check.description}</div>
              </div>
              {check.message && (
                <div className="text-sm text-gray-300">{check.message}</div>
              )}
              {check.difference !== undefined && (
                <div className={`text-sm ${check.difference > 100 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  Rozdíl: {formatCZK(check.difference)}
                </div>
              )}
              <StatusBadge status={check.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Route Details (FIX) */}
      {detail.routeDetails.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck size={18} />
              Trasy (FIX)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Typ trasy</th>
                  <th className="text-right">Počet</th>
                  <th className="text-right">Sazba (proof)</th>
                  <th className="text-right">Sazba (ceník)</th>
                  <th className="text-right">Celkem</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.routeDetails.map((route, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{route.routeType}</td>
                    <td className="text-right">{route.count}</td>
                    <td className="text-right">{formatCZK(route.proofRate)}</td>
                    <td className="text-right">
                      {route.configRate ? formatCZK(route.configRate) : (
                        <span className="text-yellow-400">—</span>
                      )}
                    </td>
                    <td className="text-right font-medium">{formatCZK(route.amount)}</td>
                    <td>
                      <StatusBadge status={route.status} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={4}>Celkem FIX</td>
                  <td className="text-right">{formatCZK(detail.summary.totalFix)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPO Details */}
      {detail.depoDetails.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold flex items-center gap-2">
              <Package size={18} />
              DEPO
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Depo</th>
                  <th>Typ</th>
                  <th className="text-right">Dní</th>
                  <th className="text-right">Sazba</th>
                  <th className="text-right">Celkem</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.depoDetails.map((depo, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{depo.depoName}</td>
                    <td>
                      <span className="badge badge-info">
                        {depo.rateType === 'daily' ? 'Denní' : 'Měsíční'}
                      </span>
                    </td>
                    <td className="text-right">{depo.days || 1}</td>
                    <td className="text-right">{formatCZK(depo.proofRate)}</td>
                    <td className="text-right font-medium">{formatCZK(depo.amount)}</td>
                    <td>
                      <StatusBadge status={depo.status} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={4}>Celkem DEPO</td>
                  <td className="text-right">{formatCZK(detail.summary.totalDepo)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linehaul Details */}
      {detail.linehaulDetails.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold flex items-center gap-2">
              <MapPin size={18} />
              Linehaul
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Popis</th>
                  <th>Trasa</th>
                  <th>Vozidlo</th>
                  <th className="text-right">Dní</th>
                  <th className="text-right">Sazba</th>
                  <th className="text-right">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {detail.linehaulDetails.map((lh, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{lh.description}</td>
                    <td>
                      {lh.fromCode && lh.toCode ? (
                        <span className="text-gray-400">
                          {lh.fromCode} → {lh.toCode}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{lh.vehicleType || '—'}</td>
                    <td className="text-right">{lh.days || '—'}</td>
                    <td className="text-right">{formatCZK(lh.rate)}</td>
                    <td className="text-right font-medium">{formatCZK(lh.total)}</td>
                  </tr>
                ))}
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={5}>Celkem Linehaul</td>
                  <td className="text-right">{formatCZK(detail.summary.totalLinehaul)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Status */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Receipt size={18} />
            Stav fakturace
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Typ</th>
                <th className="text-right">Proof</th>
                <th className="text-right">Fakturováno</th>
                <th className="text-right">Zbývá</th>
                <th>Status</th>
                <th>Faktury</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoiceStatus.map((inv, idx) => (
                <tr key={idx}>
                  <td className="font-medium">{inv.label}</td>
                  <td className="text-right">{formatCZK(inv.proofAmount)}</td>
                  <td className="text-right">{formatCZK(inv.invoicedAmount)}</td>
                  <td className={`text-right font-medium ${
                    inv.remaining > 100 ? 'text-yellow-400' : 
                    inv.remaining < -100 ? 'text-red-400' : 
                    'text-green-400'
                  }`}>
                    {formatCZK(inv.remaining)}
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td>
                    {inv.invoices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {inv.invoices.map((i, iIdx) => (
                          <span key={iIdx} className="badge badge-info text-xs">
                            {i.invoiceNumber}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-white/5 font-semibold">
                <td>CELKEM</td>
                <td className="text-right">{formatCZK(detail.summary.grandTotal)}</td>
                <td className="text-right">{formatCZK(detail.summary.totalInvoiced)}</td>
                <td className={`text-right ${
                  detail.summary.totalRemaining > 100 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {formatCZK(detail.summary.totalRemaining)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Price Config Info */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          {detail.hasPriceConfig ? (
            <>
              <CheckCircle className="text-green-400" size={20} />
              <div>
                <div className="font-medium">Ceník nalezen</div>
                <div className="text-sm text-gray-400">
                  ID: {detail.priceConfigId}
                </div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="text-yellow-400" size={20} />
              <div>
                <div className="font-medium">Ceník chybí</div>
                <div className="text-sm text-gray-400">
                  Pro toto období neexistuje aktivní ceník. Sazby nelze ověřit.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
