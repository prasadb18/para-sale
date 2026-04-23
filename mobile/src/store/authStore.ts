import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/profile'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: unknown }>
  signUp: (email: string, password: string) => Promise<{ error: unknown }>
  signOut: () => Promise<void>
  initAuth: () => Promise<void>
}

let authSubscription: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'] | null = null

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  signIn: async (email, password) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data?.session) {
      await ensureProfile(data.user!)
      set({ session: data.session, user: data.user })
    }
    set({ loading: false })
    return { error }
  },

  signUp: async (email, password) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (data?.session) {
      await ensureProfile(data.user!)
      set({ session: data.session, user: data.user })
    }
    set({ loading: false })
    return { error }
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
      initialized: true,
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
            initialized: true,
          })
        }
      )
      authSubscription = listener.subscription
    }
  },
}))

export default useAuthStore
