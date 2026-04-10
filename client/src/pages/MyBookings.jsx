import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

const STATUS = {
  pending:   { label: 'Pending',   bg: '#fff8e1', color: '#f39c12' },
  confirmed: { label: 'Confirmed', bg: '#e3f2fd', color: '#1565c0' },
  assigned:  { label: 'Assigned',  bg: '#e8f5e9', color: '#2e7d32' },
  completed: { label: 'Completed', bg: '#f3e5f5', color: '#6a1b9a' },
  cancelled: { label: 'Cancelled', bg: '#fce4ec', color: '#c62828' }
}

const SVC_ICON = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }

export default function MyBookings() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('service_bookings')
      .select('*, technicians(name, phone)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data || [])
        setLoading(false)
      })
  }, [user])

  if (!user) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">🔒</p>
          <h2 className="empty-state__title">Sign in to view bookings</h2>
          <button className="button button--primary" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="storefront-page shell">
        <div className="loading-state"><p>Loading bookings...</p></div>
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">🛠️</p>
          <h2 className="empty-state__title">No bookings yet</h2>
          <p>Book an electrician, plumber or painter to get started.</p>
          <button className="button button--primary" style={{ marginTop: 16 }} onClick={() => navigate('/services')}>
            Book a Technician
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>My Bookings</h1>
        <button className="button button--primary button--sm" onClick={() => navigate('/services')}>
          + New Booking
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bookings.map(b => {
          const s = STATUS[b.status] || STATUS.pending
          return (
            <div key={b.id} className="my-booking-card">
              <div className="my-booking-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{SVC_ICON[b.service_type]}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>
                      {SVC_LABEL[b.service_type]}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                      {b.scheduled_date} · {b.time_slot}
                    </p>
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 700, fontSize: '0.8rem' }}>
                  {s.label}
                </span>
              </div>

              <div className="my-booking-card__body">
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  📍 {b.address?.line}, {b.address?.city}
                </p>
                {b.description && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-soft)' }}>
                    {b.description}
                  </p>
                )}
                {b.technicians && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', fontWeight: 600, color: '#2e7d32' }}>
                    👷 Assigned: {b.technicians.name} · {b.technicians.phone}
                  </p>
                )}
                {b.extra_charges > 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                    💰 Visiting: ₹{b.visiting_charge} + Extra: ₹{b.extra_charges} = <strong>₹{b.visiting_charge + b.extra_charges}</strong>
                  </p>
                )}
                {b.status === 'pending' && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#f39c12', background: '#fff8e1', padding: '6px 10px', borderRadius: 8 }}>
                    ⏳ We'll call you soon to confirm your appointment.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
