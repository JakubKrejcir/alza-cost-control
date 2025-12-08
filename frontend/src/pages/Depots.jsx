import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Building2, MapPin, Truck, Package, Users, ChevronRight, 
  ChevronDown, Route as RouteIcon
} from 'lucide-react'
import { depots, routes } from '../lib/api'

/**
 * Depots.jsx - Správa dep a tras
 * 
 * Zobrazuje:
 * - Přehled všech dep (ALZA i CARRIER provozovaných)
 * - Pro každé depo: seznam tras, provozovatel, region
 */

// Barvy pro typy dep
const DEPOT_COLORS = {
  ALZA: 'var(--color-primary)',
  CARRIER: 'var(--color-purple)',
}

// Ikony pro typy dep
const DEPOT_ICONS = {
  WAREHOUSE_DEPOT: Building2,
  SORTING_DEPOT: Package,
  DISTRIBUTION: Truck,
}

// Komponenta pro badge provozovatele
function OperatorBadge({ operatorType, operatorName }) {
  const isAlza = operatorType === 'ALZA'
  
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ 
        backgroundColor: isAlza ? 'var(--color-primary-light)' : 'var(--color-purple-light)',
        color: isAlza ? 'var(--color-primary)' : 'var(--color-purple)'
      }}
    >
      {isAlza ? (
        <>
          <Building2 size={12} />
          ALZA
        </>
      ) : (
        <>
          <Users size={12} />
          {operatorName || 'Dopravce'}
        </>
      )}
    </span>
  )
}

