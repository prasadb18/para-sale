import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  getProduct,
  getProductReviewSummary,
  getProductReviews,
  getProductVariants,
  submitReview,
  deleteReview
} from '../api'
import { formatCurrency, getDiscountPercent } from '../lib/storefront'
import useCartStore from '../store/cartStore'
import useWishlistStore from '../store/wishlistStore'
import useCompareStore from '../store/compareStore'
import useAuthStore from '../store/authStore'
import { imgUrl } from '../lib/imgUrl'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'

const RETURN_POLICIES = [
  { match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i, icon: '⚡', title: 'Electricals — Exchange only', lines: ['Non-returnable once installed or packaging is opened.', 'Manufacturing defects exchangeable within 7 days with proof of purchase.', 'Bring the item unused and in original packaging for exchange.'] },
  { match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i, icon: '🔧', title: 'Plumbing — Exchange only', lines: ['Non-returnable once fitted or sealed packaging is opened.', 'Manufacturing defects exchangeable within 7 days.', 'Physical damage during installation is not covered.'] },
  { match: /paint|primer|putty|varnish|enamel|wood finish/i, icon: '🎨', title: 'Paints — No returns', lines: ['Paints cannot be returned once the can is opened.', 'Verify shade and finish before use — custom tints are final.', 'Contact us within 24 hours of delivery for any supply issue.'] },
  { match: /tool|drill|saw|hammer|screw|nut|bolt|fastener|anchor/i, icon: '🛠️', title: 'Tools — 7-day exchange', lines: ['Exchange within 7 days for manufacturing defects.', 'Original packaging and accessories must be included.', 'Items with signs of use or damage are not eligible.'] },
]

const DEFAULT_POLICY = {
  icon: '🔄',
  title: '7-day exchange on defects',
  lines: ['Items can be exchanged within 7 days for manufacturing defects.', 'Proof of purchase required. Original packaging preferred.', 'Contact us via WhatsApp or visit the store for a quick resolution.']
}

const SERVICE_MAP = [
  { match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i, type: 'electrical', icon: '⚡', label: 'Need an Electrician?', desc: 'We can install, wire or fit this product for you.' },
  { match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i, type: 'plumbing', icon: '🔧', label: 'Need a Plumber?', desc: 'We can fit, connect or repair plumbing for you.' },
  { match: /paint|primer|putty|varnish|enamel|wood finish/i, type: 'painting', icon: '🎨', label: 'Need a Painter?', desc: 'We can apply this product professionally for you.' },
]

function Stars({ rating, size = '0.95rem' }) {
  return (
    <span className="review-stars" style={{ fontSize: size }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={rating >= i ? 'review-stars__star review-stars__star--filled' : 'review-stars__star'}>
          ★
        </span>
      ))}
    </span>
  )
}

