import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../lib/storefront'
import useCartStore from '../store/cartStore'

export default function Cart() {
  const { items, updateQty, removeItem, total } = useCartStore()
  const navigate = useNavigate()
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0)
  const deliveryCharge = total >= 500 ? 0 : 50
  const grandTotal = total + deliveryCharge

  if (items.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">🛒</p>
          <h2 className="empty-state__title">Your cart is empty</h2>
          <p>Add a few products to see the refreshed 1ShopStore cart in action.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate('/')}
          >
            Shop now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Cart</p>
          <h1 className="section-title">Review your selected items</h1>
          <p className="section-copy">
            Adjust quantities, compare totals, and head into checkout when
            you’re ready.
          </p>
        </div>
      </div>

      <div className="cart-layout">
        <section className="cart-list">
          {items.map(item => (
            <article key={item.id} className="cart-row reveal">
              {item.image_url ? (
                <img
                  className="cart-row__image"
                  src={item.image_url}
                  alt={item.name}
                />
              ) : (
                <div className="cart-row__placeholder">📦</div>
              )}

              <div className="cart-row__summary">
                <h2>{item.name}</h2>
                <p>{item.brand || '1ShopStore Select'}</p>
                <div className="cart-row__pricing">
                  <span>{formatCurrency(item.price)} each</span>
                  <span>Line total {formatCurrency(item.price * item.qty)}</span>
                </div>
              </div>

              <div className="cart-row__controls">
                <div className="qty-control">
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, item.qty - 1)}
                  >
                    −
                  </button>
                  <span className="qty-value">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, item.qty + 1)}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="remove-link"
                  onClick={() => removeItem(item.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="order-card">
          <p className="eyebrow">Summary</p>
          <h2 className="order-card__title">
            {itemCount} item{itemCount === 1 ? '' : 's'} ready
          </h2>

          <div className="order-line">
            <span>Subtotal</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="order-line">
            <span>Delivery</span>
            <span>{deliveryCharge === 0 ? 'Free' : formatCurrency(deliveryCharge)}</span>
          </div>
          {deliveryCharge > 0 ? (
            <p className="summary-note">
              Add {formatCurrency(500 - total)} more to unlock free delivery.
            </p>
          ) : null}

          <div className="order-total">
            <span>Total</span>
            <strong>{formatCurrency(grandTotal)}</strong>
          </div>

          <div className="stack-actions">
            <button
              type="button"
              className="button button--primary button--full"
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </button>
            <button
              type="button"
              className="button button--secondary button--full"
              onClick={() => navigate('/')}
            >
              Continue shopping
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
