import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUSES = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']

const STATUS_COLOR = {
  pending:    { bg: '#fff8e1', color: '#f39c12' },
  confirmed:  { bg: '#e8f5e9', color: '#27ae60' },
  dispatched: { bg: '#e3f2fd', color: '#2196f3' },
  delivered:  { bg: '#f3e5f5', color: '#9c27b0' },
  cancelled:  { bg: '#fce4ec', color: '#e91e63' }
}

const formatPaymentMethod = (paymentMethod) => {
  if (paymentMethod === 'cod') return 'COD'
  if (paymentMethod === 'razorpay') return 'Razorpay'

  return (paymentMethod || 'Online').toUpperCase()
}

const formatPaymentStatus = (paymentStatus) => {
  if (!paymentStatus) return 'Pending'

  return paymentStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

const DATE_RANGES = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        profiles(full_name, phone),
        addresses(label, line1, line2, city, pincode),
        order_items(quantity, price_at_order, products(name, unit))
      `)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const updateStatus = async (orderId, newStatus) => {
    await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ))
  }

  const getDateCutoff = () => {
    const now = new Date()
    if (dateRange === 'today') { now.setHours(0,0,0,0); return now }
    if (dateRange === '7d') { now.setDate(now.getDate() - 7); return now }
    if (dateRange === '30d') { now.setDate(now.getDate() - 30); return now }
    return null
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    const cutoff = getDateCutoff()
    if (cutoff && new Date(o.created_at) < cutoff) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchesId = o.id.toLowerCase().includes(q)
      const matchesName = o.profiles?.full_name?.toLowerCase().includes(q)
      const matchesPhone = o.profiles?.phone?.toLowerCase().includes(q)
      if (!matchesId && !matchesName && !matchesPhone) return false
    }
    return true
  })

  if (loading) return <p style={{ padding: '40px', textAlign: 'center' }}>Loading orders...</p>

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>All Orders ({orders.length})</h2>

      {/* Search */}
      <input
        style={styles.searchInput}
        placeholder="Search by order ID, customer name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Date filter */}
      <div style={{ ...styles.tabs, marginBottom: '10px' }}>
        {DATE_RANGES.map(r => (
          <button key={r.value} style={{
            ...styles.tab,
            background: dateRange === r.value ? '#1a1a2e' : 'white',
            color: dateRange === r.value ? 'white' : '#555'
          }} onClick={() => setDateRange(r.value)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div style={styles.tabs}>
        {['all', ...STATUSES].map(s => (
          <button key={s} style={{
            ...styles.tab,
            background: filter === s ? '#1a1a2e' : 'white',
            color: filter === s ? 'white' : '#555'
          }} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span style={styles.tabCount}>
                {orders.filter(o => o.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 12px' }}>
        Showing {filtered.length} order{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
          No orders found
        </p>
      )}

      {filtered.map(order => {
        const s = STATUS_COLOR[order.status] || STATUS_COLOR.pending
        const isOpen = expanded === order.id

        return (
          <div key={order.id} style={styles.card}>
            {/* Order header */}
            <div style={styles.cardHeader}
              onClick={() => setExpanded(isOpen ? null : order.id)}>
              <div>
                <p style={styles.orderId}>#{order.id.slice(0,8).toUpperCase()}</p>
                <p style={styles.orderMeta}>
                  {new Date(order.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })} · {formatPaymentMethod(order.payment_method)}
                </p>
              </div>
              <div style={styles.headerRight}>
                <span style={{ ...styles.badge, background: s.bg, color: s.color }}>
                  {order.status}
                </span>
                <p style={styles.total}>₹{order.total?.toFixed(0)}</p>
                <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded details */}
            {isOpen && (
              <div style={styles.details}>
                {/* Customer */}
                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Customer</p>
                  <p style={styles.detailText}>
                    {order.profiles?.full_name || 'Not set'} · {order.profiles?.phone || 'No phone'}
                  </p>
                </div>

                {/* Delivery address */}
                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Deliver to</p>
                  <p style={styles.detailText}>
                    {order.addresses?.label} — {order.addresses?.line1}
                    {order.addresses?.line2 ? `, ${order.addresses.line2}` : ''},
                    {' '}{order.addresses?.city}, {order.addresses?.pincode}
                  </p>
                </div>

                {/* Items */}
                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Items</p>
                  {order.order_items?.map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                      <span>{item.products?.name}</span>
                      <span style={styles.itemQty}>
                        × {item.quantity} {item.products?.unit}
                      </span>
                      <span style={styles.itemPrice}>
                        ₹{(item.price_at_order * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bill */}
                <div style={styles.detailSection}>
                  <div style={styles.billRow}>
                    <span>Subtotal</span><span>₹{order.subtotal?.toFixed(0)}</span>
                  </div>
                  <div style={styles.billRow}>
                    <span>Delivery</span>
                    <span>{order.delivery_charge > 0 ? `₹${order.delivery_charge}` : 'Free'}</span>
                  </div>
                  <div style={{ ...styles.billRow, fontWeight: '700', fontSize: '15px' }}>
                    <span>Total</span><span>₹{order.total?.toFixed(0)}</span>
                  </div>
                </div>

                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Payment</p>
                  <p style={styles.detailText}>
                    {formatPaymentMethod(order.payment_method)} · {formatPaymentStatus(order.payment_status)}
                  </p>
                  {order.razorpay_order_id ? (
                    <p style={styles.detailSubtext}>Order ref: {order.razorpay_order_id}</p>
                  ) : null}
                  {order.razorpay_payment_id ? (
                    <p style={styles.detailSubtext}>Payment ref: {order.razorpay_payment_id}</p>
                  ) : null}
                </div>

                {/* Status updater */}
                <div style={styles.statusUpdater}>
                  <p style={styles.detailLabel}>Update Status</p>
                  <div style={styles.statusBtns}>
                    {STATUSES.map(status => (
                      <button
                        key={status}
                        style={{
                          ...styles.statusBtn,
                          background: order.status === status
                            ? STATUS_COLOR[status].bg : 'white',
                          color: order.status === status
                            ? STATUS_COLOR[status].color : '#555',
                          borderColor: order.status === status
                            ? STATUS_COLOR[status].color : '#ddd',
                          fontWeight: order.status === status ? '700' : '400'
                        }}
                        onClick={() => updateStatus(order.id, status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  page: { padding: '20px', maxWidth: '680px', margin: '0 auto' },
  heading: { fontSize: '20px', margin: '0 0 16px' },
  tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' },
  tab: { padding: '7px 14px', borderRadius: '20px', border: '1px solid #ddd',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '6px' },
  tabCount: { background: 'rgba(0,0,0,0.1)', borderRadius: '10px',
    padding: '1px 6px', fontSize: '11px' },
  card: { border: '1px solid #eee', borderRadius: '14px',
    marginBottom: '12px', overflow: 'hidden', background: 'white' },
  cardHeader: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '16px', cursor: 'pointer' },
  orderId: { fontWeight: '700', fontSize: '15px', margin: '0 0 4px' },
  orderMeta: { color: '#888', fontSize: '12px', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  badge: { padding: '3px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600' },
  total: { fontWeight: '700', margin: 0, fontSize: '15px' },
  chevron: { color: '#aaa', fontSize: '11px' },
  details: { borderTop: '1px solid #f0f0f0', padding: '16px',
    background: '#fafafa' },
  detailSection: { marginBottom: '16px' },
  detailLabel: { fontSize: '11px', fontWeight: '700', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' },
  detailText: { fontSize: '14px', color: '#333', margin: 0 },
  detailSubtext: { fontSize: '12px', color: '#777', margin: '6px 0 0' },
  itemRow: { display: 'flex', gap: '8px', padding: '6px 0',
    borderBottom: '1px solid #eee', fontSize: '14px' },
  itemQty: { color: '#888', flex: 1 },
  itemPrice: { fontWeight: '600' },
  billRow: { display: 'flex', justifyContent: 'space-between',
    fontSize: '14px', padding: '4px 0', color: '#555' },
  statusUpdater: { marginTop: '8px' },
  statusBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' },
  statusBtn: { padding: '7px 14px', borderRadius: '20px', border: '1.5px solid #ddd',
    cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  searchInput: { width: '100%', padding: '10px 14px', border: '1.5px solid #ddd',
    borderRadius: '10px', fontSize: '14px', marginBottom: '14px',
    boxSizing: 'border-box', outline: 'none' }
}
