import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
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
  getAll: (carrierId) => api.get('/depots', { params: { carrierId } }).then(r => r.data),
  getOne: (id) => api.get(`/depots/${id}`).then(r => r.data),
  create: (data) => api.post('/depots', data).then(r => r.data),
  update: (id, data) => api.put(`/depots/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/depots/${id}`)
}

// Contracts
export const contracts = {
  getAll: (carrierId) => api.get('/contracts', { params: { carrierId } }).then(r => r.data),
  getOne: (id) => api.get(`/contracts/${id}`).then(r => r.data),
  create: (data) => api.post('/contracts', data).then(r => r.data),
  update: (id, data) => api.put(`/contracts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/contracts/${id}`)
}

// Prices
export const prices = {
  getAll: (params) => api.get('/prices', { params }).then(r => r.data),
  getActive: (carrierId, type, date) => 
    api.get('/prices/active', { params: { carrierId, type, date } }).then(r => r.data),
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
    formData.append('carrierId', carrierId)
    formData.append('period', period)
    return api.post('/proofs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
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
    formData.append('carrierId', carrierId)
    formData.append('period', period)
    return api.post('/invoices/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
  update: (id, data) => api.put(`/invoices/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/invoices/${id}`),
  match: (id, proofId) => api.post(`/invoices/${id}/match`, { proofId }).then(r => r.data)
}

// Analysis
export const analysis = {
  analyzeProof: (proofId) => api.post(`/analysis/proof/${proofId}`).then(r => r.data),
  getProofAnalysis: (proofId) => api.get(`/analysis/proof/${proofId}`).then(r => r.data),
  getDashboard: (params) => api.get('/analysis/dashboard', { params }).then(r => r.data)
}

export default api
