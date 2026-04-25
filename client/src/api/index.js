import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
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

export const getProductVariants = (productId) =>
  api.get(`/products/${productId}/variants`)

export const getProductReviews = (productId) =>
  api.get(`/products/${productId}/reviews`)

export const getProductReviewSummary = (productId) =>
  api.get(`/products/${productId}/reviews/summary`)

export const submitReview = (productId, payload) =>
  api.post(`/products/${productId}/reviews`, payload)

export const deleteReview = (productId, reviewId, user_id) =>
  api.delete(`/products/${productId}/reviews/${reviewId}`, { data: { user_id } })

export const createRazorpayOrder = (payload) =>
  api.post('/payments/razorpay/order', payload)

export const verifyRazorpayPayment = (payload) =>
  api.post('/payments/razorpay/verify', payload)
