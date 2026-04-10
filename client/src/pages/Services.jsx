import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'

const SERVICE_TYPES = [
  {
    id: 'electrical',
    icon: '⚡',
    label: 'Electrician',
    color: '#e8f1fb',
    accent: '#1565c0',
    desc: 'Wiring, switchboard fitting, MCB installation, fan & light fixing',
    examples: ['Switch/socket replacement', 'Fan installation', 'MCB fitting', 'New wiring point']
  },
  {
    id: 'plumbing',
    icon: '🔧',
    label: 'Plumber',
    color: '#e0f5f5',
    accent: '#00695c',
    desc: 'Tap fitting, pipe repair, bathroom fittings, leakage fixing',
    examples: ['Tap/mixer fitting', 'Pipe leakage repair', 'Basin/toilet fitting', 'New water point']
  },
  {
    id: 'painting',
    icon: '🎨',
    label: 'Painter',
    color: '#fff8e1',
    accent: '#e65100',
    desc: 'Wall painting, primer application, texture & polish work',
    examples: ['Room painting', 'Primer application', 'Touch-up work', 'Wood polish/paint']
  }
]

const TIME_SLOTS = [
  'Morning (9 AM – 12 PM)',
  'Afternoon (12 PM – 4 PM)',
  'Evening (4 PM – 7 PM)'
]

const EMPTY_FORM = {
  service_type: '',
  name: '',
  phone: '',
  address_line: '',
  city: '',
  scheduled_date: '',
  time_slot: '',
  description: ''
}

