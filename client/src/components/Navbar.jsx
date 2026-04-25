import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import useLocationStore from '../store/locationStore'
import useWishlistStore from '../store/wishlistStore'
import LocationPicker from './LocationPicker'

export default function Navbar() {
  const count = useCartStore(s => s.count)
  const total = useCartStore(s => s.total)
  const { user, signOut } = useAuthStore()
  const { location: deliveryLocation } = useLocationStore()
  const wishlistCount = useWishlistStore(s => s.items.length)
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const accountRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search)
    setSearchTerm(params.get('q') || '')
  }, [routerLocation.search])

  // Close account dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const q = searchTerm.trim()
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  const handleSignOut = () => {
    setAccountOpen(false)
    signOut()
  }

  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(total)

  const displayLabel = deliveryLocation?.label || 'Set location'
  const displaySublabel = deliveryLocation?.sublabel || 'Tap to select area'

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">

          {/* Logo */}
          <Link to="/" className="brand-mark">
            <img src="/logo.png" alt="1ShopStore" className="brand-logo" />
          </Link>

          {/* Delivery zone — opens location picker */}
          <button
            type="button"
            className="topbar__delivery"
            onClick={() => setLocationOpen(true)}
            aria-label="Change delivery location"
          >
            <span className="topbar__delivery-label">
              {deliveryLocation ? 'Delivery to' : 'Fast Delivery'}
            </span>
            <span className="topbar__delivery-zone">
              {displayLabel}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {deliveryLocation?.sublabel && (
              <span className="topbar__delivery-sub">{displaySublabel}</span>
            )}
          </button>

          {/* Search */}
          <form className="topbar__search" onSubmit={handleSearchSubmit}>
            <svg className="topbar__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              className="topbar__search-input"
              placeholder="Search products..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label="Search products"
            />
          </form>

          {/* Account dropdown */}
          <div className="topbar__account" ref={accountRef}>
            <button
              type="button"
              className="topbar__account-btn"
              onClick={() => setAccountOpen(v => !v)}
              aria-expanded={accountOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Account</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={accountOpen ? 'chevron--up' : ''}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {accountOpen && (
              <div className="account-dropdown">
                {user ? (
                  <>
                    <div className="account-dropdown__user">
                      <span className="account-dropdown__email">{user.email}</span>
                    </div>
                    <Link to="/profile" className="account-dropdown__item" onClick={() => setAccountOpen(false)}>
                      👤 My Profile
                    </Link>
                    <Link to="/orders" className="account-dropdown__item" onClick={() => setAccountOpen(false)}>
                      📋 My Orders
                    </Link>
                    <Link to="/my-bookings" className="account-dropdown__item" onClick={() => setAccountOpen(false)}>
                      🛠️ My Bookings
                    </Link>
                    <Link to="/wishlist" className="account-dropdown__item" onClick={() => setAccountOpen(false)}>
                      ❤️ Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
                    </Link>
                    <button
                      type="button"
                      className="account-dropdown__item account-dropdown__item--danger"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="account-dropdown__item"
                      onClick={() => { setAccountOpen(false); navigate('/login') }}
                    >
                      Sign in
                    </button>
                    <Link to="/wishlist" className="account-dropdown__item" onClick={() => setAccountOpen(false)}>
                      ❤️ Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <Link to="/cart" className="cart-pill">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="cart-pill__text">
              <span className="cart-pill__count">{count} {count === 1 ? 'item' : 'items'}</span>
              <span className="cart-pill__total">{formattedTotal}</span>
            </div>
          </Link>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="topbar__hamburger"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Open menu"
          >
            <span /><span /><span />
          </button>

        </div>
      </header>

      {/* Secondary nav */}
      <nav className={`subnav ${menuOpen ? 'subnav--open' : ''}`}>
        <div className="subnav__inner">
          <Link to="/products" className="subnav__link" onClick={() => setMenuOpen(false)}>Products</Link>
          <Link to="/services" className="subnav__link" onClick={() => setMenuOpen(false)}>Services</Link>
          <Link to="/coupons" className="subnav__link" onClick={() => setMenuOpen(false)}>🏷️ Coupons</Link>
          <Link to="/compare" className="subnav__link" onClick={() => setMenuOpen(false)}>⚖️ Compare</Link>
          <Link to="/help" className="subnav__link" onClick={() => setMenuOpen(false)}>🛟 Help</Link>
          {user
            ? <Link to="/profile" className="subnav__link" onClick={() => setMenuOpen(false)}>👤 Profile</Link>
            : <Link to="/login" className="subnav__link" onClick={() => setMenuOpen(false)}>Sign In</Link>}
        </div>
      </nav>

      {locationOpen && (
        <LocationPicker onClose={() => setLocationOpen(false)} />
      )}
    </>
  )
}
