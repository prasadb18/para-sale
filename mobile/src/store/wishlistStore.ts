import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../api'

const KEY = '1shopstore_wishlist'

interface WishlistState {
  items: Product[]
  toggle: (product: Product) => void
  isWishlisted: (id: string | number) => boolean
  loadWishlist: () => Promise<void>
}

const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],

  toggle: (product) => {
    const items = get().items
    const exists = items.some(i => String(i.id) === String(product.id))
    const next = exists
      ? items.filter(i => String(i.id) !== String(product.id))
      : [...items, product]
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {})
    set({ items: next })
  },

  isWishlisted: (id) =>
    get().items.some(i => String(i.id) === String(id)),

  loadWishlist: async () => {
    try {
      const saved = await AsyncStorage.getItem(KEY)
      set({ items: saved ? JSON.parse(saved) : [] })
    } catch {
      set({ items: [] })
    }
  },
}))

export default useWishlistStore
