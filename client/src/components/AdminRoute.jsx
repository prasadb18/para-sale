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

    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin === true)
      })
  }, [initialized, user])

  if (!initialized || isAdmin === null) return (
    <p style={{ padding: '40px', textAlign: 'center' }}>Checking access...</p>
  )
  if (!user) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/" />
  return children
}
