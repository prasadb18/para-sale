import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { getCategoryMeta } from '../lib/storefront'
import useCartStore from '../store/cartStore'

export default function Home() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const addItem = useCartStore(s => s.addItem)

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
    </div>
  )
}
