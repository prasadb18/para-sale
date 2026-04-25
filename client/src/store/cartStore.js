import { create } from 'zustand'
import { trackAddToCart } from '../lib/analytics'

const LOCAL_STORAGE_CART_KEY = '1shopstore_cart'
const LOCAL_STORAGE_SVC_KEY  = '1shopstore_services'

const loadCartFromStorage = () => {
  try {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(LOCAL_STORAGE_CART_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveCartToStorage = (items) => {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(items))
  } catch {
    // no-op
  }
}

const loadServicesFromStorage = () => {
  try {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(LOCAL_STORAGE_SVC_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveServicesToStorage = (svcs) => {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(LOCAL_STORAGE_SVC_KEY, JSON.stringify(svcs))
  } catch {
    // no-op
  }
}

const buildCartState = (items) => ({
  items,
  count: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
  total: items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
    0
  )
})

const buildAddNotice = (product, items) => {
  const baseId = product.productId ?? product.id
  const variantKey = product.variantId ? `${baseId}_${product.variantId}` : String(baseId)
  const cartItem = items.find(item => String(item.id) === variantKey)
  const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0)

  return {
    key: `${variantKey}-${Date.now()}`,
    productId: baseId,
    name: product.name,
    productQty: Number(cartItem?.qty || 1),
    count
  }
}

const useCartStore = create((set) => ({
  ...buildCartState(loadCartFromStorage()),
  serviceBookings: loadServicesFromStorage(),
  notice: null,

  addItem: (product) =>
    set((state) => {
      const baseId = product.productId ?? product.id
      const cartId = product.variantId
        ? `${baseId}_${product.variantId}`
        : String(baseId)
      const existing = state.items.find(item => String(item.id) === cartId)
      const nextItems = existing
        ? state.items.map(item =>
            String(item.id) === cartId
              ? { ...item, qty: Number(item.qty || 0) + 1 }
              : item
          )
        : [
            ...state.items,
            {
              ...product,
              id: cartId,
              productId: baseId,
              price: Number(product.price || 0),
              mrp: Number(product.mrp || 0),
              qty: 1
            }
          ]

      saveCartToStorage(nextItems)
      trackAddToCart(product, existing ? existing.qty + 1 : 1)
      return {
        ...buildCartState(nextItems),
        notice: buildAddNotice(product, nextItems)
      }
    }),

  removeItem: (id) =>
    set((state) => {
      const nextItems = state.items.filter(item => item.id !== id)
      saveCartToStorage(nextItems)
      return {
        ...buildCartState(nextItems),
        notice: null
      }
    }),

  updateQty: (id, qty) =>
    set((state) => {
      const nextQty = Number(qty || 0)

      if (nextQty < 1) {
        const filtered = state.items.filter(item => item.id !== id)
        saveCartToStorage(filtered)
        return {
          ...buildCartState(filtered),
          notice: null
        }
      }

      const nextItems = state.items.map(item =>
        item.id === id ? { ...item, qty: nextQty } : item
      )

      saveCartToStorage(nextItems)
      return {
        ...buildCartState(nextItems),
        notice: null
      }
    }),

  clearCart: () => {
    saveCartToStorage([])
    set({
      ...buildCartState([]),
      notice: null
    })
  },

  setItems: (items) => {
    saveCartToStorage(items)
    set({
      ...buildCartState(items),
      notice: null
    })
  },

  mergeItems: (items) =>
    set((state) => {
      const merged = [...state.items]

      for (const incoming of items) {
        const existing = merged.find(item => item.id === incoming.id)
        if (existing) {
          existing.qty = Number(existing.qty || 0) + Number(incoming.qty || 0)
        } else {
          merged.push({ ...incoming })
        }
      }

      saveCartToStorage(merged)
      return {
        ...buildCartState(merged),
        notice: null
      }
    }),

  clearNotice: () => set({ notice: null }),

  addServiceBooking: (booking) =>
    set((state) => {
      // Replace if same service_type already booked, else append
      const exists = state.serviceBookings.find(b => b.service_type === booking.service_type)
      const next = exists
        ? state.serviceBookings.map(b => b.service_type === booking.service_type ? booking : b)
        : [...state.serviceBookings, booking]
      saveServicesToStorage(next)
      return { serviceBookings: next }
    }),

  removeServiceBooking: (service_type) =>
    set((state) => {
      const next = state.serviceBookings.filter(b => b.service_type !== service_type)
      saveServicesToStorage(next)
      return { serviceBookings: next }
    }),

  clearServiceBookings: () => {
    saveServicesToStorage([])
    set({ serviceBookings: [] })
  }
}))

export default useCartStore
