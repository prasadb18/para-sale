import { create } from 'zustand'

const MAX = 3

const useCompareStore = create((set, get) => ({
  items: [],
  add: (product) => {
    const { items } = get()
    if (items.length >= MAX) return false
    if (items.some(p => String(p.id) === String(product.id))) return true
    set({ items: [...items, product] })
    return true
  },
  remove: (id) => set(s => ({ items: s.items.filter(p => String(p.id) !== String(id)) })),
  clear: () => set({ items: [] }),
  isComparing: (id) => get().items.some(p => String(p.id) === String(id)),
}))

export default useCompareStore
