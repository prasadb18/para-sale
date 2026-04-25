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
  const activeSort = searchParams.get('sort') || 'default'
  const minPrice = searchParams.get('min') || ''
  const maxPrice = searchParams.get('max') || ''

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

  const minNumber = minPrice ? Number(minPrice) : null
  const maxNumber = maxPrice ? Number(maxPrice) : null

  const filteredProducts = displayedProducts
    .filter(product => {
      const price = Number(product.price || 0)
      if (minNumber !== null && price < minNumber) return false
      if (maxNumber !== null && price > maxNumber) return false
      return true
    })
    .sort((a, b) => {
      if (activeSort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0)
      if (activeSort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0)
      if (activeSort === 'name_asc') return (a.name || '').localeCompare(b.name || '')
      return 0
    })

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const heroTitle = hasSearch
    ? `Results for "${searchQuery}"`
    : categorySlug ? categoryLabel : 'All products'

  const heroEyebrow = hasSearch ? 'Search results' : categorySlug ? 'Category' : 'Catalog'

  const sectionTitle =
    activeFilter === 'instock' ? `${filteredProducts.length} in-stock products`
    : activeFilter === 'offer' ? `${filteredProducts.length} products on offer`
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

  const updateCatalogParams = (updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === 'default') next.delete(key)
        else next.set(key, value)
      })
      return next
    })
  }

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
          {!loading && filteredProducts.length > 0 && totalPages > 1 && (
            <p className="catalog-note">
              page {page} of {totalPages}
            </p>
          )}
        </div>

        <div className="catalog-toolbar panel">
          <div className="catalog-toolbar__group">
            <label className="catalog-toolbar__label" htmlFor="catalog-sort">Sort</label>
            <select
              id="catalog-sort"
              className="form-input catalog-toolbar__select"
              value={activeSort}
              onChange={e => updateCatalogParams({ sort: e.target.value })}
            >
              <option value="default">Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
          <div className="catalog-toolbar__group catalog-toolbar__group--range">
            <label className="catalog-toolbar__label" htmlFor="catalog-min">Price Range</label>
            <div className="catalog-toolbar__range">
              <input
                id="catalog-min"
                className="form-input"
                inputMode="numeric"
                placeholder="Min"
                value={minPrice}
                onChange={e => updateCatalogParams({ min: e.target.value.replace(/\D/g, '') })}
              />
              <input
                className="form-input"
                inputMode="numeric"
                placeholder="Max"
                value={maxPrice}
                onChange={e => updateCatalogParams({ max: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => updateCatalogParams({ sort: '', min: '', max: '' })}
          >
            Reset Sort & Price
          </button>
        </div>

        {loading ? (
          <div className="loading-state"><p>Loading products...</p></div>
        ) : filteredProducts.length === 0 ? (
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