function StarInput({ value, onChange }) {
  return (
    <div className="review-form__stars">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={`review-form__star-btn ${value >= i ? 'review-form__star-btn--active' : ''}`}
          onClick={() => onChange(i)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const ratingLabel = (rating) => ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] || ''
const formatReviewDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [related, setRelated] = useState([])
  const [fbt, setFbt] = useState([])
  const [added, setAdded] = useState(false)
  const [notifyDone, setNotifyDone] = useState(false)
  const [watchDone, setWatchDone] = useState(false)
  const [pincode, setPincode] = useState(() => localStorage.getItem('@last_pincode') || '')
  const [pincodeRes, setPincodeRes] = useState(null)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [variants, setVariants] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [draftRating, setDraftRating] = useState(0)
  const [draftText, setDraftText] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)

  const addItem = useCartStore(s => s.addItem)
  const isWishlisted = useWishlistStore(s => product ? s.isWishlisted(product.id) : false)
  const toggleWish = useWishlistStore(s => s.toggle)
  const compareAdd = useCompareStore(s => s.add)
  const compareRemove = useCompareStore(s => s.remove)
  const isComparing = useCompareStore(s => product ? s.isComparing(product.id) : false)
  const compareCount = useCompareStore(s => s.items.length)

  const loadReviews = useCallback((productId) => {
    setReviewsLoading(true)
    Promise.all([
      getProductReviewSummary(productId),
      getProductReviews(productId)
    ])
      .then(([summaryRes, reviewsRes]) => {
        setSummary(summaryRes.data)
        setReviews(reviewsRes.data || [])
      })
      .catch(() => {
        setSummary(null)
        setReviews([])
      })
      .finally(() => setReviewsLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    setRelated([])
    setFbt([])
    setSummary(null)
    setReviews([])
    setVariants([])
    setSelectedVariant(null)
    setShowAllReviews(false)
    getProduct(id)
      .then(async res => {
        setProduct(res.data)
        loadReviews(res.data.id)
        getProductVariants(res.data.id)
          .then(variantRes => {
            const nextVariants = variantRes.data || []
            setVariants(nextVariants)
            setSelectedVariant(nextVariants[0] || null)
          })
          .catch(() => {
            setVariants([])
            setSelectedVariant(null)
          })
        if (res.data?.category_id) {
          const { data: rel } = await supabase
            .from('products')
            .select('*, categories(name)')
            .eq('category_id', res.data.category_id)
            .eq('is_active', true)
            .neq('id', res.data.id)
            .order('stock', { ascending: false })
            .limit(8)
          const others = rel || []
          setRelated(others)
          try {
            const { data: fbtIds } = await supabase.rpc('get_frequently_bought_together', {
              p_product_id: String(res.data.id),
              p_limit: 4
            })
            if (fbtIds?.length > 0) {
              const idSet = new Set(fbtIds.map(row => String(row.product_id)))
              setFbt(others.filter(item => idSet.has(String(item.id))).slice(0, 4))
            }
          } catch {
            // FBT is optional
          }
        }
      })
      .finally(() => setLoading(false))
  }, [id, loadReviews])

  const activePrice = selectedVariant ? Number(selectedVariant.price) : Number(product?.price || 0)
  const activeMrp = selectedVariant ? Number((selectedVariant.mrp ?? product?.mrp) || 0) : Number(product?.mrp || 0)
  const activeStock = selectedVariant ? Number(selectedVariant.stock) : Number(product?.stock || 0)

  const handleAdd = () => {
    if (variants.length > 0 && !selectedVariant) {
      alert('Please select a variant before adding to cart.')
      return
    }

    addItem({
      ...product,
      productId: product.id,
      price: activePrice,
      mrp: activeMrp,
      spec: selectedVariant ? `${selectedVariant.attribute_name}: ${selectedVariant.value}` : product.spec,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant ? `${selectedVariant.attribute_name}: ${selectedVariant.value}` : undefined
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleNotifyMe = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    await supabase.from('stock_alerts').upsert(
      { user_id: user.id, product_id: String(product.id), variant_id: selectedVariant?.id ?? null },
      { onConflict: 'user_id,product_id,variant_id' }
    )
    setNotifyDone(true)
    alert("We'll notify you when this item is back in stock.")
  }

  const handleWatchPrice = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    await supabase.from('price_drop_alerts').upsert(
      { user_id: user.id, product_id: String(product.id), alert_price: Number(activePrice) },
      { onConflict: 'user_id,product_id' }
    )
    setWatchDone(true)
    alert("We'll notify you when the price drops.")
  }

  const handleCheckPincode = useCallback(async () => {
    const cleaned = pincode.trim()
    if (!/^\d{6}$/.test(cleaned)) {
      alert('Enter a valid 6-digit pincode.')
      return
    }
    setPincodeLoading(true)
    setPincodeRes(null)
    const { data } = await supabase
      .from('serviceable_pincodes')
      .select('city, state, delivery_days')
      .eq('pincode', cleaned)
      .maybeSingle()
    setPincodeRes(data ?? 'not_serviceable')
    localStorage.setItem('@last_pincode', cleaned)
    setPincodeLoading(false)
  }, [pincode])

  const handleShare = () => {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: product.name, text: `${product.name} — ${formatCurrency(activePrice)}`, url })
    else {
      navigator.clipboard.writeText(url).catch(() => {})
      alert('Link copied!')
    }
  }

  const handleSubmitReview = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (draftRating === 0) {
      alert('Please choose a star rating before submitting.')
      return
    }
    setReviewSaving(true)
    try {
      const reviewerName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      await submitReview(product.id, {
        user_id: user.id,
        rating: draftRating,
        review_text: draftText.trim() || undefined,
        reviewer_name: reviewerName
      })
      setDraftRating(0)
      setDraftText('')
      loadReviews(product.id)
    } catch {
      alert('Could not submit your review. Please try again.')
    } finally {
      setReviewSaving(false)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!user) return
    try {
      await deleteReview(product.id, reviewId, user.id)
      loadReviews(product.id)
    } catch {
      alert('Could not delete your review. Please try again.')
    }
  }

  if (loading) {
    return <div className="storefront-page shell"><div className="loading-state"><p>Loading…</p></div></div>
  }

  if (!product) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">📦</p>
          <h2 className="empty-state__title">Product not found</h2>
          <button className="button button--primary" onClick={() => navigate('/')}>Back to store</button>
        </div>
      </div>
    )
  }

  const discount = getDiscountPercent(activePrice, activeMrp)
  const inStock = activeStock > 0
  const cat = product.categories?.name || ''
  const policy = RETURN_POLICIES.find(item => item.match.test(cat)) || DEFAULT_POLICY
  const svc = SERVICE_MAP.find(item => item.match.test(cat))
  const myReview = reviews.find(review => review.user_id === user?.id)
  const displayReviews = showAllReviews ? reviews : reviews.slice(0, 3)

  return (
    <div className="storefront-page shell">
      <button className="text-link" onClick={() => navigate(-1)}>← Back</button>

      <div className="product-detail reveal">
        <div className="product-detail__media">
          {product.image_url
            ? <img className="product-detail__image" src={imgUrl(product.image_url, { width: 800, quality: 85 })} alt={product.name} />
            : <div className="product-detail__placeholder">📦</div>}
          {discount > 0 && <span className="product-detail__badge">{discount}% lower than MRP</span>}
        </div>

        <div className="product-detail__info">
          <p className="eyebrow">{cat || 'Catalog item'}</p>
          <h1 className="product-detail__title">{product.name}</h1>
          <p className="product-detail__brand">{product.brand || '1ShopStore Select'}</p>

          {summary?.count > 0 && (
            <div className="product-detail__rating-inline">
              <Stars rating={summary.avg} />
              <span>{summary.avg}</span>
              <button type="button" className="text-link text-link--sm" onClick={() => setShowAllReviews(true)}>
                {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
              </button>
            </div>
          )}

          <p className="product-detail__description">{product.description || 'Ready for day-to-day ordering with a clean 1ShopStore shopping experience.'}</p>

          {variants.length > 0 && (
            <div className="product-detail__variants">
              <p className="product-detail__variants-label">{variants[0].attribute_name}</p>
              <div className="product-detail__variant-list">
                {variants.map(variant => {
                  const isSelected = selectedVariant?.id === variant.id
                  const isVariantOutOfStock = Number(variant.stock) <= 0
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={`product-detail__variant-chip ${isSelected ? 'product-detail__variant-chip--active' : ''}`}
                      disabled={isVariantOutOfStock}
                      onClick={() => setSelectedVariant(variant)}
                    >
                      {variant.value}
                      {isVariantOutOfStock ? ' (OOS)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="product-detail__price-row">
            <span className="product-detail__price">{formatCurrency(activePrice)}</span>
            {discount > 0 && <span className="product-detail__mrp">{formatCurrency(activeMrp)}</span>}
          </div>

          <p className={`stock-indicator ${inStock ? 'stock-indicator--good' : 'stock-indicator--low'}`}>
            {inStock ? '✓' : '!'} {inStock ? `In stock: ${activeStock} ${product.unit || 'units'}` : 'Out of stock'}
          </p>

          <div className="pincode-box">
            <p className="pincode-box__label">📍 Check delivery for your pincode</p>
            <div className="pincode-box__row">
              <input
                className="form-input pincode-box__input"
                placeholder="6-digit pincode"
                maxLength={6}
                value={pincode}
                onChange={e => { setPincode(e.target.value); setPincodeRes(null) }}
                onKeyDown={e => e.key === 'Enter' && handleCheckPincode()}
              />
              <button className="button button--primary button--sm" onClick={handleCheckPincode} disabled={pincodeLoading}>
                {pincodeLoading ? '…' : 'Check'}
              </button>
            </div>
            {pincodeRes !== null && (
              pincodeRes === 'not_serviceable'
                ? <p className="pincode-box__result pincode-box__result--no">✗ Sorry, we don't deliver to this pincode yet.</p>
                : <p className="pincode-box__result pincode-box__result--yes">✓ Delivered to {pincodeRes.city}, {pincodeRes.state} in {pincodeRes.delivery_days === 1 ? '1 day' : `${pincodeRes.delivery_days} days`}</p>
            )}
          </div>

          <div className="product-detail__actions">
            {inStock ? (
              <button className={`button button--primary ${added ? 'button--success' : ''}`} disabled={added} onClick={handleAdd}>
                {added ? '✓ Added to cart' : 'Add to cart'}
              </button>
            ) : (
              <button className="button button--notify" disabled={notifyDone} onClick={handleNotifyMe}>
                {notifyDone ? '🔔 Alert set!' : '🔔 Notify Me'}
              </button>
            )}
            <button className="button button--secondary" onClick={() => navigate('/cart')}>Go to cart</button>
          </div>

          <div className="product-detail__secondary-actions">
            <button
              className={`btn-icon ${isWishlisted ? 'btn-icon--active-red' : ''}`}
              onClick={() => product && toggleWish(product)}
              title="Wishlist"
            >
              {isWishlisted ? '❤️' : '🤍'}
            </button>
            {inStock && (
              <button className={`btn-icon ${watchDone ? 'btn-icon--active-green' : ''}`} onClick={handleWatchPrice} title="Watch Price">
                {watchDone ? '📉✓' : '📉'}
              </button>
            )}
            <button
              className={`btn-icon ${isComparing ? 'btn-icon--active-blue' : ''}`}
              onClick={() => {
                if (isComparing) compareRemove(product.id)
                else {
                  const ok = compareAdd(product)
                  if (!ok) alert('You can compare up to 3 products at a time.')
                }
              }}
              title="Compare"
            >
              ⚖️
            </button>
            <button className="btn-icon" onClick={handleShare} title="Share">↗️</button>
          </div>

          {compareCount >= 2 && (
            <div className="compare-tray">
              <span>⚖️ {compareCount} products selected</span>
              <Link to="/compare" className="button button--primary button--sm">Compare →</Link>
            </div>
          )}

          <div className="return-policy">
            <p className="return-policy__heading"><span>{policy.icon}</span> {policy.title}</p>
            <ul className="return-policy__list">{policy.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </div>

          {svc && (
            <Link to={`/services?type=${svc.type}`} className="service-combo-cta">
              <span className="service-combo-cta__icon">{svc.icon}</span>
              <div>
                <p className="service-combo-cta__title">{svc.label}</p>
                <p className="service-combo-cta__desc">{svc.desc} Book a technician →</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      <section className="product-reviews">
        <div className="product-reviews__header">
          <h2 className="section-title">Ratings & Reviews</h2>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => {
              if (!user) {
                navigate('/login')
                return
              }
              setDraftRating(myReview?.rating ?? 0)
              setDraftText(myReview?.review_text ?? '')
            }}
          >
            {myReview ? 'Edit Review' : 'Write Review'}
          </button>
        </div>

        <div className="product-reviews__composer">
          <StarInput value={draftRating} onChange={setDraftRating} />
          {draftRating > 0 && <p className="product-reviews__rating-label">{ratingLabel(draftRating)}</p>}
          <textarea
            className="form-input product-reviews__textarea"
            placeholder="Share what you liked, quality notes, or installation experience"
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
          />
          <button
            type="button"
            className="button button--primary button--sm"
            disabled={reviewSaving}
            onClick={handleSubmitReview}
          >
            {reviewSaving ? 'Saving...' : myReview ? 'Update Review' : 'Submit Review'}
          </button>
        </div>

        {reviewsLoading ? (
          <div className="loading-state"><p>Loading reviews...</p></div>
        ) : summary?.count > 0 ? (
          <>
            <div className="product-reviews__summary">
              <div className="product-reviews__summary-score">
                <strong>{summary.avg}</strong>
                <Stars rating={summary.avg} size="1.15rem" />
                <span>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</span>
              </div>
              <div className="product-reviews__summary-bars">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = summary.dist?.[star] || 0
                  const width = summary.count ? `${(count / summary.count) * 100}%` : '0%'
                  return (
                    <div key={star} className="product-reviews__bar-row">
                      <span>{star}★</span>
                      <div className="product-reviews__bar-track">
                        <div className="product-reviews__bar-fill" style={{ width }} />
                      </div>
                      <span>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="product-reviews__list">
              {displayReviews.map(review => (
                <article key={review.id} className="product-reviews__card">
                  <div className="product-reviews__card-top">
                    <div>
                      <p className="product-reviews__name">{review.reviewer_name || 'User'}</p>
                      <div className="product-reviews__meta">
                        <Stars rating={review.rating} size="0.85rem" />
                        <span>{ratingLabel(review.rating)}</span>
                      </div>
                    </div>
                    <div className="product-reviews__date-block">
                      <span>{formatReviewDate(review.created_at)}</span>
                      {review.user_id === user?.id && (
                        <button type="button" className="text-link text-link--sm" onClick={() => handleDeleteReview(review.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {review.review_text ? <p className="product-reviews__text">{review.review_text}</p> : null}
                </article>
              ))}
            </div>

            {reviews.length > 3 && (
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => setShowAllReviews(value => !value)}
              >
                {showAllReviews ? 'Show less' : `See all ${reviews.length} reviews`}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state empty-state--compact">
            <p className="empty-state__icon">⭐</p>
            <h3 className="empty-state__title">No reviews yet</h3>
            <p>Be the first to review this product.</p>
          </div>
        )}
      </section>

      {fbt.length > 0 && (
        <section className="fbt-section">
          <h2 className="section-title">🛒 Frequently Bought Together</h2>
          <div className="fbt-row">
            <div className="fbt-card">
              {product.image_url
                ? <img src={imgUrl(product.image_url, { width: 120 })} alt={product.name} className="fbt-card__img" />
                : <div className="fbt-card__placeholder">📦</div>}
              <p className="fbt-card__name">{product.name}</p>
              <p className="fbt-card__price">{formatCurrency(activePrice)}</p>
            </div>
            {fbt.map(item => (
              <span key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="fbt-plus">+</span>
                <Link to={`/product/${item.id}`} className="fbt-card">
                  {item.image_url
                    ? <img src={imgUrl(item.image_url, { width: 120 })} alt={item.name} className="fbt-card__img" />
                    : <div className="fbt-card__placeholder">📦</div>}
                  <p className="fbt-card__name">{item.name}</p>
                  <p className="fbt-card__price">{formatCurrency(item.price)}</p>
                </Link>
              </span>
            ))}
          </div>
          <div className="fbt-footer">
            <span className="fbt-footer__total">
              Bundle: <strong>{formatCurrency(fbt.reduce((sum, item) => sum + Number(item.price), Number(activePrice)))}</strong>
            </span>
            <button
              className="button button--primary button--sm"
              onClick={() => {
                handleAdd()
                fbt.forEach(item => addItem(item))
              }}
            >
              Add All to Cart
            </button>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="related-section">
          <h2 className="related-section__title">More from {cat || 'this category'}</h2>
          <div className="product-grid">
            {related.map(item => (
              <ProductCard key={item.id} product={item} onSelect={p => navigate(`/product/${p.id}`)} onAdd={addItem} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
