import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { carriers } from './api'

// Generate period options
function getPeriodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    options.push(format(date, 'MM/yyyy'))
  }
  return options
}

const CarrierContext = createContext(null)

export function CarrierProvider({ children }) {
  const [selectedCarrierId, setSelectedCarrierId] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('selectedCarrierId')
    return saved || ''
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const saved = localStorage.getItem('selectedPeriod')
    return saved || getPeriodOptions()[0]
  })

  // Fetch carriers
  const { data: carrierList, isLoading: loadingCarriers } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriers.getAll
  })

  // Get selected carrier object
  const selectedCarrier = carrierList?.find(c => String(c.id) === String(selectedCarrierId)) || null

  // Persist to localStorage
  useEffect(() => {
    if (selectedCarrierId) {
      localStorage.setItem('selectedCarrierId', selectedCarrierId)
    }
  }, [selectedCarrierId])

  useEffect(() => {
    if (selectedPeriod) {
      localStorage.setItem('selectedPeriod', selectedPeriod)
    }
  }, [selectedPeriod])

  const periodOptions = getPeriodOptions()

  const value = {
    // Carrier
    selectedCarrierId,
    setSelectedCarrierId,
    selectedCarrier,
    carrierList: carrierList || [],
    loadingCarriers,
    // Period
    selectedPeriod,
    setSelectedPeriod,
    periodOptions,
  }

  return (
    <CarrierContext.Provider value={value}>
      {children}
    </CarrierContext.Provider>
  )
}

export function useCarrier() {
  const context = useContext(CarrierContext)
  if (!context) {
    throw new Error('useCarrier must be used within CarrierProvider')
  }
  return context
}
