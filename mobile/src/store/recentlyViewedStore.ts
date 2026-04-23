import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../api'

const KEY     = '1shopstore_recently_viewed'
const MAX_LEN = 20

interface RecentlyViewedStore {
  items: Product[]
  addViewed:   (product: Product) => void
  clearViewed: () => void
  loadViewed:  () => Promise<void>
}

const persist = async (items: Product[]) => {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(items)) } catch {}
}

const useRecentlyViewedStore = create<RecentlyViewedStore>((set, get) => ({
  items: [],

  addViewed: (product) => {
    const filtered = get().items.filter(p => String(p.id) !== String(product.id))
    const next     = [product, ...filtered].slice(0, MAX_LEN)
    set({ items: next })
    persist(next)
  },

  clearViewed: () => {
    set({ items: [] })
    AsyncStorage.removeItem(KEY).catch(() => {})
  },

  loadViewed: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY)
      if (raw) set({ items: JSON.parse(raw) })
    } catch {}
  },
}))

export default useRecentlyViewedStore
