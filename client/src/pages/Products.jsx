import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { formatCategoryLabel } from '../lib/storefront'
import useCartStore from '../store/cartStore'

const PAGE_SIZE = 24

export default function Products() {
  const { categorySlug } = useParams()
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const addItem = useCartStore(s => s.addItem)
  const navigate = useNavigate()
  const searchQuery = searchParams.get('q')?.trim() || ''
  const filterInStock = searchParams.get('filter') === 'instock'

  useEffect(() => {
    let isMounted = true

    setLoading(true)
    setPage(1)
    getProducts(categorySlug, searchQuery)
      .then(res => {
        if (isMounted) setProducts(res.data || [])
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [categorySlug, searchQuery])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1)
  }, [filterInStock])

  const categoryLabel = formatCategoryLabel(categorySlug)
  const discountedProducts = products.filter(
    product => Number(product.mrp || 0) > Number(product.price || 0)
  )
  const inStockProducts = products.filter(product => Number(product.stock || 0) > 0)
  const hasSearch = Boolean(searchQuery)

  const displayedProducts = filterInStock ? inStockProducts : products
  const totalPages = Math.ceil(displayedProducts.length / PAGE_SIZE)
  const pageProducts = displayedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const heroEyebrow = filterInStock
    ? 'In stock'
    : hasSearch
      ? 'Search results'
      : categorySlug
        ? 'Category aisle'
        : 'Catalog'

  const heroTitle = filterInStock
    ? 'In Stock Products'
    : hasSearch
      ? `Results for "${searchQuery}"`
      : categorySlug
        ? categoryLabel
        : 'All products'

  const heroCopy = filterInStock
    ? 'Showing only products currently available in stock and ready to ship.'
    : hasSearch
      ? 'Search now scans product name, brand, and description so the navbar search leads somewhere useful.'
      : categorySlug
        ? 'Browse this category and add items straight to your cart.'
        : 'Browse the full active catalog and use the search bar to quickly narrow things down.'

  const sectionTitle = filterInStock
    ? `${inStockProducts.length} items in stock`
    : hasSearch
      ? `Matching products`
      : categorySlug
        ? `${categoryLabel} picks`
        : 'Browse all products'

  const emptyTitle = hasSearch
    ? 'No products matched your search'
    : filterInStock
      ? 'No products in stock'
      : categorySlug
        ? 'No products in this aisle'
        : 'No products available yet'

  const emptyCopy = hasSearch
    ? 'Try a different keyword, brand name, or shorter phrase.'
    : filterInStock
      ? 'Check back soon — stock is updated regularly.'
      : categorySlug
        ? 'Try another category or add new inventory from the admin side.'
        : 'Add inventory from the admin side to populate the storefront.'

  const goToPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = []
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages)
    } else if (page >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
    }
    return pages
  }

  return (
    <div className="storefront-page">
      <section className="catalog-hero shell reveal">
        <button
          type="button"
          className="text-link"
          onClick={() => navigate('/')}
        >
          ← {categorySlug ? 'Back to categories' : 'Back to store'}
        </button>

        <div className="catalog-hero__row">
          <div className="catalog-hero__content">
            <p className="eyebrow">{heroEyebrow}</p>
            <h1 className="catalog-hero__title">{heroTitle}</h1>
            <p className="catalog-hero__copy">{heroCopy}</p>
          </div>

          <div className="catalog-hero__metrics">
            <div className="stat-tile">
              <strong>{products.length}</strong>
              <span>products</span>
            </div>
            <div className="stat-tile">
              <strong>{discountedProducts.length}</strong>
              <span>on offer</span>
            </div>
            <div className="stat-tile">
              <strong>{inStockProducts.length}</strong>
              <span>ready stock</span>
            </div>
          </div>
        </div>
      </section>

      <section className="storefront-section shell">
        <div className="section-header">
          <div>
            <p className="eyebrow">Products</p>
            <h2 className="section-title">{sectionTitle}</h2>
          </div>
          {!loading && displayedProducts.length > 0 && (
            <p className="catalog-note">
              {displayedProducts.length} products &nbsp;·&nbsp; page {page} of {totalPages}
            </p>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Loading products...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">📦</p>
            <h3 className="empty-state__title">{emptyTitle}</h3>
            <p>{emptyCopy}</p>
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
