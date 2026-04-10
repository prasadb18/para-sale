import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_OPTIONS = ['pending', 'confirmed', 'assigned', 'completed', 'cancelled']
const STATUS = {
  pending:   { bg: '#fff8e1', color: '#f39c12' },
  confirmed: { bg: '#e3f2fd', color: '#1565c0' },
  assigned:  { bg: '#e8f5e9', color: '#2e7d32' },
  completed: { bg: '#f3e5f5', color: '#6a1b9a' },
  cancelled: { bg: '#fce4ec', color: '#c62828' }
}
const SVC_ICON  = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [extraInput, setExtraInput] = useState({})
  const [noteInput, setNoteInput] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    fetchBookings()
    fetchTechnicians()
  }, [])

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('service_bookings')
      .select('*, technicians(id, name, phone)')
      .order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .eq('is_active', true)
      .order('specialization')
    setTechnicians(data || [])
  }

  const updateBooking = async (id, patch) => {
    setSaving(id)
    await supabase.from('service_bookings').update(patch).eq('id', id)
    setSaving(null)
    fetchBookings()
  }

  const handleStatusChange = (id, status) => updateBooking(id, { status })

  const handleAssign = (id, technician_id) => {
    updateBooking(id, { technician_id: technician_id || null, status: technician_id ? 'assigned' : 'confirmed' })
  }

  const handleSaveExtra = (id) => {
    const extra = parseFloat(extraInput[id] || 0)
    const note = noteInput[id] || ''
    updateBooking(id, {
      extra_charges: extra,
      admin_notes: note || null
    })
  }

  const visible = bookings.filter(b => {
    if (filterStatus && b.status !== filterStatus) return false
    if (filterType && b.service_type !== filterType) return false
    return true
  })

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = bookings.filter(b => b.status === s).length
    return acc
  }, {})

  return (
    <div className="admin-products-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Service Bookings</h1>
          <p className="admin-page-sub">
            {bookings.length} total · {counts.pending} pending · {counts.assigned} assigned
          </p>
        </div>
      </div>

      {/* Status summary pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {STATUS_OPTIONS.map(s => {
          const st = STATUS[s]
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              style={{
                padding: '5px 14px', borderRadius: 20, border: `2px solid ${filterStatus === s ? st.color : 'transparent'}`,
                background: st.bg, color: st.color, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
            </button>
          )
        })}
        <button
          onClick={() => setFilterType(filterType === 'electrical' ? '' : 'electrical')}
          style={{ padding: '5px 14px', borderRadius: 20, border: `2px solid ${filterType === 'electrical' ? '#1565c0' : '#eee'}`, background: '#e8f1fb', color: '#1565c0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >⚡ Electrical</button>
        <button
          onClick={() => setFilterType(filterType === 'plumbing' ? '' : 'plumbing')}
          style={{ padding: '5px 14px', borderRadius: 20, border: `2px solid ${filterType === 'plumbing' ? '#00695c' : '#eee'}`, background: '#e0f5f5', color: '#00695c', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >🔧 Plumbing</button>
        <button
          onClick={() => setFilterType(filterType === 'painting' ? '' : 'painting')}
          style={{ padding: '5px 14px', borderRadius: 20, border: `2px solid ${filterType === 'painting' ? '#e65100' : '#eee'}`, background: '#fff8e1', color: '#e65100', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >🎨 Painting</button>
      </div>

      {loading ? (
        <div className="loading-state"><p>Loading bookings...</p></div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__icon">🛠️</p>
          <h3 className="empty-state__title">No bookings found</h3>
        </div>
      ) : (
        <div className="admin-product-list">
          {visible.map(b => {
            const st = STATUS[b.status] || STATUS.pending
            const isOpen = expanded === b.id
            const matchedTechs = technicians.filter(t => t.specialization === b.service_type)
            return (
              <div key={b.id} className="admin-product-card" style={{ borderLeft: `4px solid ${st.color}` }}>
                {/* Summary row */}
                <div
                  className="admin-product-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                >
                  <div style={{ fontSize: 28, minWidth: 36 }}>{SVC_ICON[b.service_type]}</div>
                  <div className="admin-product-info">
                    <p className="admin-product-name">
                      {SVC_LABEL[b.service_type]} — {b.customer_name || b.guest_name}
                    </p>
                    <p className="admin-product-meta">
                      📞 {b.customer_phone || b.guest_phone} · 📅 {b.scheduled_date} · {b.time_slot}
                    </p>
                    <p className="admin-product-meta">
                      📍 {b.address?.line}, {b.address?.city}
                    </p>
                    {b.technicians && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#2e7d32', fontWeight: 600 }}>
                        👷 {b.technicians.name} · {b.technicians.phone}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <span style={{ ...badgeStyle, background: st.bg, color: st.color }}>
                      {b.status}
                    </span>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#888' }}>
                      ₹{(b.visiting_charge || 200) + (b.extra_charges || 0)}
                    </p>
                    <p style={{ margin: 2, fontSize: '0.75rem', color: '#bbb' }}>
                      {isOpen ? '▲ collapse' : '▼ manage'}
                    </p>
                  </div>
                </div>

                {/* Expanded actions */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Description */}
                    {b.description && (
                      <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 14px', fontSize: '0.88rem' }}>
                        <strong>Customer note:</strong> {b.description}
                      </div>
                    )}

                    {/* Status control */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Status:</span>
                      {STATUS_OPTIONS.filter(s => s !== b.status).map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(b.id, s)}
                          disabled={saving === b.id}
                          style={{ ...actionBtn, background: STATUS[s].bg, color: STATUS[s].color, border: `1px solid ${STATUS[s].color}` }}
                        >
                          → {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Assign technician */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Assign Technician:</span>
                      <select
                        className="input"
                        style={{ maxWidth: 260 }}
                        value={b.technician_id || ''}
                        onChange={e => handleAssign(b.id, e.target.value)}
                        disabled={saving === b.id}
                      >
                        <option value="">— Not assigned —</option>
                        {matchedTechs.map(t => (
                          <option key={t.id} value={t.id}>{t.name} · {t.phone}</option>
                        ))}
                        {matchedTechs.length === 0 && (
                          <option disabled>No {b.service_type} technicians available</option>
                        )}
                      </select>
                    </div>

                    {/* Extra charges + notes */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="field" style={{ maxWidth: 180 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Extra charges (₹)</span>
                        <input
                          className="input"
                          type="number"
                          placeholder="0"
                          defaultValue={b.extra_charges || ''}
                          onChange={e => setExtraInput(x => ({ ...x, [b.id]: e.target.value }))}
                        />
                      </div>
                      <div className="field" style={{ flex: 1, minWidth: 200 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Admin notes</span>
                        <input
                          className="input"
                          placeholder="e.g. Customer confirmed, waiting for parts..."
                          defaultValue={b.admin_notes || ''}
                          onChange={e => setNoteInput(n => ({ ...n, [b.id]: e.target.value }))}
                        />
                      </div>
                      <button
                        className="button button--primary button--sm"
                        onClick={() => handleSaveExtra(b.id)}
                        disabled={saving === b.id}
                      >
                        {saving === b.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    {/* Pricing summary */}
                    <div style={{ background: '#f1f8f1', borderRadius: 8, padding: '10px 14px', fontSize: '0.88rem' }}>
                      Visiting charge: ₹{b.visiting_charge || 200} + Extra: ₹{b.extra_charges || 0} = <strong>₹{(b.visiting_charge || 200) + (b.extra_charges || 0)}</strong>
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const badgeStyle = {
  padding: '3px 10px', borderRadius: 20, fontSize: '12px', fontWeight: 700, display: 'inline-block'
}
const actionBtn = {
  padding: '5px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
}
