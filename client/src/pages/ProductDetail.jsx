import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getProduct } from '../api'
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
const DEFAULT_POLICY = { icon: '🔄', title: '7-day exchange on defects', lines: ['Items can be exchanged within 7 days for manufacturing defects.', 'Proof of purchase required. Original packaging preferred.', 'Contact us via WhatsApp or visit the store for a quick resolution.'] }

const SERVICE_MAP = [
  { match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i, type: 'electrical', icon: '⚡', label: 'Need an Electrician?', desc: 'We can install, wire or fit this product for you.' },
  { match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i, type: 'plumbing', icon: '🔧', label: 'Need a Plumber?', desc: 'We can fit, connect or repair plumbing for you.' },
  { match: /paint|primer|putty|varnish|enamel|wood finish/i, type: 'painting', icon: '🎨', label: 'Need a Painter?', desc: 'We can apply this product professionally for you.' },
]

export default function ProductDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()

  const [product,     setProduct]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [related,     setRelated]     = useState([])
  const [fbt,         setFbt]         = useState([])
  const [added,       setAdded]       = useState(false)
  const [notifyDone,  setNotifyDone]  = useState(false)
  const [watchDone,   setWatchDone]   = useState(false)
  const [pincode,     setPincode]     = useState(() => localStorage.getItem('@last_pincode') || '')
  const [pincodeRes,  setPincodeRes]  = useState(null)
  const [pincodeLoading, setPincodeLoading] = useState(false)

  const addItem       = useCartStore(s => s.addItem)
  const isWishlisted  = useWishlistStore(s => product ? s.isWishlisted(product.id) : false)
  const toggleWish    = useWishlistStore(s => s.toggle)
  const compareAdd    = useCompareStore(s => s.add)
  const compareRemove = useCompareStore(s => s.remove)
  const isComparing   = useCompareStore(s => product ? s.isComparing(product.id) : false)
  const compareCount  = useCompareStore(s => s.items.length)

  useEffect(() => {
    setLoading(true)
    setRelated([])
    setFbt([])
    getProduct(id)
      .then(async res => {
        setProduct(res.data)
        if (res.data?.category_id) {
          const { data: rel } = await supabase
            .from('products').select('*, categories(name)')
            .eq('category_id', res.data.category_id).eq('is_active', true)
            .neq('id', res.data.id).order('stock', { ascending: false }).limit(8)
          const others = rel || []
          setRelated(others)
          try {
            const { data: fbtIds } = await supabase.rpc('get_frequently_bought_together', { p_product_id: String(res.data.id), p_limit: 4 })
            if (fbtIds?.length > 0) {
              const idSet = new Set(fbtIds.map(r => String(r.product_id)))
              setFbt(others.filter(p => idSet.has(String(p.id))).slice(0, 4))
            }
          } catch { /* FBT optional */ }
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleAdd = () => {
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleNotifyMe = async () => {
    if (!user) { navigate('/login'); return }
    await supabase.from('stock_alerts').upsert(
      { user_id: user.id, product_id: String(product.id), variant_id: null },
      { onConflict: 'user_id,product_id,variant_id' }
    )
    setNotifyDone(true)
    alert("We'll notify you when this item is back in stock.")
  }

  const handleWatchPrice = async () => {
    if (!user) { navigate('/login'); return }
    await supabase.from('price_drop_alerts').upsert(
      { user_id: user.id, product_id: String(product.id), alert_price: Number(product.price) },
      { onConflict: 'user_id,product_id' }
    )
    setWatchDone(true)
    alert("We'll notify you when the price drops.")
  }

  const handleCheckPincode = useCallback(async () => {
    const cleaned = pincode.trim()
    if (!/^\d{6}$/.test(cleaned)) { alert('Enter a valid 6-digit pincode.'); return }
    setPincodeLoading(true)
    setPincodeRes(null)
    const { data } = await supabase.from('serviceable_pincodes').select('city, state, delivery_days').eq('pincode', cleaned).maybeSingle()
    setPincodeRes(data ?? 'not_serviceable')
    localStorage.setItem('@last_pincode', cleaned)
    setPincodeLoading(false)
  }, [pincode])

  const handleShare = () => {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: product.name, text: `${product.name} — ${formatCurrency(product.price)}`, url })
    else { navigator.clipboard.writeText(url).catch(() => {}); alert('Link copied!') }
  }

  if (loading) return <div className="storefront-page shell"><div className="loading-state"><p>Loading…</p></div></div>
  if (!product) return (
    <div className="storefront-page shell">
      <div className="empty-state">
        <p className="empty-state__icon">📦</p>
        <h2 className="empty-state__title">Product not found</h2>
        <button className="button button--primary" onClick={() => navigate('/')}>Back to store</button>
      </div>
    </div>
  )

  const discount   = getDiscountPercent(product.price, product.mrp)
  const stock      = Number(product.stock || 0)
  const inStock    = stock > 0
  const cat        = product.categories?.name || ''
  const policy     = RETURN_POLICIES.find(p => p.match.test(cat)) || DEFAULT_POLICY
  const svc        = SERVICE_MAP.find(s => s.match.test(cat))

  return (
    <div className="storefront-page shell">
      <button className="text-link" onClick={() => navigate(-1)}>← Back</button>

      <div className="product-detail reveal">
        {/* Image */}
        <div className="product-detail__media">
          {product.image_url
            ? <img className="product-detail__image" src={imgUrl(product.image_url, { width: 800, quality: 85 })} alt={product.name} />
            : <div className="product-detail__placeholder">📦</div>}
          {discount > 0 && <span className="product-detail__badge">{discount}% lower than MRP</span>}
        </div>

        {/* Info */}
        <div className="product-detail__info">
          <p className="eyebrow">{cat || 'Catalog item'}</p>
          <h1 className="product-detail__title">{product.name}</h1>
          <p className="product-detail__brand">{product.brand || '1ShopStore Select'}</p>
          <p className="product-detail__description">{product.description || 'Ready for day-to-day ordering with a clean 1ShopStore shopping experience.'}</p>

          <div className="product-detail__price-row">
            <span className="product-detail__price">{formatCurrency(product.price)}</span>
            {discount > 0 && <span className="product-detail__mrp">{formatCurrency(product.mrp)}</span>}
          </div>

          <p className={`stock-indicator ${inStock ? 'stock-indicator--good' : 'stock-indicator--low'}`}>
            {inStock ? '✓' : '!'} {inStock ? `In stock: ${stock} ${product.unit || 'units'}` : 'Out of stock'}
          </p>

          {/* Pincode check */}
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

          {/* Action buttons */}
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

          {/* Secondary actions */}
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
                else { const ok = compareAdd(product); if (!ok) alert('You can compare up to 3 products at a time.') }
              }}
              title="Compare"
            >
              ⚖️
            </button>
            <button className="btn-icon" onClick={handleShare} title="Share">↗️</button>
          </div>

          {/* Compare tray */}
          {compareCount >= 2 && (
            <div className="compare-tray">
              <span>⚖️ {compareCount} products selected</span>
              <Link to="/compare" className="button button--primary button--sm">Compare →</Link>
            </div>
          )}

          {/* Return policy */}
          <div className="return-policy">
            <p className="return-policy__heading"><span>{policy.icon}</span> {policy.title}</p>
            <ul className="return-policy__list">{policy.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>

          {/* Service combo */}
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

      {/* Frequently Bought Together */}
      {fbt.length > 0 && (
        <section className="fbt-section">
          <h2 className="section-title">🛒 Frequently Bought Together</h2>
          <div className="fbt-row">
            <div className="fbt-card">
              {product.image_url
                ? <img src={imgUrl(product.image_url, { width: 120 })} alt={product.name} className="fbt-card__img" />
                : <div className="fbt-card__placeholder">📦</div>}
              <p className="fbt-card__name">{product.name}</p>
              <p className="fbt-card__price">{formatCurrency(product.price)}</p>
            </div>
            {fbt.map(p => (
              <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="fbt-plus">+</span>
                <Link to={`/product/${p.id}`} className="fbt-card">
                  {p.image_url
                    ? <img src={imgUrl(p.image_url, { width: 120 })} alt={p.name} className="fbt-card__img" />
                    : <div className="fbt-card__placeholder">📦</div>}
                  <p className="fbt-card__name">{p.name}</p>
                  <p className="fbt-card__price">{formatCurrency(p.price)}</p>
                </Link>
              </span>
            ))}
          </div>
          <div className="fbt-footer">
            <span className="fbt-footer__total">
              Bundle: <strong>{formatCurrency(fbt.reduce((s, p) => s + Number(p.price), Number(product.price)))}</strong>
            </span>
            <button className="button button--primary button--sm" onClick={() => { addItem(product); fbt.forEach(p => addItem(p)) }}>
              Add All to Cart
            </button>
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="related-section">
          <h2 className="related-section__title">More from {cat || 'this category'}</h2>
          <div className="product-grid">
            {related.map(p => (
              <ProductCard key={p.id} product={p} onSelect={p => navigate(`/product/${p.id}`)} onAdd={addItem} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
