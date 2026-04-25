import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../lib/storefront'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'

const STATUS_META = {
  pending: { bg: '#fff8e1', color: '#f59e0b', label: 'Pending' },
  confirmed: { bg: '#e3f2fd', color: '#1565c0', label: 'Confirmed' },
  dispatched: { bg: '#e8f5e9', color: '#2e7d32', label: 'Dispatched' },
  delivered: { bg: '#f3e5f5', color: '#6a1b9a', label: 'Delivered' },
  cancelled: { bg: '#fce4ec', color: '#c62828', label: 'Cancelled' },
}

const SVC_ICON = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }
const ORDER_STEPS = ['pending', 'confirmed', 'dispatched', 'delivered']
const RETURN_REASONS = [
  'Wrong item delivered',
  'Item damaged / defective',
  'Item not as described',
  'Changed my mind',
  'Other'
]

function StatusTimeline({ status }) {
  const currentIndex = ORDER_STEPS.indexOf(status)
  if (status === 'cancelled' || currentIndex < 0) return null

  return (
    <div className="order-status-timeline">
      <div className="order-status-dots">
        {ORDER_STEPS.map((step, index) => (
          <span
            key={step}
            className={`order-status-dot ${index <= currentIndex ? 'order-status-dot--active' : ''}`}
          >
            {step.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      <p className="order-status-eta">{STATUS_META[status]?.label || 'Processing'}</p>
    </div>
  )
}

function OrderCard({
  order,
  returnRequest,
  onTrack,
  onCancel,
  onReorder,
  onReturn,
  onPrintInvoice
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[order.status] || STATUS_META.pending
  const isCancellable = ['pending', 'confirmed'].includes(order.status)

  return (
    <article className="order-history-card reveal">
      <button type="button" className="order-history__top order-history__top--button" onClick={() => setExpanded(value => !value)}>
        <div>
          <p className="order-history__id">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="order-history__date">
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="order-history__top-right">
          <span className="status-pill" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
          <span className="order-history__toggle">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      <StatusTimeline status={order.status} />

      <div className="order-history__footer">
        <p className="order-history__address">
          {order.addresses?.label || order.guest_name || 'Delivery'} · {order.addresses?.line1 || order.guest_address?.line1}, {order.addresses?.city || order.guest_address?.city}
        </p>
        <p className="order-history__id">{formatCurrency(order.total)}</p>
      </div>

      <div className="payment-row">
        <span className="payment-tag">{order.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay / Online'}</span>
        <span className={`payment-status ${order.payment_status === 'paid' ? 'payment-status--paid' : 'payment-status--unpaid'}`}>
          {(order.payment_status || 'pending').replace(/_/g, ' ')}
        </span>
      </div>

      <div className="order-card-actions order-card-actions--wrap">
        {['pending', 'confirmed', 'dispatched'].includes(order.status) && (
          <button type="button" className="button button--secondary button--sm" onClick={() => onTrack(order.id)}>
            Track Order
          </button>
        )}
        {isCancellable && (
          <button type="button" className="button button--secondary button--sm" onClick={() => onCancel(order)}>
            Cancel
          </button>
        )}
        <button type="button" className="button button--tertiary button--sm" onClick={() => onReorder(order)}>
          Buy Again
        </button>
        {(order.status === 'delivered' || order.payment_status === 'paid') && (
          <button type="button" className="button button--secondary button--sm" onClick={() => onPrintInvoice(order)}>
            Invoice
          </button>
        )}
      </div>

      {expanded && (
        <div className="order-history__expanded">
          <div className="line-item-list">
            {(order.order_items || []).map((item, index) => (
              <div key={`${item.product_id || index}-${index}`} className="line-item">
                <span>
                  <strong>{item.products?.name || `Product ${item.product_id}`}</strong>
                  {item.variant_label ? <span className="line-item__service-meta">{item.variant_label}</span> : null}
                </span>
                <span>x{item.quantity}</span>
                <span>{formatCurrency(item.price_at_order * item.quantity)}</span>
              </div>
            ))}
            {(order.service_bookings || []).map(booking => {
              const statusMeta = STATUS_META[booking.status] || STATUS_META.pending
              return (
                <div key={booking.id} className="line-item line-item--service">
                  <span>
                    <strong>{SVC_ICON[booking.service_type]} {SVC_LABEL[booking.service_type]} (Service)</strong>
                    <span className="line-item__service-meta">
                      {booking.scheduled_date} · {booking.time_slot}
                      {booking.technicians?.name ? ` · ${booking.technicians.name} (${booking.technicians.phone})` : ''}
                    </span>
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, background: statusMeta.bg, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                  <span>{formatCurrency((booking.visiting_charge || 200) + (booking.extra_charges || 0))}</span>
                </div>
              )
            })}
          </div>

          {order.status === 'delivered' && (
            <div className="order-history__return-block">
              {returnRequest ? (
                <p className="order-history__return-status">
                  Return request: <strong>{returnRequest.status}</strong> · {returnRequest.reason}
                </p>
              ) : (
                <div className="order-card-actions">
                  <button type="button" className="button button--secondary button--sm" onClick={() => onReturn(order.id)}>
                    Return / Refund
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default function Orders() {
  const { user } = useAuthStore()
  const { setItems } = useCartStore()
  const [orders, setOrders] = useState([])
  const [returnRequests, setReturnRequests] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      const ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          addresses(label, line1, city),
          order_items(quantity, price_at_order, product_id, variant_label, products(id, name, image_url, price)),
          service_bookings(id, service_type, scheduled_date, time_slot, visiting_charge, extra_charges, status, technicians(name, phone))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const [ordersRes, returnsRes] = await Promise.all([
        ordersQuery,
        supabase
          .from('return_requests')
          .select('order_id, reason, status')
          .eq('user_id', user.id)
      ])

      let resolvedOrders = ordersRes
      if (ordersRes.error && /variant_label/i.test(ordersRes.error.message || '')) {
        resolvedOrders = await supabase
          .from('orders')
          .select(`
            *,
            addresses(label, line1, city),
            order_items(quantity, price_at_order, product_id, products(id, name, image_url, price)),
            service_bookings(id, service_type, scheduled_date, time_slot, visiting_charge, extra_charges, status, technicians(name, phone))
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      }

      if (resolvedOrders.error) throw resolvedOrders.error
      if (returnsRes.error) throw returnsRes.error

      const nextReturnRequests = {}
      ;(returnsRes.data || []).forEach(item => {
        nextReturnRequests[item.order_id] = { reason: item.reason, status: item.status }
      })

      setOrders(resolvedOrders.data || [])
      setReturnRequests(nextReturnRequests)
    } catch (error) {
      console.error('Failed to load orders:', error)
      setMessage('Could not load your orders. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchOrders()
  }, [fetchOrders, navigate, user])

  const reorderCart = async (order) => {
    const items = (order.order_items || []).map(item => ({
      id: item.variant_label ? `${item.product_id}_${item.variant_label}` : item.product_id,
      productId: item.product_id,
      name: item.products?.name || `Product ${item.product_id}`,
      price: Number(item.price_at_order || 0),
      mrp: Number(item.products?.price || item.price_at_order || 0),
      qty: Number(item.quantity || 1),
      image_url: item.products?.image_url || '',
      variantLabel: item.variant_label || undefined
    }))
    setItems(items)
    setMessage(`Reorder loaded from #${order.id.slice(0, 8).toUpperCase()}. Continue to cart.`)
    navigate('/cart')
  }

  const cancelOrder = async (order) => {
    const isPaid = order.payment_status === 'paid'
    const confirmed = window.confirm(
      isPaid
        ? `Cancel order #${order.id.slice(-8).toUpperCase()}? Paid orders may take 5–7 business days to refund.`
        : `Cancel order #${order.id.slice(-8).toUpperCase()}?`
    )
    if (!confirmed) return

    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    if (error) {
      alert(error.message || 'Could not cancel this order.')
      return
    }

    if (order.service_bookings?.length > 0) {
      await supabase.from('service_bookings').update({ status: 'cancelled' }).eq('order_id', order.id)
    }

    setOrders(current => current.map(item => item.id === order.id ? { ...item, status: 'cancelled' } : item))
  }

  const requestReturn = async (orderId) => {
    const reason = window.prompt(`Return reason:\n${RETURN_REASONS.join('\n')}`, RETURN_REASONS[0])
    if (!reason) return
    const { error } = await supabase.from('return_requests').insert({ user_id: user.id, order_id: orderId, reason, status: 'pending' })
    if (error) {
      alert(error.message || 'Could not submit your return request.')
      return
    }
    setReturnRequests(current => ({ ...current, [orderId]: { reason, status: 'pending' } }))
  }

  const printInvoice = (order) => {
    const lines = (order.order_items || []).map(item => `
      <tr>
        <td>${item.products?.name || 'Product'}</td>
        <td>${item.variant_label || ''}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">₹${Number(item.price_at_order).toFixed(2)}</td>
      </tr>
    `).join('')
    const address = order.addresses
      ? `${order.addresses.label || 'Address'} - ${order.addresses.line1}, ${order.addresses.city}`
      : `${order.guest_name || ''} - ${order.guest_address?.line1 || ''}, ${order.guest_address?.city || ''}`

    const popup = window.open('', '_blank', 'width=900,height=700')
    if (!popup) return
    popup.document.write(`
      <html>
        <head>
          <title>Invoice ${order.id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
            h1, h2, p { margin: 0 0 10px; }
          </style>
        </head>
        <body>
          <h1>1ShopStore Invoice</h1>
          <p>Order #${order.id.slice(-8).toUpperCase()}</p>
          <p>${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
          <p>${address}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Variant</th>
                <th style="text-align:right">Qty</th>
                <th style="text-align:right">Price</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
          <h2 style="margin-top: 24px;">Total: ${formatCurrency(order.total)}</h2>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  if (loading) {
    return (
      <div className="storefront-page shell">
        <div className="loading-state"><p>Loading orders...</p></div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">📦</p>
          <h2 className="empty-state__title">No orders yet</h2>
          <p>Your future orders will appear here with tracking, returns, and invoice actions.</p>
          <button type="button" className="button button--primary" onClick={() => navigate('/')}>
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
          <h1 className="section-title">My Orders</h1>
        </div>
      </div>

      {message ? <div className="success-banner">{message}</div> : null}

      <div className="orders-list">
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            returnRequest={returnRequests[order.id] || null}
            onTrack={(orderId) => navigate(`/orders/${orderId}/track`)}
            onCancel={cancelOrder}
            onReorder={reorderCart}
            onReturn={requestReturn}
            onPrintInvoice={printInvoice}
          />
        ))}
      </div>
    </div>
  )
}
