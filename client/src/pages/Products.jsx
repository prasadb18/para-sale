import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { formatCategoryLabel } from '../lib/storefront'
import useCartStore from '../store/cartStore'

const PAGE_SIZE = 24

// filter values: 'all' | 'instock' | 'offer'

export default function Products() {
  const { categorySlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const addItem = useCartStore(s => s.addItem)
  const navigate = useNavigate()
  const searchQuery = searchParams.get('q')?.trim() || ''
  const activeFilter = searchParams.get('filter') || 'all'

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setPage(1)
    getProducts(categorySlug, searchQuery)
      .then(res => { if (isMounted) setProducts(res.data || []) })
      .finally(() => { if (isMounted) setLoading(false) })
    return () => { isMounted = false }
  }, [categorySlug, searchQuery])

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1) }, [activeFilter])

  const setFilter = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === 'all') next.delete('filter')
      else next.set('filter', value)
      return next
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoryLabel = formatCategoryLabel(categorySlug)
  const discountedProducts = products.filter(p => Number(p.mrp || 0) > Number(p.price || 0))
  const inStockProducts = products.filter(p => Number(p.stock || 0) > 0)
  const hasSearch = Boolean(searchQuery)

  const displayedProducts =
    activeFilter === 'instock' ? inStockProducts
    : activeFilter === 'offer' ? discountedProducts
    : products

  const totalPages = Math.ceil(displayedProducts.length / PAGE_SIZE)
  const pageProducts = displayedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const heroTitle = hasSearch
    ? `Results for "${searchQuery}"`
    : categorySlug ? categoryLabel : 'All products'

  const heroEyebrow = hasSearch ? 'Search results' : categorySlug ? 'Category' : 'Catalog'

  const sectionTitle =
    activeFilter === 'instock' ? `${inStockProducts.length} in-stock products`
    : activeFilter === 'offer' ? `${discountedProducts.length} products on offer`
    : hasSearch ? `Matching products` : categorySlug ? `${categoryLabel}` : 'Browse all products'

  const emptyTitle =
    activeFilter === 'instock' ? 'No products in stock'
    : activeFilter === 'offer' ? 'No discounted products'
    : hasSearch ? 'No products matched your search'
    : categorySlug ? 'No products in this category' : 'No products available yet'

  const emptyCopy =
    activeFilter === 'instock' ? 'Check back soon — stock is updated regularly.'
    : activeFilter === 'offer' ? 'No offers right now. Browse all products instead.'
    : hasSearch ? 'Try a different keyword or shorter phrase.'
    : categorySlug ? 'Try another category or add inventory from admin.'
    : 'Add inventory from the admin side to populate the storefront.'

  const goToPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  return (
    <div className="storefront-page">
      <section className="catalog-hero shell reveal">
        <button type="button" className="text-link" onClick={() => navigate('/')}>
          ← {categorySlug ? 'Back to categories' : 'Back to store'}
        </button>

        <div className="catalog-hero__row">
          <div className="catalog-hero__content">
            <p className="eyebrow">{heroEyebrow}</p>
            <h1 className="catalog-hero__title">{heroTitle}</h1>
          </div>

          <div className="catalog-hero__metrics">
            <button
              type="button"
              className={`stat-tile stat-tile--btn ${activeFilter === 'all' ? 'stat-tile--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <strong>{products.length}</strong>
              <span>products</span>
            </button>
            <button
              type="button"
              className={`stat-tile stat-tile--btn ${activeFilter === 'offer' ? 'stat-tile--active' : ''}`}
              onClick={() => setFilter('offer')}
            >
              <strong>{discountedProducts.length}</strong>
              <span>on offer</span>
            </button>
            <button
              type="button"
              className={`stat-tile stat-tile--btn ${activeFilter === 'instock' ? 'stat-tile--active' : ''}`}
              onClick={() => setFilter('instock')}
            >
              <strong>{inStockProducts.length}</strong>
              <span>ready stock</span>
            </button>
          </div>
        </div>
      </section>

      <section className="storefront-section shell">
        <div className="section-header">
          <div>
            <h2 className="section-title">{sectionTitle}</h2>
          </div>
          {!loading && displayedProducts.length > 0 && totalPages > 1 && (
            <p className="catalog-note">
              page {page} of {totalPages}
            </p>
          )}
        </div>

        {loading ? (
          <div className="loading-state"><p>Loading products...</p></div>
        ) : displayedProducts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">📦</p>
            <h3 className="empty-state__title">{emptyTitle}</h3>
            <p>{emptyCopy}</p>
            {activeFilter !== 'all' && (
              <button type="button" className="button button--primary" style={{ marginTop: 16 }} onClick={() => setFilter('all')}>
                Show all products
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="product-grid">
              {pageProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={() => navigate(`/product/${product.id}`)}
                  onAdd={addItem}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination__btn"
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                >
                  ← Prev
                </button>

                <div className="pagination__pages">
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="pagination__ellipsis">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`pagination__page ${page === p ? 'pagination__page--active' : ''}`}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="pagination__btn"
                  disabled={page === totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
