import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY || ''
  },
  timeout: 30000 // 30 sekund default
})

// Carriers
export const carriers = {
  getAll: () => api.get('/carriers').then(r => r.data),
  getOne: (id) => api.get(`/carriers/${id}`).then(r => r.data),
  create: (data) => api.post('/carriers', data).then(r => r.data),
  update: (id, data) => api.put(`/carriers/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/carriers/${id}`)
}

// Depots
export const depots = {
  getAll: (params) => api.get('/depots', { params }).then(r => r.data),
  getOne: (id) => api.get(`/depots/${id}`).then(r => r.data),
  create: (data) => api.post('/depots', data).then(r => r.data),
  update: (id, data) => api.put(`/depots/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/depots/${id}`),
  getStats: () => api.get('/depots/stats').then(r => r.data),
  getMappings: () => api.get('/depots/mappings').then(r => r.data),
  resolveName: (planName) => 
    api.get('/depots/resolve-name', { params: { plan_name: planName } }).then(r => r.data),
}

  // Routes
  export const routes = {
    getAll: (params) => api.get('/routes', { params }).then(r => r.data),
    getByRegion: () => api.get('/routes/by-region').then(r => r.data),
  }


// Contracts
export const contracts = {
  getAll: (carrierId) => api.get('/contracts', { params: { carrier_id: carrierId } }).then(r => r.data),
  getOne: (id) => api.get(`/contracts/${id}`).then(r => r.data),
  create: (data) => api.post('/contracts', data).then(r => r.data),
  upload: (file, carrierId) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    return api.post('/contracts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minuty
    }).then(r => r.data)
  },
  parsePreview: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/contracts/parse-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    }).then(r => r.data)
  },
  uploadPdf: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/contracts/upload-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    }).then(r => r.data)
  },
  update: (id, data) => api.put(`/contracts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/contracts/${id}`)
}

// Prices
export const prices = {
  getAll: (params) => api.get('/prices', { params }).then(r => r.data),
  getActive: (carrierId, type, date) => 
    api.get('/prices/active', { params: { carrier_id: carrierId, type, date } }).then(r => r.data),
  getOne: (id) => api.get(`/prices/${id}`).then(r => r.data),
  create: (data) => api.post('/prices', data).then(r => r.data),
  update: (id, data) => api.put(`/prices/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/prices/${id}`)
}

// Proofs
export const proofs = {
  getAll: (params) => api.get('/proofs', { params }).then(r => r.data),
  getOne: (id) => api.get(`/proofs/${id}`).then(r => r.data),
  upload: (file, carrierId, period) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    formData.append('period', period)
    return api.post('/proofs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000 // 3 minuty
    }).then(r => r.data)
  },
  update: (id, data) => api.put(`/proofs/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/proofs/${id}`)
}

// Invoices
export const invoices = {
  getAll: (params) => api.get('/invoices', { params }).then(r => r.data),
  getOne: (id) => api.get(`/invoices/${id}`).then(r => r.data),
  create: (data) => api.post('/invoices', data).then(r => r.data),
  upload: (file, carrierId, period) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    formData.append('period', period)
    return api.post('/invoices/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    }).then(r => r.data)
  },
  update: (id, data) => api.put(`/invoices/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/invoices/${id}`),
  match: (id, proofId) => {
    const formData = new FormData()
    formData.append('proof_id', proofId)
    return api.post(`/invoices/${id}/match`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  }
}

// Route Plans
export const routePlans = {
  getAll: (params) => api.get('/route-plans', { params }).then(r => r.data),
  getOne: (id) => api.get(`/route-plans/${id}`).then(r => r.data),
  upload: (file, carrierId, validFrom) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('carrier_id', carrierId)
    if (validFrom) {
      formData.append('valid_from', validFrom)
    }
    return api.post('/route-plans/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    }).then(r => r.data)
  },
  uploadBatch: (files, carrierId) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('carrier_id', carrierId)
    return api.post('/route-plans/upload-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000 // 5 minut
    }).then(r => r.data)
  },
  compare: (planId, proofId) => api.get(`/route-plans/${planId}/compare/${proofId}`).then(r => r.data),
  comparePeriod: (proofId) => api.get(`/route-plans/compare-period/${proofId}`).then(r => r.data),
  dailyBreakdown: (proofId) => api.get(`/route-plans/daily-breakdown/${proofId}`).then(r => r.data),
  delete: (id) => api.delete(`/route-plans/${id}`)
}

// Analysis
export const analysis = {
  analyzeProof: (proofId) => api.post(`/analysis/proof/${proofId}`).then(r => r.data),
  getProofAnalysis: (proofId) => api.get(`/analysis/proof/${proofId}`).then(r => r.data),
  getDashboard: (params) => api.get('/analysis/dashboard', { params }).then(r => r.data)
}

// Alzabox - S DELŠÍM TIMEOUTEM pro velké soubory
export const alzabox = {
  // Import - 5 minut timeout pro velké soubory
  importLocations: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/alzabox/import/locations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000 // 5 minut
    }).then(r => r.data)
  },
  
  importDeliveries: (file, deliveryType = 'DPO') => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/alzabox/import/deliveries?delivery_type=${deliveryType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000 // 5 minut
    }).then(r => r.data)
  },
  
  // Delete
  deleteLocations: () => 
    api.delete('/alzabox/data/locations').then(r => r.data),
  
  deleteDeliveries: (deliveryType = null) => {
    const url = deliveryType 
      ? `/alzabox/data/deliveries?delivery_type=${deliveryType}`
      : '/alzabox/data/deliveries'
    return api.delete(url).then(r => r.data)
  },
  
  // Stats (s carrier_id filtrem)
  getSummary: (params = {}) => 
    api.get('/alzabox/stats/summary', { params }).then(r => r.data),
  
  getByCarrier: (params = {}) =>
    api.get('/alzabox/stats/by-carrier', { params }).then(r => r.data),
  
  getByRoute: (params = {}) => 
    api.get('/alzabox/stats/by-route', { params }).then(r => r.data),
  
  getByDay: (params = {}) => 
    api.get('/alzabox/stats/by-day', { params }).then(r => r.data),
  
  // Drill-down
  getByBox: (params = {}) =>
    api.get('/alzabox/stats/by-box', { params }).then(r => r.data),
  
  getBoxDetail: (boxId, params = {}) =>
    api.get(`/alzabox/box/${boxId}/detail`, { params }).then(r => r.data),
  
  // Metadata
  getCarriers: () =>
    api.get('/alzabox/carriers').then(r => r.data),
  
  getCountries: () => 
    api.get('/alzabox/countries').then(r => r.data),
    
  getBoxes: (params = {}) =>
    api.get('/alzabox/boxes', { params }).then(r => r.data),
    
  getRoutes: (params = {}) =>
    api.get('/alzabox/routes', { params }).then(r => r.data),
  
  // Diagnostika
  getDiagnostics: () =>
    api.get('/alzabox/diagnostics/carrier-mapping').then(r => r.data)
}

export default api