export default function Services() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const addServiceBooking = useCartStore(s => s.addServiceBooking)
  const fromCart = searchParams.get('from') === 'cart'

  const [selected, setSelected] = useState(searchParams.get('type') || '')
  const [form, setForm] = useState({ ...EMPTY_FORM, service_type: searchParams.get('type') || '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    const type = searchParams.get('type')
    if (type) {
      setSelected(type)
      setForm(f => ({ ...f, service_type: type }))
      setTimeout(() => {
        document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [searchParams])

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setErrors(err => ({ ...err, [key]: '' }))
  }

  const selectType = (id) => {
    setSelected(id)
    setForm(f => ({ ...f, service_type: id }))
    setErrors(err => ({ ...err, service_type: '' }))
    setTimeout(() => {
      document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const validate = () => {
    const e = {}
    if (!form.service_type) e.service_type = 'Please select a service'
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.trim())) e.phone = 'Enter valid 10-digit phone'
    if (!form.address_line.trim()) e.address_line = 'Address is required'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.scheduled_date) e.scheduled_date = 'Please pick a date'
    if (!form.time_slot) e.time_slot = 'Please pick a time slot'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)

    const payload = {
      service_type: form.service_type,
      user_id: user?.id || null,
      guest_name: user ? null : form.name,
      guest_phone: user ? null : form.phone,
      customer_name: form.name,
      customer_phone: form.phone,
      address: { line: form.address_line, city: form.city },
      scheduled_date: form.scheduled_date,
      time_slot: form.time_slot,
      description: form.description || null,
      visiting_charge: 200,
      extra_charges: 0,
      status: 'pending'
    }

    const { data, error } = await supabase.from('service_bookings').insert(payload).select().single()
    setSubmitting(false)

    if (error) {
      alert('Booking failed: ' + error.message)
      return
    }

    // Add to cart store so it appears in cart bill
    addServiceBooking({
      id: data.id,
      service_type: data.service_type,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      scheduled_date: data.scheduled_date,
      time_slot: data.time_slot,
      visiting_charge: data.visiting_charge,
      extra_charges: data.extra_charges || 0
    })

    if (fromCart) {
      // Go back to cart immediately, no done screen
      navigate('/cart')
      return
    }

    setDone(data)
    setForm({ ...EMPTY_FORM })
    setSelected('')
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  if (done) {
    return (
      <div className="storefront-page shell">
        <div className="service-done">
          <span className="service-done__icon">✅</span>
          <h2 className="service-done__title">Booking Confirmed!</h2>
          <p className="service-done__sub">
            We'll call you on <strong>{done.customer_phone}</strong> to confirm the appointment.
          </p>
          <div className="service-done__summary">
            <p><strong>Service:</strong> {SERVICE_TYPES.find(s => s.id === done.service_type)?.label}</p>
            <p><strong>Date:</strong> {done.scheduled_date}</p>
            <p><strong>Slot:</strong> {done.time_slot}</p>
            <p><strong>Visiting charge:</strong> ₹200 (includes 1 fitting/small work)</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', marginTop: 4 }}>
              Extra charges (if any) will be discussed on-site before starting work.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {user && (
              <button className="button button--primary" onClick={() => navigate('/my-bookings')}>
                View My Bookings
              </button>
            )}
            <button className="button button--secondary" onClick={() => { setDone(null) }}>
              Book Another
            </button>
            <button className="button button--ghost" onClick={() => navigate('/')}>
              Back to Store
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page">
      {/* Hero */}
      <section className="shell" style={{ paddingTop: 20 }}>
        {fromCart && (
          <div className="service-from-cart-banner">
            🛒 You're booking a technician to go with your cart order.
            Once booked, you'll be taken back to review the full bill.
          </div>
        )}
        <div className="service-hero reveal">
          <div>
            <h1 className="service-hero__title">Book a Technician</h1>
            <p className="service-hero__sub">
              Electricians, Plumbers & Painters — available across Palava, Dombivli & Kalyan.
            </p>
            <div className="service-hero__pill">
              ₹200 visiting charge · 1 fitting/small work included · Extra work priced on-site
            </div>
          </div>
          <span style={{ fontSize: 56 }}>🛠️</span>
        </div>
      </section>

      {/* Service type cards */}
      <section className="shell storefront-section">
        <h2 className="section-title">Choose a Service</h2>
        <div className="service-type-grid">
          {SERVICE_TYPES.map(svc => (
            <button
              key={svc.id}
              type="button"
              className={`service-type-card reveal${selected === svc.id ? ' service-type-card--active' : ''}`}
              style={{ '--svc-bg': svc.color, '--svc-accent': svc.accent }}
              onClick={() => selectType(svc.id)}
            >
              <span className="service-type-card__icon">{svc.icon}</span>
              <div className="service-type-card__body">
                <p className="service-type-card__label">{svc.label}</p>
                <p className="service-type-card__desc">{svc.desc}</p>
                <ul className="service-type-card__examples">
                  {svc.examples.map(ex => <li key={ex}>{ex}</li>)}
                </ul>
              </div>
              {selected === svc.id && <span className="service-type-card__check">✓ Selected</span>}
            </button>
          ))}
        </div>
        {errors.service_type && <p className="field-error" style={{ marginTop: 8 }}>{errors.service_type}</p>}
      </section>

      {/* Booking form */}
      <section id="booking-form" className="shell storefront-section">
        <h2 className="section-title">Your Details</h2>
        <div className="service-booking-form">

          <div className="admin-form-row">
            <div className="field">
              <span>Full Name <span style={{ color: '#e53935' }}>*</span></span>
              <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="field">
              <span>Mobile Number <span style={{ color: '#e53935' }}>*</span></span>
              <input className="input" placeholder="10-digit number" value={form.phone} onChange={set('phone')} maxLength={10} />
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>
          </div>

          <div className="admin-form-row" style={{ marginTop: 14 }}>
            <div className="field">
              <span>Address / Flat / Building <span style={{ color: '#e53935' }}>*</span></span>
              <input className="input" placeholder="e.g. Flat 4B, Lodha Palava Phase 2" value={form.address_line} onChange={set('address_line')} />
              {errors.address_line && <p className="field-error">{errors.address_line}</p>}
            </div>
            <div className="field">
              <span>City / Area <span style={{ color: '#e53935' }}>*</span></span>
              <input className="input" placeholder="e.g. Dombivli East" value={form.city} onChange={set('city')} />
              {errors.city && <p className="field-error">{errors.city}</p>}
            </div>
          </div>

          <div className="admin-form-row" style={{ marginTop: 14 }}>
            <div className="field">
              <span>Preferred Date <span style={{ color: '#e53935' }}>*</span></span>
              <input className="input" type="date" min={minDate} value={form.scheduled_date} onChange={set('scheduled_date')} />
              {errors.scheduled_date && <p className="field-error">{errors.scheduled_date}</p>}
            </div>
            <div className="field">
              <span>Preferred Time Slot <span style={{ color: '#e53935' }}>*</span></span>
              <select className="input" value={form.time_slot} onChange={set('time_slot')}>
                <option value="">Select a slot</option>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
              {errors.time_slot && <p className="field-error">{errors.time_slot}</p>}
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <span>Describe the work <span style={{ color: 'var(--text-soft)', fontWeight: 400, fontSize: '0.8rem' }}>(optional but helpful)</span></span>
            <textarea
              className="input"
              style={{ height: 80, resize: 'vertical' }}
              placeholder="e.g. Need to install a new fan in bedroom and replace a socket in living room"
              value={form.description}
              onChange={set('description')}
            />
          </div>

          <div className="service-pricing-note">
            <strong>Pricing:</strong> ₹200 visiting charge includes 1 fitting or small work.
            Any additional work will be quoted on-site before starting. No hidden charges.
          </div>

          <button
            type="button"
            className="button button--primary button--full"
            style={{ marginTop: 16, padding: 14, fontSize: '1rem' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Booking...' : '📅 Book Technician'}
          </button>
        </div>
      </section>
    </div>
  )
}
