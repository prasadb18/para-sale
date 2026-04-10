import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../lib/storefront'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'

const orderStatuses = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']

const SVC_ICON  = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }
const SVC_STATUS = {
  pending:   { bg: '#fff8e1', color: '#f39c12' },
  confirmed: { bg: '#e3f2fd', color: '#1565c0' },
  assigned:  { bg: '#e8f5e9', color: '#2e7d32' },
  completed: { bg: '#f3e5f5', color: '#6a1b9a' },
  cancelled: { bg: '#fce4ec', color: '#c62828' }
}

const statusSteps = ['pending', 'confirmed', 'dispatched', 'delivered']

const getStatusBar = (current) => {
  const currentIndex = statusSteps.indexOf(current)
  return statusSteps.map((step, idx) => {
    const isDone = idx <= currentIndex
    return (
      <span
        key={step}
        className={`order-status-dot ${isDone ? 'order-status-dot--active' : ''}`}
      >
        {step.charAt(0).toUpperCase()}
      </span>
    )
  })
}

const getStatusEtaText = (status) => {
  if (status === 'pending') return 'Preparing your order (2–5 mins)'
  if (status === 'confirmed') return 'Packing in progress (3–7 mins)'
  if (status === 'dispatched') return 'Out for delivery (10–18 mins)'
  if (status === 'delivered') return 'Delivered'
  if (status === 'cancelled') return 'Order cancelled'

  return 'Processing'
}

const formatPaymentMethod = (paymentMethod) => {
  if (paymentMethod === 'cod') return 'Cash on delivery'
  if (paymentMethod === 'razorpay') return 'Razorpay'

  return 'UPI / online'
}

const formatPaymentStatus = (paymentStatus) => {
  if (!paymentStatus) return 'Pending'

  return paymentStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

const getPaymentStatusClass = (paymentStatus) => {
  if (paymentStatus === 'paid') return 'payment-status--paid'
  if (paymentStatus === 'authorized' || paymentStatus === 'created') {
    return 'payment-status--processing'
  }

  return 'payment-status--unpaid'
}

export default function Orders() {
  const { user } = useAuthStore()
  const { setItems } = useCartStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    fetchOrders()
  }, [navigate, user])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          addresses(label, line1, city),
          order_items(quantity, price_at_order, product_id, products(id, name, image_url, price)),
          service_bookings(id, service_type, scheduled_date, time_slot, visiting_charge, extra_charges, status, technicians(name, phone))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        // Fallback: fetch without nested product join (RLS might block it)
        const { data: fallback, error: fallbackError } = await supabase
          .from('orders')
          .select(`*, addresses(label, line1, city), order_items(quantity, price_at_order, product_id), service_bookings(id, service_type, scheduled_date, time_slot, visiting_charge, extra_charges, status)`)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (fallbackError) throw fallbackError
        setOrders(fallback || [])
        return
      }

      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error('Failed to load orders:', err)
      setMessage('Could not load your orders. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const reorderCart = (order) => {
    const items = (order.order_items || []).map((item) => ({
      id: item.product_id,
      name: item.products?.name || `Product ${item.product_id}`,
      price: Number(item.price_at_order || 0),
      qty: Number(item.quantity || 1),
      image_url: item.products?.image_url || ''
    }))

    setItems(items)
    setMessage(`Reorder loaded from #${order.id.slice(0, 8).toUpperCase()}. Continue to cart.`)
    navigate('/cart')
  }

  if (loading) {
    return (
      <div className="storefront-page shell">
        <div className="loading-state">
          <p>Loading orders...</p>
        </div>
      </div>
    )
  }

  if (message && orders.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">⚠️</p>
          <h2 className="empty-state__title">Something went wrong</h2>
          <p>{message}</p>
          <button type="button" className="button button--primary" onClick={fetchOrders}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">📦</p>
          <h2 className="empty-state__title">No orders yet</h2>
          <p>Your future orders will appear here with cleaner status tracking.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate('/')}
          >
            Start shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Order history</p>
          <h1 className="section-title">My orders</h1>
        </div>
      </div>

      {message ? (
        <div className="success-banner">{message}</div>
      ) : null}

      <div className="orders-list">
        {orders.map(order => {
          const statusKey = orderStatuses.includes(order.status)
            ? order.status
            : 'pending'

          return (
            <article key={order.id} className="order-history-card reveal">
              <div className="order-history__top">
                <div>
                  <p className="order-history__id">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="order-history__date">
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <span className={`status-pill status-pill--${statusKey}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              <div className="order-status-timeline">
                <div className="order-status-dots">{getStatusBar(order.status)}</div>
                <p className="order-status-eta">{getStatusEtaText(order.status)}</p>
              </div>

              <div className="line-item-list">
                {order.order_items.map((item, index) => (
                  <div key={index} className="line-item">
                    <span><strong>{item.products?.name}</strong></span>
                    <span>x{item.quantity}</span>
                    <span>{formatCurrency(item.price_at_order * item.quantity)}</span>
                  </div>
                ))}
                {(order.service_bookings || []).map(b => {
                  const s = SVC_STATUS[b.status] || SVC_STATUS.pending
                  return (
                    <div key={b.id} className="line-item line-item--service">
                      <span>
                        <strong>
                          {SVC_ICON[b.service_type]} {SVC_LABEL[b.service_type]} (Service)
                        </strong>
                        <span className="line-item__service-meta">
                          📅 {b.scheduled_date} · {b.time_slot}
                          {b.technicians?.name ? ` · 👷 ${b.technicians.name} (${b.technicians.phone})` : ' · Technician will be assigned'}
                        </span>
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>
                        {b.status}
                      </span>
                      <span>{formatCurrency((b.visiting_charge || 200) + (b.extra_charges || 0))}</span>
                    </div>
                  )
                })}
              </div>

              <div className="order-history__footer">
                <p className="order-history__address">
                  {order.addresses?.label} · {order.addresses?.line1}, {order.addresses?.city}
                </p>
                <p className="order-history__id">{formatCurrency(order.total)}</p>
              </div>

              <div className="payment-row">
                <span className="payment-tag">
                  {formatPaymentMethod(order.payment_method)}
                </span>
                <span
                  className={`payment-status ${getPaymentStatusClass(order.payment_status)}`}
                >
                  {formatPaymentStatus(order.payment_status)}
                </span>
              </div>

              {order.razorpay_payment_id ? (
                <p className="payment-reference">
                  Razorpay reference: {order.razorpay_payment_id}
                </p>
              ) : null}

              <div className="order-card-actions">
                <button
                  type="button"
                  className="button button--tertiary"
                  onClick={() => reorderCart(order)}
                >
                  Reorder this cart
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
