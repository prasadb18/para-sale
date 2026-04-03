import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

export default function AdminRoute({ children }) {
  const { user, initialized } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    if (!initialized) return
    if (!user) {
      setIsAdmin(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const currentUser = data?.session?.user ?? user
      const appMeta = currentUser?.app_metadata
      const userMeta = currentUser?.user_metadata

      setIsAdmin(
        appMeta?.is_admin === true ||
        appMeta?.role === 'admin' ||
        userMeta?.is_admin === true ||
        userMeta?.role === 'admin'
      )
    })
  }, [initialized, user])

  if (!initialized || isAdmin === null) return (
    <p style={{ padding: '40px', textAlign: 'center' }}>Checking access...</p>
  )
  if (!user || !isAdmin) return <Navigate to="/" />
  return children
}
