import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/storefront'

const STEPS = ['pending', 'confirmed', 'dispatched', 'delivered']
const STEP_META = {
  pending: { label: 'Order Placed', desc: 'We have received your order.', color: '#f59e0b' },
  confirmed: { label: 'Confirmed', desc: 'Your order is being prepared for dispatch.', color: '#1565c0' },
  dispatched: { label: 'Out for Delivery', desc: 'Your order is on the way.', color: '#7c3aed' },
  delivered: { label: 'Delivered', desc: 'Your order has been delivered.', color: '#15803d' },
  cancelled: { label: 'Cancelled', desc: 'This order was cancelled.', color: '#dc2626' }
}

export default function OrderTracking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(quantity, price_at_order, products(name))')
      .eq('id', id)
      .single()
      .then(({ data }) => setOrder(data || null))
      .finally(() => setLoading(false))

    const channel = supabase
      .channel(`order-track-web-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, payload => {
        setOrder(current => current ? { ...current, ...payload.new } : payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  if (loading) {
    return <div className="storefront-page shell"><div className="loading-state"><p>Loading tracking...</p></div></div>
  }

  if (!order) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">📦</p>
          <h2 className="empty-state__title">Order not found</h2>
          <button className="button button--primary" onClick={() => navigate('/orders')}>Back to orders</button>
        </div>
      </div>
    )
  }

  const status = order.status || 'pending'
  const statusMeta = STEP_META[status] || STEP_META.pending
  const currentIndex = STEPS.indexOf(status)

  return (
    <div className="storefront-page shell">
      <button className="text-link" onClick={() => navigate('/orders')}>← Back to orders</button>

      <section className="order-track-hero panel">
        <p className="eyebrow">Live Tracking</p>
        <h1 className="page-header__title">Order #{order.id.slice(-8).toUpperCase()}</h1>
        <p className="section-copy">{statusMeta.desc}</p>
        <p className="order-track-hero__total">Total: {formatCurrency(order.total)}</p>
      </section>

      <section className="order-track-steps panel">
        {status === 'cancelled' ? (
          <div className="order-track-step order-track-step--active">
            <div className="order-track-step__dot" style={{ background: statusMeta.color }} />
            <div>
              <p className="order-track-step__title">{statusMeta.label}</p>
              <p className="order-track-step__desc">{statusMeta.desc}</p>
            </div>
          </div>
        ) : (
          STEPS.map((step, index) => {
            const meta = STEP_META[step]
            const isDone = index <= currentIndex
            const isActive = index === currentIndex
            return (
              <div key={step} className={`order-track-step ${isActive ? 'order-track-step--active' : ''}`}>
                <div className={`order-track-step__dot ${isDone ? 'order-track-step__dot--done' : ''}`} style={isActive ? { background: meta.color } : null} />
                <div>
                  <p className="order-track-step__title">{meta.label}</p>
                  <p className="order-track-step__desc">{meta.desc}</p>
                </div>
              </div>
            )
          })
        )}
      </section>

      <section className="order-track-items panel">
        <h2 className="section-title">Items</h2>
        {(order.order_items || []).map((item, index) => (
          <div key={`${item.product_id || index}-${index}`} className="line-item">
            <span><strong>{item.products?.name || 'Product'}</strong></span>
            <span>x{item.quantity}</span>
            <span>{formatCurrency(item.price_at_order * item.quantity)}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
