import { Link, useLocation } from 'react-router-dom'

export default function AdminLayout({ children }) {
  const { pathname } = useLocation()

  const links = [
    { path: '/admin', label: '📊 Dashboard' },
    { path: '/admin/orders', label: '📋 Orders' },
    { path: '/admin/products', label: '📦 Products' }
  ]

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <p style={styles.sideTitle}>⚡ Admin</p>
        {links.map(link => (
          <Link key={link.path} to={link.path} style={{
            ...styles.link,
            background: pathname === link.path ? '#2d2d4e' : 'transparent'
          }}>
            {link.label}
          </Link>
        ))}
        <Link to="/" style={styles.storeLink}>← Back to Store</Link>
      </div>
      <div style={styles.content}>{children}</div>
    </div>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: '200px', background: '#1a1a2e', padding: '20px 12px',
    display: 'flex', flexDirection: 'column', gap: '4px',
    flexShrink: 0 },
  sideTitle: { color: 'white', fontWeight: '800', fontSize: '16px',
    padding: '0 8px', margin: '0 0 20px' },
  link: { color: '#ccc', textDecoration: 'none', padding: '10px 12px',
    borderRadius: '8px', fontSize: '14px', fontWeight: '500' },
  storeLink: { color: '#888', textDecoration: 'none', padding: '10px 12px',
    fontSize: '13px', marginTop: 'auto' },
  content: { flex: 1, overflow: 'auto' }
}