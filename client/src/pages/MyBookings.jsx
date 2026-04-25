import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

const STATUS = {
  pending:     { label: 'Pending',     bg: '#fff8e1', color: '#f39c12' },
  confirmed:   { label: 'Confirmed',   bg: '#e3f2fd', color: '#1565c0' },
  assigned:    { label: 'Assigned',    bg: '#e8f5e9', color: '#2e7d32' },
  in_progress: { label: 'In Progress', bg: '#e8f5e9', color: '#0c64c0' },
  completed:   { label: 'Completed',   bg: '#f3e5f5', color: '#6a1b9a' },
  cancelled:   { label: 'Cancelled',   bg: '#fce4ec', color: '#c62828' },
}
const SVC_ICON  = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }
const TAGS = ['Professional', 'On time', 'Clean work', 'Friendly', 'Skilled', 'Great value']

function RatingModal({ booking, userId, onClose, onDone }) {
  const [stars, setStars]   = useState(0)
  const [tags,  setTags]    = useState([])
  const [text,  setText]    = useState('')
  const [saving, setSaving] = useState(false)

  const toggleTag = (t) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const submit = async () => {
    if (stars === 0) return
    setSaving(true)
    await supabase.from('service_reviews').upsert(
      { booking_id: booking.id, user_id: userId, rating: stars, tags, review_text: text || null },
      { onConflict: 'booking_id' }
    )
    setSaving(false)
    onDone()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>Rate your service</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
          {SVC_LABEL[booking.service_type]}{booking.technicians ? ` · ${booking.technicians.name}` : ''}
        </p>

        {/* Stars */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setStars(n)}
              style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', color: n <= stars ? '#f59e0b' : '#d1d5db' }}>
              ★
            </button>
          ))}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {TAGS.map(t => (
            <button key={t} onClick={() => toggleTag(t)}
              className={`button button--sm ${tags.includes(t) ? 'button--primary' : 'button--secondary'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Text */}
        <textarea
          className="form-input form-textarea"
          rows={3}
          placeholder="Share your experience (optional)"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="button button--secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="button button--primary" style={{ flex: 1 }} disabled={stars === 0 || saving} onClick={submit}>
            {saving ? 'Saving…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyBookings() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [bookings,  setBookings]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [ratingB,   setRatingB]   = useState(null)
  const [ratedIds,  setRatedIds]  = useState(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('service_bookings')
      .select('*, technician_id, technicians(name, phone)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setBookings(list)
        setLoading(false)
        const completedIds = list.filter(b => b.status === 'completed').map(b => b.id)
        if (completedIds.length > 0) {
          supabase.from('service_reviews').select('booking_id').in('booking_id', completedIds)
            .then(({ data: revs }) => setRatedIds(new Set((revs || []).map(r => r.booking_id))))
        }
      })
  }, [user])

  if (!user) return (
    <div className="storefront-page shell">
      <div className="empty-state">
        <p className="empty-state__icon">🔒</p>
        <h2 className="empty-state__title">Sign in to view bookings</h2>
        <button className="button button--primary" onClick={() => navigate('/login')}>Sign In</button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="storefront-page shell">
      <div className="loading-state"><p>Loading bookings…</p></div>
    </div>
  )

  if (bookings.length === 0) return (
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

  return (
    <div className="storefront-page shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>My Bookings</h1>
        <button className="button button--primary button--sm" onClick={() => navigate('/services')}>+ New</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bookings.map(b => {
          const s = STATUS[b.status] || STATUS.pending
          return (
            <div key={b.id} className="booking-card">
              <div className="booking-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{SVC_ICON[b.service_type]}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{SVC_LABEL[b.service_type]}</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-soft)' }}>{b.scheduled_date} · {b.time_slot}</p>
                  </div>
                </div>
                <span className="booking-status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
              </div>

              <div className="booking-card__body">
                <p>📍 {b.address?.line}, {b.address?.city}</p>
                {b.description && <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>{b.description}</p>}
                {b.technicians && (
                  <p style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.88rem' }}>
                    👷 {b.technicians.name} · {b.technicians.phone}
                  </p>
                )}
                {b.extra_charges > 0 && (
                  <p style={{ fontSize: '0.88rem' }}>
                    💰 Visiting: ₹{b.visiting_charge} + Extra: ₹{b.extra_charges} = <strong>₹{b.visiting_charge + b.extra_charges}</strong>
                  </p>
                )}

                {b.status === 'in_progress' && b.technician_id && (
                  <div className="booking-track-banner">
                    <span>🟢 Technician is on the way</span>
                    <a
                      href={`https://wa.me/${b.technicians?.phone?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button--sm button--primary"
                      style={{ fontSize: '0.8rem' }}
                    >
                      📞 Contact Technician
                    </a>
                  </div>
                )}
                {b.status === 'pending' && (
                  <p className="booking-pending-note">⏳ We'll call you soon to confirm.</p>
                )}
                {b.status === 'completed' && !ratedIds.has(b.id) && (
                  <button className="button button--secondary button--sm" style={{ marginTop: 8 }} onClick={() => setRatingB(b)}>
                    ⭐ Rate this service
                  </button>
                )}
                {b.status === 'completed' && ratedIds.has(b.id) && (
                  <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', marginTop: 8 }}>✓ Reviewed</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {ratingB && user && (
        <RatingModal
          booking={ratingB}
          userId={user.id}
          onClose={() => setRatingB(null)}
          onDone={() => { setRatedIds(p => new Set([...p, ratingB.id])); setRatingB(null) }}
        />
      )}
    </div>
  )
}