// Komponenta pro kartu depa
function DepotCard({ depot, routesList, isExpanded, onToggle }) {
  const Icon = DEPOT_ICONS[depot.depotType] || Building2
  const activeRoutesCount = routesList?.length || 0
  
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div 
        className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
        onClick={onToggle}
        style={{ 
          borderLeft: `4px solid ${depot.operatorType === 'ALZA' ? 'var(--color-primary)' : 'var(--color-purple)'}` 
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="p-2 rounded-lg"
            style={{ 
              backgroundColor: depot.operatorType === 'ALZA' 
                ? 'var(--color-primary-light)' 
                : 'var(--color-purple-light)' 
            }}
          >
            <Icon 
              size={24} 
              style={{ 
                color: depot.operatorType === 'ALZA' 
                  ? 'var(--color-primary)' 
                  : 'var(--color-purple)' 
              }} 
            />
          </div>
          
          <div>
            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-dark)' }}>
              {depot.name}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <OperatorBadge 
                operatorType={depot.operatorType} 
                operatorName={depot.operatorCarrierName}
              />
              {depot.region && (
                <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                  <MapPin size={14} />
                  {depot.region}
                </span>
              )}
              {depot.code && (
                <span 
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
                >
                  {depot.code}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>
              {activeRoutesCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              aktivních tras
            </div>
          </div>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </div>
      
      {/* Expanded content - seznam tras */}
      {isExpanded && routesList && routesList.length > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-6 py-3" style={{ backgroundColor: 'var(--color-bg)' }}>
            <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Trasy z tohoto depa
            </h4>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
            {routesList.map(route => (
              <div 
                key={route.id} 
                className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RouteIcon size={16} style={{ color: 'var(--color-text-light)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text-dark)' }}>
                    {route.routeName}
                  </span>
                  {route.region && (
                    <span 
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
                    >
                      {route.region}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {route.currentCarrierName && (
                    <span 
                      className="text-sm flex items-center gap-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Truck size={14} />
                      {route.currentCarrierName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {isExpanded && (!routesList || routesList.length === 0) && (
        <div 
          className="px-6 py-8 text-center border-t"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
        >
          Žádné přiřazené trasy
        </div>
      )}
    </div>
  )
}

// Komponenta pro přehled regionů
function RegionOverview({ routesByRegion }) {
  if (!routesByRegion) return null
  
  const regions = Object.entries(routesByRegion)
  
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-dark)' }}>
          <MapPin size={20} style={{ color: 'var(--color-primary)' }} />
          Trasy podle regionu
        </h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {regions.map(([region, regionRoutes]) => (
            <div 
              key={region}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              <div className="font-medium mb-2" style={{ color: 'var(--color-text-dark)' }}>
                {region}
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {regionRoutes.length}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                tras
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Hlavní komponenta
export default function Depots() {
  const [expandedDepots, setExpandedDepots] = useState(new Set())
  const [filterOperator, setFilterOperator] = useState('all') // 'all', 'ALZA', 'CARRIER'
  
  // Načti depa
  const { data: depotList, isLoading: depotsLoading } = useQuery({
    queryKey: ['depots'],
    queryFn: () => depots.getAll()
  })
  
  // Načti trasy
  const { data: routeList, isLoading: routesLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routes.getAll()
  })
  
  // Načti trasy podle regionu
  const { data: routesByRegion } = useQuery({
    queryKey: ['routes-by-region'],
    queryFn: () => routes.getByRegion()
  })
  
  // Seskup trasy podle depa
  const routesByDepot = useMemo(() => {
    if (!routeList) return {}
    
    const result = {}
    routeList.forEach(route => {
      const depotId = route.currentDepot?.id
      if (depotId) {
        if (!result[depotId]) result[depotId] = []
        result[depotId].push(route)
      }
    })
    return result
  }, [routeList])
  
  // Filtruj depa
  const filteredDepots = useMemo(() => {
    if (!depotList) return []
    if (filterOperator === 'all') return depotList
    return depotList.filter(d => d.operatorType === filterOperator)
  }, [depotList, filterOperator])
  
  // Toggle expand
  const toggleExpand = (depotId) => {
    setExpandedDepots(prev => {
      const next = new Set(prev)
      if (next.has(depotId)) {
        next.delete(depotId)
      } else {
        next.add(depotId)
      }
      return next
    })
  }
  
  // Statistiky
  const stats = useMemo(() => {
    if (!depotList || !routeList) return null
    
    const alzaDepots = depotList.filter(d => d.operatorType === 'ALZA').length
    const carrierDepots = depotList.filter(d => d.operatorType === 'CARRIER').length
    const activeRoutes = routeList.filter(r => r.isActive).length
    
    return { alzaDepots, carrierDepots, activeRoutes, totalDepots: depotList.length }
  }, [depotList, routeList])
  
  const isLoading = depotsLoading || routesLoading
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-dark)' }}>
          Správa dep a tras
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Přehled distribučních dep, přiřazených tras a jejich provozovatelů
        </p>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Celkem dep</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-dark)' }}>
              {stats.totalDepots}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
              <Building2 size={14} />
              ALZA depa
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {stats.alzaDepots}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm flex items-center gap-1" style={{ color: 'var(--color-purple)' }}>
              <Users size={14} />
              Dopravci depa
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-purple)' }}>
              {stats.carrierDepots}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aktivních tras</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-green)' }}>
              {stats.activeRoutes}
            </div>
          </div>
        </div>
      )}
      
      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Filtr:</span>
        {['all', 'ALZA', 'CARRIER'].map(filter => (
          <button
            key={filter}
            onClick={() => setFilterOperator(filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors`}
            style={{
              backgroundColor: filterOperator === filter 
                ? (filter === 'ALZA' ? 'var(--color-primary)' : filter === 'CARRIER' ? 'var(--color-purple)' : 'var(--color-text-dark)')
                : 'var(--color-bg)',
              color: filterOperator === filter 
                ? 'white' 
                : 'var(--color-text-muted)'
            }}
          >
            {filter === 'all' ? 'Všechna' : filter === 'ALZA' ? 'ALZA' : 'Dopravci'}
          </button>
        ))}
      </div>
      
      {/* Loading */}
      {isLoading && (
        <div className="card p-12 text-center">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
            style={{ borderColor: 'var(--color-primary)' }}
          />
          <p style={{ color: 'var(--color-text-muted)' }}>Načítám data...</p>
        </div>
      )}
      
      {/* Depots list */}
      {!isLoading && filteredDepots && (
        <div className="space-y-4">
          {filteredDepots.map(depot => (
            <DepotCard
              key={depot.id}
              depot={depot}
              routesList={routesByDepot[depot.id] || []}
              isExpanded={expandedDepots.has(depot.id)}
              onToggle={() => toggleExpand(depot.id)}
            />
          ))}
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && filteredDepots && filteredDepots.length === 0 && (
        <div className="card p-12 text-center">
          <Building2 className="mx-auto mb-4" size={48} style={{ color: 'var(--color-text-light)' }} />
          <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Žádná depa
          </h2>
          <p style={{ color: 'var(--color-text-light)' }}>
            {filterOperator !== 'all' 
              ? 'Pro tento filtr nebyla nalezena žádná depa' 
              : 'Zatím nebyla vytvořena žádná depa'}
          </p>
        </div>
      )}
      
      {/* Region overview */}
      {!isLoading && routesByRegion && Object.keys(routesByRegion).length > 0 && (
        <RegionOverview routesByRegion={routesByRegion} />
      )}
      
      {/* Legenda */}
      <div 
        className="p-4 rounded-lg flex flex-wrap items-center gap-6"
        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>
          Legenda:
        </span>
        <div className="flex items-center gap-2">
          <OperatorBadge operatorType="ALZA" />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            = Provozuje ALZA (sklady, třídírna)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <OperatorBadge operatorType="CARRIER" operatorName="Dopravce" />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            = Provozuje dopravce
          </span>
        </div>
      </div>
    </div>
  )
}
