import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import useCartStore from '../store/cartStore'

export default function CartNotice() {
  const notice = useCartStore(s => s.notice)
  const clearNotice = useCartStore(s => s.clearNotice)

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => {
      clearNotice()
    }, 9000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [clearNotice, notice])

  if (!notice) return null

  return (
    <aside className="cart-notice" role="status" aria-live="polite">
      <div className="cart-notice__copy">
        <strong>{notice.name} added to cart</strong>
        <span>
          {notice.productQty} of this item in cart · {notice.count} total
          item{notice.count === 1 ? '' : 's'}
        </span>
      </div>

      <Link to="/cart" className="cart-notice__link" onClick={clearNotice}>
        View cart
      </Link>
    </aside>
  )
}
