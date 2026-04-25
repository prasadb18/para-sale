import { useNavigate } from 'react-router-dom'
import useWishlistStore from '../store/wishlistStore'
import useCartStore from '../store/cartStore'
import { formatCurrency, getDiscountPercent } from '../lib/storefront'
import { imgUrl } from '../lib/imgUrl'

export default function Wishlist() {
  const navigate  = useNavigate()
  const items     = useWishlistStore(s => s.items)
  const toggle    = useWishlistStore(s => s.toggle)
  const addItem   = useCartStore(s => s.addItem)

  const handleAddToCart = (product) => {
    addItem(product)
    toggle(product)
  }

  if (items.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">🤍</p>
          <h2 className="empty-state__title">No saved items</h2>
          <p style={{ color: 'var(--text-soft)', marginBottom: 20 }}>
            Click the ♡ on any product to save it here.
          </p>
          <button className="button button--primary" onClick={() => navigate('/products')}>
            Browse Products
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="page-header">
        <h1 className="page-header__title">Saved Items</h1>
        <span className="page-header__count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="product-grid">
        {items.map(item => {
          const discount = getDiscountPercent(item.price, item.mrp)
          const inStock  = Number(item.stock || 0) > 0
          return (
            <div key={item.id} className="wishlist-card">
              <button
                className="wishlist-card__remove"
                onClick={() => toggle(item)}
                aria-label="Remove from wishlist"
              >
                ✕
              </button>
              {discount > 0 && (
                <span className="wishlist-card__badge">{discount}% off</span>
              )}
              <div
                className="wishlist-card__img-wrap"
                onClick={() => navigate(`/product/${item.id}`)}
                style={{ cursor: 'pointer' }}
              >
                {item.image_url
                  ? <img src={imgUrl(item.image_url, { width: 300 })} alt={item.name} className="wishlist-card__img" />
                  : <div className="wishlist-card__placeholder">📦</div>}
              </div>
              <div className="wishlist-card__body">
                {item.brand && <p className="wishlist-card__brand">{item.brand}</p>}
                <p
                  className="wishlist-card__name"
                  onClick={() => navigate(`/product/${item.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {item.name}
                </p>
                <p className="wishlist-card__price">{formatCurrency(item.price)}</p>
                {!inStock && <p className="wishlist-card__oos">Out of stock</p>}
                <button
                  className={`button button--sm ${inStock ? 'button--primary' : 'button--secondary'}`}
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={!inStock}
                  onClick={() => inStock && handleAddToCart(item)}
                >
                  {inStock ? 'Add to Cart' : 'Unavailable'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
