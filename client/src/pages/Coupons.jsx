import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { COUPONS_LIST } from '../lib/coupons'
import { formatCurrency } from '../lib/storefront'

function CouponCard({ coupon, cartTotal, onApply }) {
  const [copied, setCopied] = useState(false)
  const eligible = cartTotal >= coupon.minOrder
  const saving = coupon.type === 'percent'
    ? cartTotal > 0 ? Math.round(cartTotal * coupon.value / 100) : null
    : coupon.value

  const copy = () => {
    navigator.clipboard.writeText(coupon.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`coupon-card ${!eligible ? 'coupon-card--dim' : ''}`}>
      <div className="coupon-card__stripe" style={{ background: eligible ? 'var(--accent)' : '#d1d5db' }} />
      <div className="coupon-card__body">
        <div className="coupon-card__top">
          <span className="coupon-card__icon">{coupon.icon}</span>
          <div style={{ flex: 1 }}>
            <p className="coupon-card__code">{coupon.code}</p>
            <p className="coupon-card__label">{coupon.label}</p>
          </div>
          {eligible && saving && (
            <span className="coupon-card__saving">
              Save {coupon.type === 'percent' ? `${coupon.value}%` : formatCurrency(coupon.value)}
            </span>
          )}
        </div>
        <p className="coupon-card__desc">{coupon.desc}</p>
        {!eligible && cartTotal > 0 && (
          <p className="coupon-card__need">
            Add {formatCurrency(coupon.minOrder - cartTotal)} more to unlock this coupon
          </p>
        )}
        <div className="coupon-card__actions">
          <button className="button button--secondary button--sm" onClick={copy}>
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
          {eligible && onApply && (
            <button className="button button--primary button--sm" onClick={() => onApply(coupon.code)}>
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Coupons() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cartTotal = Number(params.get('cartTotal') || 0)

  const handleApply = (code) => {
    navigate(`/checkout?coupon=${code}`)
  }

  return (
    <div className="storefront-page shell">
      <div className="coupons-hero">
        <span style={{ fontSize: 48 }}>🏷️</span>
        <h1 className="coupons-hero__title">Coupons & Offers</h1>
        {cartTotal > 0 && (
          <p className="coupons-hero__sub">Cart total: {formatCurrency(cartTotal)}</p>
        )}
      </div>

      <div className="coupons-grid">
        {COUPONS_LIST.map(c => (
          <CouponCard
            key={c.code}
            coupon={c}
            cartTotal={cartTotal}
            onApply={cartTotal > 0 ? handleApply : null}
          />
        ))}
      </div>
    </div>
  )
}
