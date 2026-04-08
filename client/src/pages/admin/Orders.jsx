import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUSES = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']

const STATUS_COLOR = {
  pending:    { bg: '#fff8e1', color: '#f39c12' },
  confirmed:  { bg: '#e8f5e9', color: '#27ae60' },
  dispatched: { bg: '#e3f2fd', color: '#2196f3' },
  delivered:  { bg: '#f3e5f5', color: '#9c27b0' },
  cancelled:  { bg: '#fce4ec', color: '#e91e63' }
}

const DATE_RANGES = [
  { label: 'All time', value: 'all' },
  { label: 'Today',    value: 'today' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]

const formatPaymentMethod = (m) => {
  if (m === 'cod') return 'COD'
  if (m === 'razorpay') return 'Razorpay'
  return (m || 'Online').toUpperCase()
}

const formatPaymentStatus = (s) => {
  if (!s) return 'Pending'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Audio ping using Web Audio API (no external file needed) ──
function playOrderPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784] // C5 E5 G5 — ascending chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.18
      osc.start(start)
      osc.stop(start + 0.22)
      gain.gain.setValueAtTime(0.35, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // Audio not available — fail silently
  }
}

// ── Browser notification ───────────────────────────────────────
async function sendBrowserNotification(order) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'denied') return

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') return
  }

  const items = order.order_items?.map(i => i.products?.name).filter(Boolean).join(', ')
  new Notification('🛒 New Order — 1ShopStore', {
    body: `#${order.id.slice(0, 8).toUpperCase()} · ₹${order.total?.toFixed(0)} · ${items || 'items'}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: order.id,
    requireInteraction: true
  })
}

export default function AdminOrders() {
  const [orders, setOrders]       = useState([])
  const [filter, setFilter]       = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [newOrderIds, setNewOrderIds] = useState(new Set()) // IDs of freshly arrived orders
  const [flashBanner, setFlashBanner] = useState(null)     // { id, total, itemCount }
  const bannerTimer = useRef(null)

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    fetchOrders()
    requestNotificationPermission()
  }, [])

  // ── Supabase Realtime subscription ───────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          // Fetch the full order with joined data
          const { data } = await supabase
            .from('orders')
            .select(`
              *,
              profiles(full_name, phone),
              addresses(label, line1, line2, city, pincode),
              order_items(quantity, price_at_order, products(name, unit))
            `)
            .eq('id', payload.new.id)
            .single()

          if (!data) return

          // Prepend to list
          setOrders(prev => [data, ...prev])

          // Mark as new (for highlight ring)
          setNewOrderIds(prev => new Set([...prev, data.id]))
          setTimeout(() => {
            setNewOrderIds(prev => {
              const next = new Set(prev)
              next.delete(data.id)
              return next
            })
          }, 8000)

          // Flash banner
          clearTimeout(bannerTimer.current)
          setFlashBanner({
            id: data.id,
            total: data.total,
            itemCount: data.order_items?.length || 0
          })
          bannerTimer.current = setTimeout(() => setFlashBanner(null), 6000)

          // Audio + browser notification
          playOrderPing()
          sendBrowserNotification(data)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

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
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
  }

  const getDateCutoff = () => {
    const now = new Date()
    if (dateRange === 'today') { now.setHours(0, 0, 0, 0); return now }
    if (dateRange === '7d')    { now.setDate(now.getDate() - 7); return now }
    if (dateRange === '30d')   { now.setDate(now.getDate() - 30); return now }
    return null
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    const cutoff = getDateCutoff()
    if (cutoff && new Date(o.created_at) < cutoff) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (
        !o.id.toLowerCase().includes(q) &&
        !o.profiles?.full_name?.toLowerCase().includes(q) &&
        !o.profiles?.phone?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  if (loading) return <p style={{ padding: '40px', textAlign: 'center' }}>Loading orders...</p>

  return (
    <div style={styles.page}>

      {/* ── New order flash banner ── */}
      {flashBanner && (
        <div style={styles.flashBanner}>
          <span style={styles.flashIcon}>🛒</span>
          <span style={styles.flashText}>
            <strong>New order!</strong>
            {' '}#{flashBanner.id.slice(0, 8).toUpperCase()}
            {' '}· ₹{flashBanner.total?.toFixed(0)}
            {' '}· {flashBanner.itemCount} item{flashBanner.itemCount !== 1 ? 's' : ''}
          </span>
          <button style={styles.flashClose} onClick={() => setFlashBanner(null)}>✕</button>
        </div>
      )}

      <div style={styles.pageHeader}>
        <h2 style={styles.heading}>All Orders ({orders.length})</h2>
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot} />
          Live
        </div>
      </div>

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

      {/* Status filter */}
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
        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No orders found</p>
      )}

      {filtered.map(order => {
        const s = STATUS_COLOR[order.status] || STATUS_COLOR.pending
        const isOpen = expanded === order.id
        const isNew = newOrderIds.has(order.id)

        return (
          <div key={order.id} style={{
            ...styles.card,
            boxShadow: isNew ? '0 0 0 3px #0c64c0' : 'none',
            transition: 'box-shadow 0.4s'
          }}>
            {isNew && (
              <div style={styles.newBadge}>NEW</div>
            )}

            {/* Order header */}
            <div style={styles.cardHeader} onClick={() => setExpanded(isOpen ? null : order.id)}>
              <div>
                <p style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</p>
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
                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Customer</p>
                  <p style={styles.detailText}>
                    {order.profiles?.full_name || 'Not set'} · {order.profiles?.phone || 'No phone'}
                  </p>
                </div>

                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Deliver to</p>
                  <p style={styles.detailText}>
                    {order.addresses?.label} — {order.addresses?.line1}
                    {order.addresses?.line2 ? `, ${order.addresses.line2}` : ''},
                    {' '}{order.addresses?.city}, {order.addresses?.pincode}
                  </p>
                </div>

                <div style={styles.detailSection}>
                  <p style={styles.detailLabel}>Items</p>
                  {order.order_items?.map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                      <span>{item.products?.name}</span>
                      <span style={styles.itemQty}>× {item.quantity} {item.products?.unit}</span>
                      <span style={styles.itemPrice}>₹{(item.price_at_order * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <div style={styles.detailSection}>
                  <div style={styles.billRow}><span>Subtotal</span><span>₹{order.subtotal?.toFixed(0)}</span></div>
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
                  {order.razorpay_order_id   && <p style={styles.detailSubtext}>Order ref: {order.razorpay_order_id}</p>}
                  {order.razorpay_payment_id && <p style={styles.detailSubtext}>Payment ref: {order.razorpay_payment_id}</p>}
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
                          background:   order.status === status ? STATUS_COLOR[status].bg    : 'white',
                          color:        order.status === status ? STATUS_COLOR[status].color : '#555',
                          borderColor:  order.status === status ? STATUS_COLOR[status].color : '#ddd',
                          fontWeight:   order.status === status ? '700' : '400'
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
  page:        { padding: '20px', maxWidth: '680px', margin: '0 auto' },
  pageHeader:  { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  heading:     { fontSize: '20px', margin: 0 },

  // Live indicator
  liveIndicator: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', fontWeight: '700', color: '#27ae60',
    background: '#e8f5e9', padding: '4px 10px', borderRadius: '20px'
  },
  liveDot: {
    width: '7px', height: '7px', borderRadius: '50%',
    background: '#27ae60',
    boxShadow: '0 0 0 0 rgba(39,174,96,0.4)',
    animation: 'pulse-dot 1.5s infinite'
  },

  // Flash banner
  flashBanner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: '#0c64c0', color: '#fff',
    padding: '12px 16px', borderRadius: '12px',
    marginBottom: '16px', animation: 'slide-in 0.3s ease'
  },
  flashIcon:  { fontSize: '22px' },
  flashText:  { flex: 1, fontSize: '14px' },
  flashClose: {
    border: 0, background: 'transparent', color: 'rgba(255,255,255,0.75)',
    fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px'
  },

  // NEW badge on card
  newBadge: {
    display: 'inline-block',
    background: '#0c64c0', color: '#fff',
    fontSize: '10px', fontWeight: '800',
    letterSpacing: '0.08em',
    padding: '2px 8px', borderRadius: '0 0 8px 0'
  },

  tabs:     { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' },
  tab:      { padding: '7px 14px', borderRadius: '20px', border: '1px solid #ddd',
              cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '6px' },
  tabCount: { background: 'rgba(0,0,0,0.1)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' },

  card:       { border: '1px solid #eee', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden', background: 'white' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' },
  orderId:    { fontWeight: '700', fontSize: '15px', margin: '0 0 4px' },
  orderMeta:  { color: '#888', fontSize: '12px', margin: 0 },
  headerRight:{ display: 'flex', alignItems: 'center', gap: '10px' },
  badge:      { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  total:      { fontWeight: '700', margin: 0, fontSize: '15px' },
  chevron:    { color: '#aaa', fontSize: '11px' },

  details:      { borderTop: '1px solid #f0f0f0', padding: '16px', background: '#fafafa' },
  detailSection:{ marginBottom: '16px' },
  detailLabel:  { fontSize: '11px', fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' },
  detailText:   { fontSize: '14px', color: '#333', margin: 0 },
  detailSubtext:{ fontSize: '12px', color: '#777', margin: '6px 0 0' },
  itemRow:      { display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '14px' },
  itemQty:      { color: '#888', flex: 1 },
  itemPrice:    { fontWeight: '600' },
  billRow:      { display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '4px 0', color: '#555' },
  statusUpdater:{ marginTop: '8px' },
  statusBtns:   { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' },
  statusBtn:    { padding: '7px 14px', borderRadius: '20px', border: '1.5px solid #ddd', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  searchInput:  { width: '100%', padding: '10px 14px', border: '1.5px solid #ddd', borderRadius: '10px', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box', outline: 'none' }
}
