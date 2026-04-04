import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'

export default function Navbar() {
  const count = useCartStore(s => s.count)
  const { user, signOut } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const handleAuth = () => {
    if (user) signOut()
    else navigate('/login')
  }

  const navLinkClass = ({ isActive }) =>
    `nav-pill${isActive ? ' nav-pill--active' : ''}`

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchTerm(params.get('q') || '')
  }, [location.search])

  const handleSearchSubmit = (event) => {
    event.preventDefault()

    const trimmedSearch = searchTerm.trim()
    navigate(trimmedSearch ? `/products?q=${encodeURIComponent(trimmedSearch)}` : '/products')
  }

  return (
    <header className="topbar">
      <div className="shell topbar__inner">
        <Link to="/" className="brand-mark">
          <span className="brand-mark__badge">1</span>
          <span>
            <strong>1ShopStore</strong>
            <small>Shopping made faster for repeat site orders</small>
          </span>
        </Link>

        <form className="topbar__search" onSubmit={handleSearchSubmit}>
          <span className="topbar__search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            className="topbar__search-input"
            placeholder="Search cables, tools, pipes, fasteners, and more..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            aria-label="Search products"
          />
          <button type="submit" className="topbar__search-button">
            Search
          </button>
        </form>

        <div className="topbar__actions">
          <NavLink end to="/" className={navLinkClass}>
            Store
          </NavLink>

          {user && (
            <NavLink to="/orders" className={navLinkClass}>
              Orders
            </NavLink>
          )}

          <Link to="/cart" className="cart-pill">
            Cart <span>{count}</span>
          </Link>

          <button
            type="button"
            className="button button--ghost"
            onClick={handleAuth}
          >
            {user ? 'Logout' : 'Sign in'}
          </button>
        </div>
      </div>

      <div className="shell topbar__meta">
        <span>Bulk-ready pricing</span>
        <span>Fast delivery zones</span>
        <span>Clean checkout flow</span>
      </div>
    </header>
  )
}
