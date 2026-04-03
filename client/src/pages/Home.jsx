import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { formatCurrency, getCategoryMeta } from '../lib/storefront'
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

    return () => {
      isMounted = false
    }
  }, [])

  const featuredProducts = products.slice(0, 4)
  const inStockProducts = products.filter(product => Number(product.stock || 0) > 0)
  const primaryCategory = categories[0]

  const scrollToCategories = () => {
    document
      .getElementById('store-categories')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="storefront-page">
      <section className="hero shell">
        <div className="hero__content reveal">
          <p className="eyebrow">Parasale storefront</p>
          <h1 className="hero__title">
            A cleaner shopping app for hardware, tools, and repeat supply runs.
          </h1>
          <p className="hero__copy">
            Browse by aisle, compare prices faster, and move from shortlist to
            checkout with a flow that feels like a modern commerce app.
          </p>

          <div className="hero__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                primaryCategory
                  ? navigate(`/products/${primaryCategory.slug}`)
                  : scrollToCategories()
              }
            >
              Start shopping
            </button>

            <button
              type="button"
              className="button button--secondary"
              onClick={scrollToCategories}
            >
              Explore aisles
            </button>
          </div>

          <div className="hero__stats">
            <div className="stat-tile">
              <strong>{categories.length || '--'}</strong>
              <span>live categories</span>
            </div>
            <div className="stat-tile">
              <strong>{products.length || '--'}</strong>
              <span>active products</span>
            </div>
            <div className="stat-tile">
              <strong>{inStockProducts.length || '--'}</strong>
              <span>ready-stock picks</span>
            </div>
          </div>
        </div>

        <div className="hero__visual reveal">
          <article className="hero-card">
            <span className="chip chip--accent">Shopping app refresh</span>
            <h2>Built for quick repeat ordering.</h2>
            <p>
              Category-led navigation, strong product cards, and clearer pricing
              hierarchy for day-to-day procurement.
            </p>

            <div className="hero-stack">
              {categories.slice(0, 4).map((category, index) => {
                const meta = getCategoryMeta(category, index)

                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`hero-stack__item theme-${meta.theme}`}
                    onClick={() => navigate(`/products/${category.slug}`)}
                  >
                    <span>{meta.icon}</span>
                    <div>
                      <strong>{category.name}</strong>
                      <small>{meta.blurb}</small>
                    </div>
                  </button>
                )
              })}
            </div>
          </article>

          <article className="hero-card hero-card--floating">
            <p className="eyebrow">Featured product</p>
            {featuredProducts[0] ? (
              <>
                <h3>{featuredProducts[0].name}</h3>
                <p>{featuredProducts[0].brand || 'Parasale Select'}</p>
                <div className="hero-card__price">
                  {formatCurrency(featuredProducts[0].price)}
                </div>
                <button
                  type="button"
                  className="button button--primary button--sm"
                  onClick={() => navigate(`/product/${featuredProducts[0].id}`)}
                >
                  View product
                </button>
              </>
            ) : (
              <>
                <h3>Fresh deals will appear here</h3>
                <p>
                  Once the catalog loads, Parasale can spotlight fast-moving
                  items right from the home screen.
                </p>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="shell feature-strip">
        <div className="feature-strip__item">
          <strong>Quick category browse</strong>
          <span>Jump from home straight into aisle-based shopping.</span>
        </div>
        <div className="feature-strip__item">
          <strong>Cleaner price visibility</strong>
          <span>MRP, live price, and savings are easier to scan.</span>
        </div>
        <div className="feature-strip__item">
          <strong>Checkout built for repeat orders</strong>
          <span>Saved addresses and order review stay close at hand.</span>
        </div>
      </section>

      <section id="store-categories" className="storefront-section shell">
        <div className="section-header">
          <div>
            <p className="eyebrow">Browse aisles</p>
            <h2 className="section-title">Shop by category</h2>
            <p className="section-copy">
              The refreshed Parasale layout keeps category discovery front and
              center, just like a shopping app should.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Loading storefront...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">🛍️</p>
            <h3 className="empty-state__title">No categories yet</h3>
            <p>Once categories are added, they will appear here as shop aisles.</p>
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((category, index) => {
              const meta = getCategoryMeta(category, index)

              return (
                <button
                  key={category.id}
                  type="button"
                  className={`category-card theme-${meta.theme} reveal`}
                  onClick={() => navigate(`/products/${category.slug}`)}
                >
                  <span className="category-card__icon">{meta.icon}</span>
                  <h3 className="category-card__name">{category.name}</h3>
                  <p className="category-card__copy">{meta.blurb}</p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {featuredProducts.length > 0 ? (
        <section className="storefront-section shell">
          <div className="section-header">
            <div>
              <p className="eyebrow">Featured picks</p>
              <h2 className="section-title">Fast-moving products</h2>
              <p className="section-copy">
                These cards now look and behave more like a shopping app, with
                bold imagery, offers, and one-tap cart actions.
              </p>
            </div>
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
      ) : null}
    </div>
  )
}
