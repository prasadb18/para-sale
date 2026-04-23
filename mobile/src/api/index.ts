import axios from 'axios'

const api = axios.create({
  baseURL: `${process.env.EXPO_PUBLIC_API_URL}/api`,
})

export interface Product {
  id: string | number
  name: string
  price: number
  mrp: number
  stock: number
  brand?: string
  description?: string
  image_url?: string
  images?: string[]
  category_slug?: string
  category_name?: string
}

export interface Category {
  id: string | number
  name: string
  slug: string
}

export const getCategories = () => api.get<Category[]>('/categories')

export const getProducts = (categorySlug?: string, searchQuery?: string) => {
  const params = new URLSearchParams()
  if (categorySlug) params.set('category', categorySlug)
  if (searchQuery?.trim()) params.set('search', searchQuery.trim())
  const qs = params.toString()
  return api.get<Product[]>(`/products${qs ? `?${qs}` : ''}`)
}

export const getProduct = (id: string | number) =>
  api.get<Product>(`/products/${id}`)

export const createRazorpayOrder = (payload: unknown) =>
  api.post('/payments/razorpay/order', payload)

export const verifyRazorpayPayment = (payload: unknown) =>
  api.post('/payments/razorpay/verify', payload)

export interface ProductVariant {
  id: string
  attribute_name: string
  value: string
  price: number
  mrp: number | null
  stock: number
  sku: string | null
  sort_order: number
}

export const getProductVariants = (productId: string | number) =>
  api.get<ProductVariant[]>(`/products/${productId}/variants`)

export interface Review {
  id: string
  product_id: number
  user_id: string
  rating: number
  review_text: string | null
  reviewer_name: string
  created_at: string
}

export interface ReviewSummary {
  avg: number
  count: number
  dist: { 1: number; 2: number; 3: number; 4: number; 5: number }
}

export const getProductReviews = (productId: string | number) =>
  api.get<Review[]>(`/products/${productId}/reviews`)

export const getProductReviewSummary = (productId: string | number) =>
  api.get<ReviewSummary>(`/products/${productId}/reviews/summary`)

export const submitReview = (
  productId: string | number,
  payload: { user_id: string; rating: number; review_text?: string; reviewer_name?: string }
) => api.post<Review>(`/products/${productId}/reviews`, payload)

export const deleteReview = (productId: string | number, reviewId: string, user_id: string) =>
  api.delete(`/products/${productId}/reviews/${reviewId}`, { data: { user_id } })
