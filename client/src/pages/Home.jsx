import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { getCategoryMeta, formatCurrency, getDiscountPercent } from '../lib/storefront'
import useCartStore from '../store/cartStore'
import { imgUrl } from '../lib/imgUrl'

function useFlashTimer() {
  const getSecondsLeft = () => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return Math.max(0, Math.floor((midnight - now) / 1000))
  }
  const [secs, setSecs] = useState(getSecondsLeft)
  useEffect(() => {
    const id = setInterval(() => setSecs(getSecondsLeft()), 1000)
    return () => clearInterval(id)
  }, [])
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const KITS = [
  {
    id: 'basic-wiring',
    icon: '⚡',
    name: 'Basic Wiring Kit',
    tagline: 'Everything for a new room wiring job',
    items: ['Wires & cables', 'Switches & sockets', 'MCB & distribution box'],
    color: '#e8f1fb',
    accent: '#1565c0',
    search: 'wire'
  },
  {
    id: 'bathroom-plumbing',
    icon: '🚿',
    name: 'Bathroom Plumbing Kit',
    tagline: 'Taps, pipes & fittings in one go',
    items: ['CPVC pipes', 'Ball valves', 'Basin & shower taps'],
    color: '#e0f5f5',
    accent: '#00695c',
    search: 'pipe'
  },
  {
    id: 'painting-starter',
    icon: '🎨',
    name: 'Painting Starter Kit',
    tagline: 'Primer to finish — all you need',
    items: ['Wall primer', 'Emulsion paint', 'Rollers & brushes'],
    color: '#fff8e1',
    accent: '#e65100',
    search: 'paint'
  },
  {
    id: 'site-tools',
    icon: '🛠️',
    name: 'Site Tool Kit',
    tagline: 'Must-have tools for any construction site',
    items: ['Measuring tape', 'Drill bits', 'Fasteners & anchors'],
    color: '#f3e5f5',
    accent: '#6a1b9a',
    search: 'drill'
  },
  {
    id: 'lighting-setup',
    icon: '💡',
    name: 'Lighting Setup Kit',
    tagline: 'LED fixtures, drivers & accessories',
    items: ['LED bulbs', 'Batten lights', 'Downlights & drivers'],
    color: '#f0fdf4',
    accent: '#2e7d32',
    search: 'led'
  },
  {
    id: 'safety-kit',
    icon: '🔒',
    name: 'Safety & Protection Kit',
    tagline: 'MCBs, earthing & protection gear',
    items: ['MCB breakers', 'Earth leakage protection', 'Electrical tape & conduits'],
    color: '#fce4ec',
    accent: '#b71c1c',
    search: 'mcb'
  }
]

