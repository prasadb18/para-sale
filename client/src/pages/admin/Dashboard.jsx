import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0, pendingOrders: 0,
    todayRevenue: 0, totalProducts: 0,
    todayProfit: 0, totalProfit: 0
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [lowStock, setLowStock] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
    fetchRecentOrders()
    fetchLowStock()
  }, [])

  const fetchStats = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [orders, pending, todayOrders, products, todayOrderItems, allOrderItems] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact' }),
      supabase.from('orders').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('orders').select('total').gte('created_at', today.toISOString()),
      supabase.from('products').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('orders').select('order_items(quantity, products(price, buying_price))').eq('status', 'delivered').gte('created_at', today.toISOString()),
      supabase.from('orders').select('order_items(quantity, products(price, buying_price))').eq('status', 'delivered')
    ])

    const todayRevenue = (todayOrders.data || []).reduce((sum, o) => sum + (o.total || 0), 0)

    const calcProfit = (ordersData) =>
      (ordersData || []).reduce((sum, order) =>
        sum + (order.order_items || []).reduce((s, item) => {
          const p = item.products
          if (!p?.buying_price) return s
          return s + (p.price - p.buying_price) * (item.quantity || 1)
        }, 0)
      , 0)

    setStats({
      totalOrders: orders.count || 0,
      pendingOrders: pending.count || 0,
      todayRevenue,
      totalProducts: products.count || 0,
      todayProfit: calcProfit(todayOrderItems.data),
      totalProfit: calcProfit(allOrderItems.data)
    })
  }

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, addresses(label, city), order_items(quantity, products(name))`)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentOrders(data || [])
  }

  const fetchLowStock = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, stock, unit')
      .eq('is_active', true)
      .lte('stock', 5)
      .order('stock', { ascending: true })
    setLowStock(data || [])
  }

  const STATUS_COLOR = {
    pending:    { bg: '#fff8e1', color: '#f39c12' },
    confirmed:  { bg: '#e8f5e9', color: '#27ae60' },
    dispatched: { bg: '#e3f2fd', color: '#2196f3' },
    delivered:  { bg: '#f3e5f5', color: '#9c27b0' },
    cancelled:  { bg: '#fce4ec', color: '#e91e63' }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Dashboard</h2>

      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {[
          { label: 'Total Orders', value: stats.totalOrders, icon: '📦', path: '/admin/orders' },
          { label: 'Pending', value: stats.pendingOrders, icon: '⏳', alert: stats.pendingOrders > 0, path: '/admin/orders' },
          { label: "Today's Revenue", value: `₹${stats.todayRevenue.toFixed(0)}`, icon: '💰', path: '/admin/orders' },
          { label: 'Active Products', value: stats.totalProducts, icon: '🏪', path: '/admin/products' },
          { label: "Today's Profit (Delivered)", value: `₹${stats.todayProfit.toFixed(0)}`, icon: '📈', profit: true, path: '/admin/orders' },
          { label: 'Total Profit (Delivered)', value: `₹${stats.totalProfit.toFixed(0)}`, icon: '💹', profit: true, path: '/admin/orders' }
        ].map(stat => (
          <button key={stat.label} onClick={() => navigate(stat.path)} style={{
            ...styles.statCard,
            borderColor: stat.alert ? '#f39c12' : stat.profit ? '#2e7d32' : '#eee',
            background: stat.alert ? '#fffbf0' : stat.profit ? '#f1f8f1' : 'white',
            cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit'
          }}>
            <span style={styles.statIcon}>{stat.icon}</span>
            <p style={{ ...styles.statValue, color: stat.profit ? '#2e7d32' : 'inherit' }}>{stat.value}</p>
            <p style={styles.statLabel}>{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Recent orders */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Recent Orders</h3>
          <button style={styles.viewAll}
            onClick={() => navigate('/admin/orders')}>
            View all →
          </button>
        </div>
        {recentOrders.map(order => {
          const s = STATUS_COLOR[order.status] || STATUS_COLOR.pending
          return (
            <div key={order.id} style={styles.orderRow}
              onClick={() => navigate('/admin/orders')}>
              <div style={styles.orderLeft}>
                <p style={styles.orderId}>#{order.id.slice(0,8).toUpperCase()}</p>
                <p style={styles.orderMeta}>
                  {order.order_items?.length} item(s) ·{' '}
                  {order.addresses?.city || order.guest_address?.city || 'Guest'}
                </p>
              </div>
              <div style={styles.orderRight}>
                <span style={{ ...styles.badge, background: s.bg, color: s.color }}>
                  {order.status}
                </span>
                <p style={styles.orderTotal}>₹{order.total?.toFixed(0)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div style={{ ...styles.section, borderColor: '#f39c12' }}>
          <div style={styles.sectionHeader}>
            <h3 style={{ ...styles.sectionTitle, color: '#f39c12' }}>
              ⚠️ Low Stock ({lowStock.length})
            </h3>
            <button style={styles.viewAll}
              onClick={() => navigate('/admin/products')}>
              Manage →
            </button>
          </div>
          {lowStock.map(p => (
            <div key={p.id} style={styles.orderRow}>
              <p style={styles.orderId}>{p.name}</p>
              <span style={{
                ...styles.badge,
                background: p.stock === 0 ? '#fce4ec' : '#fff8e1',
                color: p.stock === 0 ? '#e91e63' : '#f39c12'
              }}>
                {p.stock === 0 ? 'Out of stock' : `${p.stock} ${p.unit}s left`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div style={styles.quickLinks}>
        {[
          { label: '📋 Manage Orders', path: '/admin/orders' },
          { label: '📦 Manage Products', path: '/admin/products' },
          { label: '➕ Add Product', path: '/admin/products/new' },
          { label: '🗂️ Categories', path: '/admin/categories' }
        ].map(link => (
          <button key={link.path} style={styles.quickBtn}
            onClick={() => navigate(link.path)}>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '20px', maxWidth: '680px', margin: '0 auto' },
  heading: { fontSize: '22px', margin: '0 0 20px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px', marginBottom: '24px',
    '@media (min-width: 600px)': { gridTemplateColumns: 'repeat(3, 1fr)' } },
  statCard: { border: '2px solid #eee', borderRadius: '12px',
    padding: '16px', textAlign: 'center', background: 'white' },
  statIcon: { fontSize: '28px' },
  statValue: { fontSize: '26px', fontWeight: '800', margin: '6px 0 4px' },
  statLabel: { color: '#888', fontSize: '13px', margin: 0 },
  section: { border: '1px solid #eee', borderRadius: '14px',
    padding: '16px', marginBottom: '20px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '14px' },
  sectionTitle: { margin: 0, fontSize: '16px' },
  viewAll: { background: 'none', border: 'none', color: '#1a1a2e',
    cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  orderRow: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '10px 0',
    borderBottom: '1px solid #f5f5f5', cursor: 'pointer' },
  orderLeft: {},
  orderId: { fontWeight: '700', fontSize: '14px', margin: '0 0 3px' },
  orderMeta: { color: '#888', fontSize: '13px', margin: 0 },
  orderRight: { textAlign: 'right' },
  badge: { padding: '3px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600' },
  orderTotal: { fontWeight: '700', margin: '4px 0 0', fontSize: '14px' },
  quickLinks: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  quickBtn: { padding: '12px 20px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    fontSize: '14px', fontWeight: '600' }
}