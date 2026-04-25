import { useState } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

const FAQS = [
  { q: 'How long does delivery take?', a: 'We deliver within 1 business day across Mumbai, Thane, Kalyan-Dombivli, and Navi Mumbai. Orders placed before 3 PM are typically dispatched same day.' },
  { q: 'What is your return/exchange policy?', a: 'Most items can be exchanged within 7 days for manufacturing defects with proof of purchase and original packaging. Paints, opened electrical items, and custom orders are non-returnable.' },
  { q: 'How do I track my order?', a: 'You can track your order status in real time from the My Orders page after logging in. You\'ll also receive WhatsApp updates at each stage.' },
  { q: 'Can I cancel or modify my order?', a: 'Orders can be cancelled before dispatch by contacting us on WhatsApp. Once dispatched, cancellation is not possible but you may initiate an exchange after delivery.' },
  { q: 'Do you offer installation services?', a: 'Yes! We provide electricians, plumbers, and painters. Book from the Services page and a technician will visit at your preferred time.' },
  { q: 'What payment methods do you accept?', a: 'We accept Cash on Delivery (COD) and online payment via UPI, credit/debit cards through Razorpay. Wallet credits (from referrals) can also be applied at checkout.' },
  { q: 'Is there a minimum order value?', a: 'No minimum order value. Delivery is free on orders above ₹500. A ₹50 delivery charge applies for smaller orders.' },
  { q: 'How do referral codes work?', a: 'Share your unique referral code with friends. When they sign up and place their first order, both of you get ₹50 added to your wallets automatically.' },
]

function FAQ({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item ${open ? 'faq-item--open' : ''}`}>
      <button className="faq-item__q" onClick={() => setOpen(v => !v)}>
        <span>{item.q}</span>
        <span className="faq-item__chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <p className="faq-item__a">{item.a}</p>}
    </div>
  )
}

export default function HelpSupport() {
  const { user } = useAuthStore()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email,   setEmail]   = useState(user?.email || '')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    try {
      await supabase.from('support_tickets').insert({
        user_id: user?.id ?? null,
        email:   email.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
        status:  'open',
      })
      setSent(true)
      setSubject(''); setMessage('')
    } catch { /* silently continue */ }
    finally { setSending(false) }
  }

  return (
    <div className="storefront-page shell">
      <div className="help-hero">
        <span style={{ fontSize: 48 }}>🛟</span>
        <h1 className="help-hero__title">Help & Support</h1>
        <p className="help-hero__sub">Mon–Sat · 9 AM – 7 PM</p>
      </div>

      {/* Quick actions */}
      <div className="help-actions">
        <a
          href="https://wa.me/919082808482"
          target="_blank"
          rel="noopener noreferrer"
          className="button button--primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          💬 Chat on WhatsApp
        </a>
        <a href="tel:+919082808482" className="button button--secondary">
          📞 Call Us
        </a>
      </div>

      {/* FAQ */}
      <section className="help-section">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {FAQS.map((f, i) => <FAQ key={i} item={f} />)}
        </div>
      </section>

      {/* Support ticket */}
      <section className="help-section">
        <h2 className="section-title">Send a Support Request</h2>
        {sent ? (
          <div className="help-sent">
            <span style={{ fontSize: 36 }}>✅</span>
            <p style={{ fontWeight: 700, marginTop: 10 }}>We've received your message!</p>
            <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem' }}>Our team will respond within 24 hours.</p>
            <button className="button button--secondary button--sm" style={{ marginTop: 14 }} onClick={() => setSent(false)}>
              Send Another
            </button>
          </div>
        ) : (
          <form className="help-form" onSubmit={handleSubmit}>
            {!user && (
              <div className="form-group">
                <label className="form-label">Your Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input className="form-input" placeholder="e.g. Order issue, delivery query…" value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input form-textarea" rows={5} placeholder="Describe your issue in detail…" value={message} onChange={e => setMessage(e.target.value)} required />
            </div>
            <button className="button button--primary" type="submit" disabled={sending || !subject.trim() || !message.trim()}>
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
