import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRazorpayOrder, verifyRazorpayPayment } from '../api'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import { createRazorpayReceipt, loadRazorpayCheckout } from '../lib/razorpay'
import { formatCurrency, getEtaByLocation } from '../lib/storefront'
import { supabase } from '../lib/supabase'
import { validateAddressForm } from '../lib/validation'
import { ensureProfile } from '../lib/profile'

const initialAddressForm = {
  label: 'Site',
  line1: '',
  line2: '',
  city: '',
  pincode: ''
}

const supportsExtendedPaymentColumns = (message = '') =>
  /razorpay_|payment_gateway|paid_at|payment_gateway_payload/i.test(message)

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState('address')
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressErrors, setAddressErrors] = useState({})
  const [addressMessage, setAddressMessage] = useState('')
  const [form, setForm] = useState(initialAddressForm)

  const deliveryCharge = total < 500 ? 50 : 0
  const grandTotal = total + deliveryCharge
  const freeDeliveryGap = Math.max(500 - total, 0)
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0)
  const deliveryEta = getEtaByLocation(selectedAddress?.city)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    if (items.length === 0) {
      navigate('/')
      return
    }

    fetchAddresses()
  }, [items.length, navigate, user])

  const fetchAddresses = async (preferredAddress = null) => {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })

    if (error) {
      setAddressMessage(error.message || 'Could not load saved addresses.')
      return
    }

    const nextAddresses = data || []
    setAddresses(nextAddresses)
    setAddressMessage('')
    setSelectedAddress((currentAddress) => {
      if (preferredAddress) {
        const match = nextAddresses.find(address =>
          address.label === preferredAddress.label &&
          address.line1 === preferredAddress.line1 &&
          (address.line2 || '') === (preferredAddress.line2 || '') &&
          address.city === preferredAddress.city &&
          String(address.pincode || '') === preferredAddress.pincode
        )

        if (match) return match
      }

      if (currentAddress) {
        const persistedCurrent = nextAddresses.find(
          address => address.id === currentAddress.id
        )

        if (persistedCurrent) return persistedCurrent
      }

      return nextAddresses[0] || null
    })
  }

  const saveAddress = async () => {
    const { errors, sanitizedForm } = validateAddressForm(form)

    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors)
      setAddressMessage('Please fix the highlighted address fields.')
      return
    }

    setSavingAddress(true)
    setAddressErrors({})
    setAddressMessage('')

    const { error: profileError } = await ensureProfile(user)

    if (profileError) {
      setAddressMessage(profileError.message || 'Could not prepare your account for saved addresses.')
      setSavingAddress(false)
      return
    }

    const { error } = await supabase
      .from('addresses')
      .insert({
        ...sanitizedForm,
        user_id: user.id,
        is_default: addresses.length === 0
      })

    if (error) {
      setAddressMessage(error.message || 'Could not save this address.')
      setSavingAddress(false)
      return
    }

    await fetchAddresses(sanitizedForm)
    setShowForm(false)
    setForm(initialAddressForm)
    setSavingAddress(false)
  }

  const handleAddressFieldChange = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: field === 'pincode' ? value.replace(/\D/g, '').slice(0, 6) : value
    }))
    setAddressErrors((currentErrors) => ({
      ...currentErrors,
      [field]: ''
    }))
    setAddressMessage('')
  }

  const openAddressForm = () => {
    setShowForm(true)
    setAddressErrors({})
    setAddressMessage('')
  }

  const closeAddressForm = () => {
    setShowForm(false)
    setForm(initialAddressForm)
    setAddressErrors({})
    setAddressMessage('')
  }

  const ensureCheckoutReady = async () => {
    const { error: profileError } = await ensureProfile(user)

    if (profileError) {
      throw new Error(
        profileError.message || 'Could not prepare your account for checkout.'
      )
    }
  }

  const buildOrderInsertPayload = ({
    resolvedPaymentMethod,
    resolvedPaymentStatus,
    paymentDetails
  }) => {
    const payload = {
      user_id: user.id,
      address_id: selectedAddress.id,
      status: 'pending',
      payment_method: resolvedPaymentMethod,
      payment_status: resolvedPaymentStatus,
      subtotal: total,
      delivery_charge: deliveryCharge,
      total: grandTotal
    }

    if (paymentDetails?.gateway === 'razorpay') {
      payload.payment_gateway = 'razorpay'
      payload.razorpay_order_id = paymentDetails.razorpayOrderId || null
      payload.razorpay_payment_id = paymentDetails.razorpayPaymentId || null
      payload.razorpay_signature = paymentDetails.razorpaySignature || null
      payload.paid_at = resolvedPaymentStatus === 'paid' ? new Date().toISOString() : null
      payload.payment_gateway_payload = {
        receipt: paymentDetails.receipt || null,
        amount: paymentDetails.amount || null,
        currency: paymentDetails.currency || 'INR'
      }
    }

    return payload
  }

  const finalizeOrder = async ({
    resolvedPaymentMethod,
    resolvedPaymentStatus,
    paymentDetails
  }) => {
    const orderPayload = buildOrderInsertPayload({
      resolvedPaymentMethod,
      resolvedPaymentStatus,
      paymentDetails
    })

    let { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderError && supportsExtendedPaymentColumns(orderError.message)) {
      const {
        payment_gateway: _paymentGateway,
        razorpay_order_id: _razorpayOrderId,
        razorpay_payment_id: _razorpayPaymentId,
        razorpay_signature: _razorpaySignature,
        paid_at: _paidAt,
        payment_gateway_payload: _paymentGatewayPayload,
        ...fallbackPayload
      } = orderPayload

      const retry = await supabase
        .from('orders')
        .insert(fallbackPayload)
        .select()
        .single()

      order = retry.data
      orderError = retry.error

      if (!orderError && resolvedPaymentMethod === 'razorpay') {
        setCheckoutMessage(
          'Payment succeeded. The order was saved, but the Razorpay tracking columns still need the SQL patch in Supabase.'
        )
      }
    }

    if (orderError) {
      throw new Error(orderError.message || 'Something went wrong. Please try again.')
    }

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.qty,
      price_at_order: item.price
    }))

    await supabase.from('order_items').insert(orderItems)

    for (const item of items) {
      await supabase.rpc('decrement_stock', {
        product_id: item.id,
        qty: item.qty
      })
    }

    clearCart()
    setOrderId(order.id)
    setStep('success')
  }

  const handleCashOnDeliveryOrder = async () => {
    await ensureCheckoutReady()
    await finalizeOrder({
      resolvedPaymentMethod: 'cod',
      resolvedPaymentStatus: 'unpaid'
    })
  }

  const handleRazorpayOrder = async () => {
    await ensureCheckoutReady()

    const Razorpay = await loadRazorpayCheckout()
    const receipt = createRazorpayReceipt()
    const razorpayAmount = Math.round(grandTotal * 100)

    const { data } = await createRazorpayOrder({
      amount: razorpayAmount,
      currency: 'INR',
      receipt,
      notes: {
        user_id: user.id,
        address_label: selectedAddress?.label,
        city: selectedAddress?.city,
        items: `${itemCount}`,
        source: '1shopstore-web'
      }
    })

    if (!data?.order?.id || !data?.key) {
      throw new Error('Could not start Razorpay checkout.')
    }

    const customerName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      '1ShopStore Customer'

    await new Promise((resolve, reject) => {
      const paymentWindow = new Razorpay({
        key: data.key,
        amount: data.order.amount,
        currency: data.order.currency,
        name: '1ShopStore',
        description: `Order total ${formatCurrency(grandTotal)}`,
        order_id: data.order.id,
        prefill: {
          name: customerName,
          email: user?.email || '',
          contact: user?.phone || user?.user_metadata?.phone || ''
        },
        notes: {
          address_label: selectedAddress?.label || 'Delivery address',
          service_area: selectedAddress?.city || '',
          receipt
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment was cancelled before completion.'))
          }
        },
        handler: async (response) => {
          try {
            await verifyRazorpayPayment({
              orderId: data.order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })

            await finalizeOrder({
              resolvedPaymentMethod: 'razorpay',
              resolvedPaymentStatus: 'paid',
              paymentDetails: {
                gateway: 'razorpay',
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                receipt,
                amount: data.order.amount,
                currency: data.order.currency
              }
            })

            resolve()
          } catch (error) {
            reject(error)
          }
        }
      })

      paymentWindow.on('payment.failed', (response) => {
        reject(
          new Error(
            response?.error?.description || 'Razorpay could not complete the payment.'
          )
        )
      })

      paymentWindow.open()
    })
  }

  const placeOrder = async () => {
    if (!selectedAddress) {
      setCheckoutMessage('Please select a delivery address before placing the order.')
      return
    }

    setLoading(true)
    setCheckoutMessage('')

    try {
      if (paymentMethod === 'cod') {
        await handleCashOnDeliveryOrder()
      } else {
        await handleRazorpayOrder()
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Something went wrong while placing your order.'

      setCheckoutMessage(message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="storefront-page shell success-shell">
        <div className="success-panel reveal">
          <span className="success-panel__badge">✓ Order placed</span>
          <h1>Order received</h1>
          <p>
            Your order is now in the queue. The store team can confirm and
            process it from the admin side shortly.
          </p>

          <div className="success-panel__order">
            Order ID <strong>{orderId?.slice(0, 8).toUpperCase()}</strong>
          </div>

          <div className="stack-actions">
            <button
              type="button"
              className="button button--primary button--full"
              onClick={() => navigate('/orders')}
            >
              View my orders
            </button>
            <button
              type="button"
              className="button button--secondary button--full"
              onClick={() => navigate('/')}
            >
              Continue shopping
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="checkout-steps">
        <span
          className={`step-pill ${step === 'address' ? 'step-pill--active' : 'step-pill--complete'}`}
        >
          1 Address
        </span>
        <span
          className={`step-pill ${step === 'review' ? 'step-pill--active' : ''}`}
        >
          2 Review & Pay
        </span>
      </div>

      {step === 'address' ? (
        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-card">
              <div className="section-header section-header--compact">
                <div>
                  <p className="eyebrow">Delivery</p>
                  <h2 className="card-title">Choose where this order should go</h2>
                  <p className="card-copy">
                    Saved addresses make checkout feel much closer to a modern
                    shopping app flow.
                  </p>
                </div>
              </div>

              <div className="checkout-estimate">
                <p className="eyebrow">{deliveryEta}</p>
                <p>{selectedAddress ? `Delivery estimate based on ${selectedAddress.city}` : 'Select your address to show delivery ETA.'}</p>
              </div>

              <div className="address-list">
                {addresses.map(address => (
                  <button
                    key={address.id}
                    type="button"
                    className={`address-card ${selectedAddress?.id === address.id ? 'address-card--active' : ''}`}
                    onClick={() => setSelectedAddress(address)}
                  >
                    <div className="address-card__top">
                      <span className="address-tag">{address.label}</span>
                      {selectedAddress?.id === address.id ? (
                        <span className="selected-mark">Selected</span>
                      ) : null}
                    </div>
                    <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
                    <p>{address.city} · {address.pincode}</p>
                  </button>
                ))}
              </div>

              {addressMessage ? <p className="error-banner">{addressMessage}</p> : null}

              {!showForm ? (
                <button
                  type="button"
                  className="button button--secondary button--full"
                  onClick={openAddressForm}
                >
                  + Add a new address
                </button>
              ) : (
                <section className="checkout-card">
                  <p className="eyebrow">New address</p>
                  <div className="form-grid">
                    <label className="field">
                      <span>Label</span>
                      <select
                        className="input"
                        value={form.label}
                        onChange={e => handleAddressFieldChange('label', e.target.value)}
                      >
                        <option>Site</option>
                        <option>Home</option>
                        <option>Office</option>
                        <option>Warehouse</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Address line 1</span>
                      <input
                        className={`input${addressErrors.line1 ? ' input--invalid' : ''}`}
                        placeholder="Street, block, landmark"
                        autoComplete="address-line1"
                        maxLength={120}
                        value={form.line1}
                        onChange={e => handleAddressFieldChange('line1', e.target.value)}
                      />
                      {addressErrors.line1 ? (
                        <span className="field__message field__message--error">
                          {addressErrors.line1}
                        </span>
                      ) : null}
                    </label>

                    <label className="field">
                      <span>Address line 2</span>
                      <input
                        className={`input${addressErrors.line2 ? ' input--invalid' : ''}`}
                        placeholder="Optional extra details"
                        autoComplete="address-line2"
                        maxLength={120}
                        value={form.line2}
                        onChange={e => handleAddressFieldChange('line2', e.target.value)}
                      />
                      {addressErrors.line2 ? (
                        <span className="field__message field__message--error">
                          {addressErrors.line2}
                        </span>
                      ) : null}
                    </label>

                    <div className="form-grid form-grid--split">
                      <label className="field">
                        <span>City</span>
                        <input
                          className={`input${addressErrors.city ? ' input--invalid' : ''}`}
                          placeholder="City"
                          autoComplete="address-level2"
                          maxLength={60}
                          value={form.city}
                          onChange={e => handleAddressFieldChange('city', e.target.value)}
                        />
                        {addressErrors.city ? (
                          <span className="field__message field__message--error">
                            {addressErrors.city}
                          </span>
                        ) : null}
                      </label>

                      <label className="field">
                        <span>Pincode</span>
                        <input
                          className={`input${addressErrors.pincode ? ' input--invalid' : ''}`}
                          placeholder="Pincode"
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="postal-code"
                          value={form.pincode}
                          onChange={e => handleAddressFieldChange('pincode', e.target.value)}
                        />
                        {addressErrors.pincode ? (
                          <span className="field__message field__message--error">
                            {addressErrors.pincode}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  </div>

                  <div className="stack-actions">
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={saveAddress}
                      disabled={savingAddress}
                    >
                      {savingAddress ? 'Saving address...' : 'Save address'}
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={closeAddressForm}
                      disabled={savingAddress}
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              {selectedAddress ? (
                <button
                  type="button"
                  className="button button--primary button--full"
                  onClick={() => setStep('review')}
                >
                  Continue to review
                </button>
              ) : null}
            </section>
          </div>

          <aside className="order-card">
            <p className="eyebrow">Checkout summary</p>
            <h2 className="order-card__title">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </h2>

            <div className="line-item-list">
              {items.map(item => (
                <div key={item.id} className="line-item">
                  <span><strong>{item.name}</strong></span>
                  <span>x{item.qty}</span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="order-line">
              <span>Subtotal</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="order-line">
              <span>Delivery</span>
              <span>{deliveryCharge === 0 ? 'Free' : formatCurrency(deliveryCharge)}</span>
            </div>

            {freeDeliveryGap > 0 ? (
              <p className="summary-note">
                Add {formatCurrency(freeDeliveryGap)} more for free delivery.
              </p>
            ) : null}

            <div className="order-total">
              <span>Total</span>
              <strong>{formatCurrency(grandTotal)}</strong>
            </div>
          </aside>
        </div>
      ) : (
        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-card">
              <div className="summary-row">
                <div>
                  <p className="eyebrow">Deliver to</p>
                  <h2 className="card-title">{selectedAddress?.label}</h2>
                </div>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setStep('address')}
                >
                  Change
                </button>
              </div>
              <p className="summary-text">
                {selectedAddress?.line1}
                {selectedAddress?.line2 ? `, ${selectedAddress.line2}` : ''}
                <br />
                {selectedAddress?.city} · {selectedAddress?.pincode}
              </p>
            </section>

            <section className="checkout-card">
              <p className="eyebrow">Items</p>
              <div className="line-item-list">
                {items.map(item => (
                  <div key={item.id} className="line-item">
                    <span><strong>{item.name}</strong></span>
                    <span>x{item.qty}</span>
                    <span>{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="checkout-card">
              <p className="eyebrow">Payment method</p>
              <div className="payment-grid">
                {[
                  {
                    value: 'cod',
                    icon: '💵',
                    label: 'Cash on delivery',
                    detail: 'Pay when the order reaches you'
                  },
                  {
                    value: 'razorpay',
                    icon: '📱',
                    label: 'Razorpay / UPI / cards',
                    detail: 'Pay securely before the order is placed'
                  }
                ].map(method => (
                  <button
                    key={method.value}
                    type="button"
                    className={`payment-card ${paymentMethod === method.value ? 'payment-card--active' : ''}`}
                    onClick={() => {
                      setPaymentMethod(method.value)
                      setCheckoutMessage('')
                    }}
                  >
                    <span>{method.icon}</span>
                    <strong>{method.label}</strong>
                    <small>{method.detail}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="bill-card">
            <p className="eyebrow">Amount payable</p>

            <div className="bill-row">
              <span>Subtotal</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="bill-row">
              <span>Delivery</span>
              <span>{deliveryCharge === 0 ? 'Free' : formatCurrency(deliveryCharge)}</span>
            </div>

            {freeDeliveryGap > 0 ? (
              <p className="summary-note">
                Add {formatCurrency(freeDeliveryGap)} more for free delivery.
              </p>
            ) : null}

            <div className="bill-total">
              <span>Total</span>
              <strong>{formatCurrency(grandTotal)}</strong>
            </div>

            {checkoutMessage ? <p className="error-banner">{checkoutMessage}</p> : null}

            <div className="stack-actions">
              <button
                type="button"
                className="button button--primary button--full"
                onClick={placeOrder}
                disabled={loading}
              >
                {loading
                  ? paymentMethod === 'cod'
                    ? 'Placing order...'
                    : 'Opening Razorpay...'
                  : paymentMethod === 'cod'
                    ? `Place order · ${formatCurrency(grandTotal)}`
                    : `Pay with Razorpay · ${formatCurrency(grandTotal)}`}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
