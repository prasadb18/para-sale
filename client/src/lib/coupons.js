export const COUPONS_LIST = [
  { code: 'FIRST10', type: 'percent', value: 10, minOrder: 0,    label: '10% off your order',            desc: 'Get 10% off on your first order. No minimum order value.', icon: '🎉' },
  { code: 'SAVE50',  type: 'flat',    value: 50, minOrder: 500,  label: '₹50 off on orders above ₹500',  desc: 'Save ₹50 on orders worth ₹500 or more.',                 icon: '💰' },
  { code: 'BULK100', type: 'flat',    value: 100,minOrder: 1000, label: '₹100 off on orders above ₹1000',desc: 'Save ₹100 on large orders worth ₹1000 or more.',          icon: '🏗️' },
  { code: 'WELCOME', type: 'percent', value: 5,  minOrder: 0,    label: '5% welcome discount',           desc: 'A small thank-you for joining 1ShopStore.',              icon: '👋' },
]

export const COUPONS_MAP = Object.fromEntries(
  COUPONS_LIST.map(c => [c.code, { type: c.type, value: c.value, minOrder: c.minOrder, label: c.label }])
)

export function applyCoupon(code, subtotal) {
  const c = COUPONS_MAP[code?.trim().toUpperCase()]
  if (!c) return { valid: false, error: 'Invalid coupon code.' }
  if (subtotal < c.minOrder) return { valid: false, error: `Minimum order ₹${c.minOrder} required.` }
  const discount = c.type === 'percent' ? Math.round(subtotal * c.value / 100) : c.value
  return { valid: true, discount, label: c.label }
}
