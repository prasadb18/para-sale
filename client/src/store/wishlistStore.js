import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useWishlistStore = create(persist(
  (set, get) => ({
    items: [],
    toggle: (product) => {
      const items = get().items
      const exists = items.some(i => String(i.id) === String(product.id))
      set({ items: exists ? items.filter(i => String(i.id) !== String(product.id)) : [...items, product] })
    },
    isWishlisted: (id) => get().items.some(i => String(i.id) === String(id)),
    remove: (id) => set(s => ({ items: s.items.filter(i => String(i.id) !== String(id)) })),
    clear: () => set({ items: [] }),
  }),
  { name: '1shopstore_wishlist_web' }
))

export default useWishlistStore
