import { create } from 'zustand'

const STORAGE_KEY = '1shopstore_location'

const loadLocation = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

const saveLocation = (loc) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
  } catch {}
}

const useLocationStore = create((set) => ({
  location: loadLocation(),

  setLocation: (loc) => {
    saveLocation(loc)
    set({ location: loc })
  },

  clearLocation: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ location: null })
  }
}))

export default useLocationStore
