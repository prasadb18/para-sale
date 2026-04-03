import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/profile'

let authSubscription

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  sendOTP: async (email) => {
    set({ loading: true })
    const { error } = await supabase.auth.signInWithOtp({ email })
    set({ loading: false })
    return { error }
  },

  verifyOTP: async (email, token) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    })
    if (data?.session) {
      await ensureProfile(data.user)
      set({ session: data.session, user: data.user })
    }
    set({ loading: false })
    return { data, error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  initAuth: async () => {
    if (get().initialized && authSubscription) return

    const { data } = await supabase.auth.getSession()

    set({
      session: data.session ?? null,
      user: data.session?.user ?? null,
      initialized: true
    })

    if (data.session?.user) {
      await ensureProfile(data.session.user)
    }

    if (!authSubscription) {
      const { data: listener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            await ensureProfile(session.user)
          }

          set({
            session,
            user: session?.user ?? null,
            initialized: true
          })
        }
      )

      authSubscription = listener.subscription
    }
  }
}))

export default useAuthStore
