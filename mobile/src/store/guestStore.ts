import { create } from 'zustand'

interface GuestState {
  name:     string
  phone:    string
  isGuest:  boolean
  setGuest: (name: string, phone: string) => void
  clear:    () => void
}

const useGuestStore = create<GuestState>((set) => ({
  name:    '',
  phone:   '',
  isGuest: false,

  setGuest: (name, phone) => set({ name, phone, isGuest: true }),
  clear:    ()            => set({ name: '', phone: '', isGuest: false }),
}))

export default useGuestStore
