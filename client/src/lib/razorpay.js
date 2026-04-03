let razorpayCheckoutPromise

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in the browser.'))
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay)
  }

  if (!razorpayCheckoutPromise) {
    razorpayCheckoutPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-razorpay-checkout="true"]'
      )

      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.Razorpay) resolve(window.Razorpay)
        })
        existingScript.addEventListener('error', () => {
          reject(new Error('Could not load Razorpay checkout.'))
        })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.dataset.razorpayCheckout = 'true'

      script.onload = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay)
        } else {
          reject(new Error('Razorpay checkout did not initialize.'))
        }
      }

      script.onerror = () => {
        reject(new Error('Could not load Razorpay checkout.'))
      }

      document.head.appendChild(script)
    }).catch((error) => {
      razorpayCheckoutPromise = null
      throw error
    })
  }

  return razorpayCheckoutPromise
}

export function createRazorpayReceipt() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)

  return `psl_${timestamp}_${random}`.slice(0, 40)
}