export default function Home() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const addItem = useCartStore(s => s.addItem)
  const flashTimer = useFlashTimer()

  useEffect(() => {
    let isMounted = true

    Promise.all([getCategories(), getProducts()])
      .then(([categoriesRes, productsRes]) => {
        if (!isMounted) return
        setCategories(categoriesRes.data || [])
        setProducts(productsRes.data || [])
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  const featuredProducts = products.slice(0, 8)
  const inStockProducts = products.filter(p => Number(p.stock || 0) > 0)
  const primaryCategory = categories[0]
  const flashDeals = products
    .filter(p => Number(p.stock || 0) > 0 && Number(p.mrp || 0) > Number(p.price || 0))
    .sort((a, b) => getDiscountPercent(b.price, b.mrp) - getDiscountPercent(a.price, a.mrp))
    .slice(0, 6)

  const scrollToCategories = () => {
    const el = document.getElementById('store-categories')
    if (!el) return
    const navbarHeight = document.querySelector('.topbar')?.offsetHeight || 72
    const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight - 12
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div className="storefront-page">

      {/* ── Hero Banner ── */}
      <section className="shell" style={{ paddingTop: 20 }}>
        <div className="hero-banner reveal">
          <div className="hero-banner__content">
            <img src="/logo.png" alt="1ShopStore" style={{ height: 52, width: 'auto', marginBottom: 8, filter: 'brightness(0) invert(1)' }} />
            <h1 className="hero-banner__title">
              Everything you need,<br />delivered fast.
            </h1>
            <p className="hero-banner__subtitle">
              Browse hardware, tools, and repeat supplies — clean checkout, fast delivery.
            </p>
            <div className="hero-banner__actions">
              <button
                type="button"
                className="hero-banner__btn hero-banner__btn--white"
                onClick={() => primaryCategory ? navigate(`/products/${primaryCategory.slug}`) : scrollToCategories()}
              >
                Shop Now
              </button>
              <button
                type="button"
                className="hero-banner__btn hero-banner__btn--outline"
                onClick={scrollToCategories}
              >
                Browse Categories
              </button>
            </div>
          </div>
          <div className="hero-banner__visual">🛒</div>
        </div>

        {/* Stats row */}
        <div className="hero__stats">
          <button type="button" className="stat-tile stat-tile--btn" onClick={scrollToCategories}>
            <strong>{categories.length || '--'}</strong>
            <span>Categories</span>
          </button>
          <button type="button" className="stat-tile stat-tile--btn" onClick={() => navigate('/products')}>
            <strong>{products.length || '--'}</strong>
            <span>Products</span>
          </button>
          <button type="button" className="stat-tile stat-tile--btn" onClick={() => navigate('/products?filter=instock')}>
            <strong>{inStockProducts.length || '--'}</strong>
            <span>In Stock</span>
          </button>
        </div>
      </section>

      {/* ── Promo Strip ── */}
      <section className="shell storefront-section">
        <div className="promo-strip">
          <div className="promo-card promo-card--blue">
            <div>
              <p className="promo-card__title">Fast Delivery Zones</p>
              <p className="promo-card__sub">Palava & Dombivli East</p>
            </div>
            <button type="button" className="promo-card__action" onClick={scrollToCategories}>Shop Now</button>
          </div>
          <div className="promo-card promo-card--teal">
            <div>
              <p className="promo-card__title">Bulk Ready Pricing</p>
              <p className="promo-card__sub">Best rates for repeat orders</p>
            </div>
            <button type="button" className="promo-card__action" onClick={() => navigate('/products')}>View All</button>
          </div>
          <div className="promo-card promo-card--soft">
            <div>
              <p className="promo-card__title">Track Your Orders</p>
              <p className="promo-card__sub">Real-time order status</p>
            </div>
            <button type="button" className="promo-card__action" onClick={() => navigate('/orders')}>My Orders</button>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section id="store-categories" className="storefront-section shell">
        <div className="section-header">
          <h2 className="section-title">Shop by Category</h2>
          <button type="button" className="text-link" onClick={() => navigate('/products')}>
            See all →
          </button>
        </div>

        {loading ? (
          <div className="loading-state"><p>Loading...</p></div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">🛍️</p>
            <h3 className="empty-state__title">No categories yet</h3>
            <p>Categories will appear here once added.</p>
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((category, index) => {
              const meta = getCategoryMeta(category, index)
              return (
                <button
                  key={category.id}
                  type="button"
                  className="category-card reveal"
                  onClick={() => navigate(`/products/${category.slug}`)}
                >
                  <span className="category-card__icon">{meta.icon}</span>
                  <h3 className="category-card__name">{category.name}</h3>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Flash Deals ── */}
      {flashDeals.length > 0 && (
        <section className="storefront-section shell">
          <div className="flash-header">
            <div className="flash-title-row">
              <span className="flash-title">⚡ Flash Deals</span>
              <span className="flash-timer-pill">Ends in {flashTimer}</span>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('/products')}>View all →</button>
          </div>
          <div className="flash-strip">
            {flashDeals.map(p => {
              const disc = getDiscountPercent(p.price, p.mrp)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="flash-card reveal"
                  onClick={() => navigate(`/product/${p.id}`)}
                >
                  <div className="flash-card__offer-row">
                    {disc > 0 && <span className="flash-disc-badge">Save {disc}%</span>}
                  </div>
                  {p.image_url
                    ? <img src={imgUrl(p.image_url, { width: 160 })} alt={p.name} className="flash-card__img" />
                    : <div className="flash-card__placeholder">📦</div>}
                  <p className="flash-card__name">{p.name}</p>
                  <div className="flash-card__price-row">
                    <span className="flash-card__price">{formatCurrency(p.price)}</span>
                    {disc > 0 && <span className="flash-card__mrp">{formatCurrency(p.mrp)}</span>}
                  </div>
                  <button
                    type="button"
                    className="flash-card__add-btn"
                    onClick={e => { e.stopPropagation(); addItem(p) }}
                  >
                    + Add
                  </button>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Featured Products ── */}
      {featuredProducts.length > 0 && (
        <section className="storefront-section shell">
          <div className="section-header">
            <h2 className="section-title">Featured Products</h2>
            <button type="button" className="text-link" onClick={() => navigate('/products')}>
              View all →
            </button>
          </div>

          <div className="product-grid">
            {featuredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={() => navigate(`/product/${product.id}`)}
                onAdd={addItem}
                showCategory
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Project Kits ── */}
      <section className="storefront-section shell">
        <div className="section-header">
          <h2 className="section-title">Project Kits</h2>
          <p className="section-copy">Everything for a job, in one search</p>
        </div>

        <div className="kit-strip">
          {KITS.map(kit => (
            <button
              key={kit.id}
              type="button"
              className="kit-card reveal"
              style={{ '--kit-bg': kit.color, '--kit-accent': kit.accent }}
              onClick={() => navigate(`/products?q=${encodeURIComponent(kit.search)}`)}
            >
              <span className="kit-card__icon">{kit.icon}</span>
              <div className="kit-card__body">
                <p className="kit-card__name">{kit.name}</p>
                <p className="kit-card__tagline">{kit.tagline}</p>
                <ul className="kit-card__items">
                  {kit.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <span className="kit-card__cta">Explore →</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
