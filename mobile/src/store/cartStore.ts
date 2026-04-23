import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CART_KEY = '1shopstore_cart'
const SVC_KEY  = '1shopstore_services'

export interface CartItem {
  id: string | number         // composite key: productId or `productId_variantId`
  productId?: string | number // original product id (defaults to id when absent)
  name: string
  price: number
  mrp: number
  qty: number
  image_url?: string
  brand?: string
  spec?: string
  variantId?: string
  variantLabel?: string      // e.g. "Size: 1.5mm"
  categories?: { name: string }
}

export interface ServiceBooking {
  id: string
  service_type: 'electrical' | 'plumbing' | 'painting'
  customer_name: string
  customer_phone: string
  scheduled_date: string
  time_slot: string
  visiting_charge: number
  extra_charges: number
}

interface CartState {
  items: CartItem[]
  count: number
  total: number
  serviceBookings: ServiceBooking[]
  addItem: (product: Omit<CartItem, 'qty'>) => void
  removeItem: (id: string | number) => void
  updateQty: (id: string | number, qty: number) => void
  clearCart: () => void
  loadCart: () => Promise<void>
  addServiceBooking: (booking: ServiceBooking) => void
  removeServiceBooking: (service_type: string) => void
  clearServiceBookings: () => void
}

const buildState = (items: CartItem[]) => ({
  items,
  count: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
  total: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
})

const persistCart = async (items: CartItem[]) => {
  try { await AsyncStorage.setItem(CART_KEY, JSON.stringify(items)) } catch {}
}

const persistSvc = async (svcs: ServiceBooking[]) => {
  try { await AsyncStorage.setItem(SVC_KEY, JSON.stringify(svcs)) } catch {}
}

const useCartStore = create<CartState>((set) => ({
  items: [],
  count: 0,
  total: 0,
  serviceBookings: [],

  loadCart: async () => {
    try {
      const [savedCart, savedSvc] = await Promise.all([
        AsyncStorage.getItem(CART_KEY),
        AsyncStorage.getItem(SVC_KEY),
      ])
      const rawItems: CartItem[] = savedCart ? JSON.parse(savedCart) : []
      // Back-compat: old items stored before productId field was added
      const items: CartItem[] = rawItems.map(i => ({ ...i, productId: i.productId ?? i.id }))
      const serviceBookings: ServiceBooking[] = savedSvc ? JSON.parse(savedSvc) : []
      set({
        ...buildState(Array.isArray(items) ? items : []),
        serviceBookings: Array.isArray(serviceBookings) ? serviceBookings : [],
      })
    } catch {
      set({ ...buildState([]), serviceBookings: [] })
    }
  },

  addItem: (product) =>
    set((state) => {
      const baseId = product.productId ?? product.id
      const cartId = product.variantId
        ? `${baseId}_${product.variantId}`
        : String(baseId)
      const existing = state.items.find(i => i.id === cartId)
      const nextItems = existing
        ? state.items.map(i => i.id === cartId ? { ...i, qty: i.qty + 1 } : i)
        : [...state.items, {
            ...product,
            id: cartId,
            productId: baseId,
            price: Number(product.price || 0),
            mrp: Number(product.mrp || 0),
            qty: 1,
          }]
      persistCart(nextItems)
      return buildState(nextItems)
    }),

  removeItem: (id) =>
    set((state) => {
      const nextItems = state.items.filter(i => i.id !== id)
      persistCart(nextItems)
      return buildState(nextItems)
    }),

  updateQty: (id, qty) =>
    set((state) => {
      const nextQty = Number(qty || 0)
      if (nextQty < 1) {
        const filtered = state.items.filter(i => i.id !== id)
        persistCart(filtered)
        return buildState(filtered)
      }
      const nextItems = state.items.map(i => i.id === id ? { ...i, qty: nextQty } : i)
      persistCart(nextItems)
      return buildState(nextItems)
    }),

  clearCart: () => {
    persistCart([])
    set(buildState([]))
  },

  addServiceBooking: (booking) =>
    set((state) => {
      const exists = state.serviceBookings.find(b => b.service_type === booking.service_type)
      const next = exists
        ? state.serviceBookings.map(b => b.service_type === booking.service_type ? booking : b)
        : [...state.serviceBookings, booking]
      persistSvc(next)
      return { serviceBookings: next }
    }),

  removeServiceBooking: (service_type) =>
    set((state) => {
      const next = state.serviceBookings.filter(b => b.service_type !== service_type)
      persistSvc(next)
      return { serviceBookings: next }
    }),

  clearServiceBookings: () => {
    persistSvc([])
    set({ serviceBookings: [] })
  },
}))

export default useCartStore
