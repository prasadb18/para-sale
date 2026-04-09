// GTM container: GTM-5W9GQDMV
// Events are pushed to window.dataLayer — GTM forwards them to GA4.

function push(obj) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(obj)
}

// Called once on app mount — ensures dataLayer exists before GTM fires.
export function initAnalytics() {
  window.dataLayer = window.dataLayer || []
}

// Manual page view (useful for SPA route changes).
// GTM's History Change trigger also fires this automatically if configured.
export function trackPageView(path) {
  push({ event: 'page_view', page_path: path })
}

// GA4 ecommerce: add_to_cart
export function trackAddToCart(product, qty = 1) {
  push({ ecommerce: null }) // clear previous ecommerce object
  push({
    event: 'add_to_cart',
    ecommerce: {
      currency: 'INR',
      value: Number(product.price || 0) * qty,
      items: [{
        item_id: String(product.id),
        item_name: product.name,
        item_brand: product.brand || '',
        item_category: product.categories?.name || '',
        price: Number(product.price || 0),
        quantity: qty
      }]
    }
  })
}

// GA4 ecommerce: purchase
export function trackPurchase({ orderId, total, deliveryCharge, items }) {
  push({ ecommerce: null })
  push({
    event: 'purchase',
    ecommerce: {
      transaction_id: orderId,
      value: total,
      currency: 'INR',
      shipping: deliveryCharge || 0,
      items: items.map(item => ({
        item_id: String(item.id),
        item_name: item.name,
        item_brand: item.brand || '',
        price: Number(item.price || 0),
        quantity: Number(item.qty || 1)
      }))
    }
  })
}
