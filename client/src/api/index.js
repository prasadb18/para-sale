import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

export const getCategories = () => api.get('/categories')
export const getProducts = (categorySlug, searchQuery) => {
  const params = new URLSearchParams()

  if (categorySlug) params.set('category', categorySlug)
  if (searchQuery?.trim()) params.set('search', searchQuery.trim())

  const queryString = params.toString()
  return api.get(`/products${queryString ? `?${queryString}` : ''}`)
}
export const getProduct = (id) => api.get(`/products/${id}`)

export const createRazorpayOrder = (payload) =>
  api.post('/payments/razorpay/order', payload)

export const verifyRazorpayPayment = (payload) =>
  api.post('/payments/razorpay/verify', payload)
