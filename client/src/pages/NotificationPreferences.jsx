import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

const DEFAULT_PREFS = {
  order_updates: true,
  service_updates: true,
  promotional: true,
  back_in_stock: true,
  price_drops: true,
  new_arrivals: false,
}

const PREF_META = [
  { key: 'order_updates', title: 'Order Updates', desc: 'Confirmed, dispatched, delivered, and cancellation alerts' },
  { key: 'service_updates', title: 'Booking Updates', desc: 'Technician assigned, reminder, and completion alerts' },
  { key: 'promotional', title: 'Offers & Deals', desc: 'Discounts, seasonal sales, and coupon reminders' },
  { key: 'back_in_stock', title: 'Back in Stock', desc: 'When a watched item is available again' },
  { key: 'price_drops', title: 'Price Drops', desc: 'When a watched or wishlisted item gets cheaper' },
  { key: 'new_arrivals', title: 'New Arrivals', desc: 'New products in categories you browse often' },
]

export default function NotificationPreferences() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            order_updates: Boolean(data.order_updates),
            service_updates: Boolean(data.service_updates),
            promotional: Boolean(data.promotional),
            back_in_stock: Boolean(data.back_in_stock),
            price_drops: Boolean(data.price_drops),
            new_arrivals: Boolean(data.new_arrivals),
          })
        }
      })
      .finally(() => setLoading(false))
  }, [navigate, user])

  const savePreferences = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) {
      alert(error.message || 'Could not save your preferences.')
      return
    }
    alert('Preferences updated.')
  }

  if (loading) {
    return <div className="storefront-page shell"><div className="loading-state"><p>Loading preferences...</p></div></div>
  }

  return (
    <div className="storefront-page shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1 className="section-title">Notification Preferences</h1>
        </div>
      </div>

      <div className="policy-layout">
        {PREF_META.map(item => (
          <label key={item.key} className="pref-card">
            <div>
              <p className="pref-card__title">{item.title}</p>
              <p className="pref-card__desc">{item.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={e => setPrefs(current => ({ ...current, [item.key]: e.target.checked }))}
            />
          </label>
        ))}
      </div>

      <button className="button button--primary" style={{ marginTop: 20 }} onClick={savePreferences} disabled={saving}>
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}
