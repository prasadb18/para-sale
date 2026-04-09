import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProduct } from '../api'
import { formatCurrency, getDiscountPercent } from '../lib/storefront'
import useCartStore from '../store/cartStore'

const RETURN_POLICIES = [
  {
    match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i,
    icon: '⚡',
    title: 'Electricals — Exchange only',
    lines: [
      'Non-returnable once installed or packaging is opened.',
      'Manufacturing defects exchangeable within 7 days with proof of purchase.',
      'Bring the item unused and in original packaging for exchange.'
    ]
  },
  {
    match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i,
    icon: '🔧',
    title: 'Plumbing & Sanitaryware — Exchange only',
    lines: [
      'Non-returnable once fitted or sealed packaging is opened.',
      'Manufacturing defects exchangeable within 7 days.',
      'Physical damage during installation is not covered.'
    ]
  },
  {
    match: /paint|primer|putty|varnish|enamel|wood finish/i,
    icon: '🎨',
    title: 'Paints & Finishes — No returns',
    lines: [
      'Paints cannot be returned once the can is opened.',
      'Verify shade and finish before use — custom tints are final.',
      'Contact us within 24 hours of delivery for any supply issue.'
    ]
  },
  {
    match: /tool|drill|saw|hammer|screw|nut|bolt|fastener|anchor/i,
    icon: '🛠️',
    title: 'Tools & Hardware — 7-day exchange',
    lines: [
      'Exchange within 7 days for manufacturing defects.',
      'Original packaging and accessories must be included.',
      'Items with signs of use or damage are not eligible.'
    ]
  }
]

const DEFAULT_POLICY = {
  icon: '🔄',
  title: '7-day exchange on defects',
  lines: [
    'Items can be exchanged within 7 days for manufacturing defects.',
    'Proof of purchase required. Original packaging preferred.',
    'Contact us via WhatsApp or visit the store for a quick resolution.'
  ]
}

function ReturnPolicy({ category }) {
  const cat = category || ''
  const policy = RETURN_POLICIES.find(p => p.match.test(cat)) || DEFAULT_POLICY
  return (
    <div className="return-policy">
      <p className="return-policy__heading">
        <span>{policy.icon}</span> {policy.title}
      </p>
      <ul className="return-policy__list">
        {policy.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const addItem = useCartStore(s => s.addItem)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    setLoading(true)
    getProduct(id)
      .then(res => {
        if (isMounted) setProduct(res.data)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="storefront-page shell">
        <div className="loading-state">
          <p>Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">📦</p>
          <h2 className="empty-state__title">Product not found</h2>
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate('/')}
          >
            Back to store
          </button>
        </div>
      </div>
    )
  }

  const discount = getDiscountPercent(product.price, product.mrp)
  const stock = Number(product.stock || 0)
  const stockLabel =
    stock > 0
      ? `In stock: ${stock} ${product.unit || 'units'}`
      : 'Out of stock right now'

  return (
    <div className="storefront-page shell">
      <button
        type="button"
        className="text-link"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="product-detail reveal">
        <div className="product-detail__media">
          {product.image_url ? (
            <img
              className="product-detail__image"
              src={product.image_url}
              alt={product.name}
            />
          ) : (
            <div className="product-detail__placeholder">📦</div>
          )}

          {discount > 0 ? (
            <span className="product-detail__badge">
              {discount}% lower than MRP
            </span>
          ) : null}
        </div>

        <div className="product-detail__info">
          <p className="eyebrow">{product.categories?.name || 'Catalog item'}</p>
          <h1 className="product-detail__title">{product.name}</h1>
          <p className="product-detail__brand">
            {product.brand || '1ShopStore Select'}
          </p>
          <p className="product-detail__description">
            {product.description ||
              'This item is ready for day-to-day ordering with a cleaner 1ShopStore shopping experience.'}
          </p>

          <div className="product-detail__price-row">
            <span className="product-detail__price">
              {formatCurrency(product.price)}
            </span>
            {discount > 0 ? (
              <span className="product-detail__mrp">
                {formatCurrency(product.mrp)}
              </span>
            ) : null}
          </div>

          <p
            className={`stock-indicator ${stock > 0 ? 'stock-indicator--good' : 'stock-indicator--low'}`}
          >
            {stock > 0 ? '✓' : '!'} {stockLabel}
          </p>

          <div className="info-list">
            <div className="info-list__item">
              <strong>{product.unit ? `Per ${product.unit}` : 'Standard pack'}</strong>
              <span>Clear unit-based pricing for repeat purchases.</span>
            </div>
            <div className="info-list__item">
              <strong>{product.brand || 'Trusted supplier'}</strong>
              <span>Brand or supplier reference stays visible in the detail view.</span>
            </div>
            <div className="info-list__item">
              <strong>{stock > 20 ? 'Fast dispatch' : stock > 0 ? 'Limited stock' : 'Restocking'}</strong>
              <span>
                {stock > 20
                  ? 'Healthy stock is available right now.'
                  : stock > 0
                    ? 'Order soon while inventory is still available.'
                    : 'This item is temporarily unavailable.'}
              </span>
            </div>
          </div>

          <div className="product-detail__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={stock === 0}
              onClick={() => addItem(product)}
            >
              {stock === 0 ? 'Unavailable' : 'Add to cart'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => navigate('/cart')}
            >
              Go to cart
            </button>
          </div>

          <ReturnPolicy category={product.categories?.name} />
        </div>
      </div>
    </div>
  )
}
