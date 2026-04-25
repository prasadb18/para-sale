import { create } from 'zustand'
import { Product } from '../api'

const MAX = 3

interface CompareState {
  items: Product[]
  add: (product: Product) => boolean   // returns false if already full
  remove: (id: string | number) => void
  clear: () => void
  isComparing: (id: string | number) => boolean
}

const useCompareStore = create<CompareState>((set, get) => ({
  items: [],

  add: (product) => {
    const { items } = get()
    if (items.length >= MAX) return false
    if (items.some(p => String(p.id) === String(product.id))) return true
    set({ items: [...items, product] })
    return true
  },

  remove: (id) =>
    set(s => ({ items: s.items.filter(p => String(p.id) !== String(id)) })),

  clear: () => set({ items: [] }),

  isComparing: (id) =>
    get().items.some(p => String(p.id) === String(id)),
}))

export default useCompareStore
