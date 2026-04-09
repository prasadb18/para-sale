import {
  formatCurrency,
  getDeliveryMessage,
  getDiscountPercent
} from '../lib/storefront'
import { imgUrl } from '../lib/imgUrl'

export default function ProductCard({
  product,
  onSelect,
  onAdd,
  showCategory = false
}) {
  const discount = getDiscountPercent(product.price, product.mrp)
  const deliveryMessage = getDeliveryMessage(product.stock)
  const isOutOfStock = Number(product.stock || 0) === 0

  const handleAdd = () => {
    if (!isOutOfStock) onAdd(product)
  }

  return (
    <article className="product-card reveal">
      <button
        type="button"
        className="product-card__image"
        onClick={() => onSelect(product)}
        aria-label={`View ${product.name}`}
      >
        {product.image_url ? (
          <img
            className="product-card__img"
            src={imgUrl(product.image_url, { width: 320, quality: 75 })}
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="product-card__placeholder">📦</div>
        )}
      </button>

      <div className="product-card__body">
        <div className="product-card__pills">
          {showCategory && product.categories?.name ? (
            <p className="product-card__category">{product.categories.name}</p>
          ) : null}
          {discount > 0 ? (
            <span className="product-card__badge">{discount}% off</span>
          ) : (
            <span className="product-card__badge product-card__badge--soft">
              {deliveryMessage}
            </span>
          )}
        </div>

        <button
          type="button"
          className="product-card__title"
          onClick={() => onSelect(product)}
        >
          {product.name}
        </button>

        {product.spec ? (
          <span className="product-card__spec">{product.spec}</span>
        ) : null}

        <p className="product-card__meta">
          {product.brand || '1ShopStore Select'} · {deliveryMessage}
        </p>

        <div className="product-card__footer">
          <div>
            <p className="product-card__price">{formatCurrency(product.price)}</p>
            {discount > 0 ? (
              <p className="product-card__mrp">{formatCurrency(product.mrp)}</p>
            ) : (
              <p className="product-card__mrp product-card__mrp--plain">
                {product.unit ? `Sold per ${product.unit}` : 'Value pricing'}
              </p>
            )}
          </div>

          <button
            type="button"
            className={`button ${isOutOfStock ? 'button--secondary' : 'button--primary'} button--sm`}
            onClick={handleAdd}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? 'Unavailable' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  )
}
