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
import { trackPurchase } from '../lib/analytics'

// ── Coupon definitions ────────────────────────────────────────────
// type: 'percent' → discount % off subtotal
// type: 'flat'    → fixed ₹ off subtotal
// minOrder: minimum cart subtotal required
const COUPONS = {
  FIRST10:   { type: 'percent', value: 10, minOrder: 0,    label: '10% off your order' },
  SAVE50:    { type: 'flat',    value: 50, minOrder: 500,  label: '₹50 off on orders above ₹500' },
  BULK100:   { type: 'flat',    value: 100,minOrder: 1000, label: '₹100 off on orders above ₹1000' },
  WELCOME:   { type: 'percent', value: 5,  minOrder: 0,    label: '5% welcome discount' },
}

function applyCoupon(code, subtotal) {
  const coupon = COUPONS[code?.trim().toUpperCase()]
  if (!coupon) return { valid: false, error: 'Invalid coupon code.' }
  if (subtotal < coupon.minOrder) {
    return {
      valid: false,
      error: `This coupon needs a minimum order of ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(coupon.minOrder)}.`
    }
  }
  const discount = coupon.type === 'percent'
    ? Math.round(subtotal * coupon.value / 100)
    : coupon.value
  return { valid: true, discount, label: coupon.label }
}

const initialAddressForm = {
  label: 'Site',
  line1: '',
  line2: '',
  city: '',
  pincode: ''
}

const supportsExtendedPaymentColumns = (message = '') =>
  /razorpay_|payment_gateway|paid_at|payment_gateway_payload/i.test(message)

function validateGuestInfo(info) {
  const errs = {}
  if (!info.name.trim()) errs.name = 'Enter your name.'
  const phone = info.phone.replace(/\s/g, '')
  if (!phone || !/^\d{10}$/.test(phone)) errs.phone = 'Enter a valid 10-digit mobile number.'
  if (!info.line1.trim() || info.line1.trim().length < 6) errs.line1 = 'Enter your full address.'
  if (!info.city.trim()) errs.city = 'Enter the city.'
  if (!/^\d{6}$/.test(info.pincode)) errs.pincode = 'Enter a valid 6-digit pincode.'
  return errs
}

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const isGuest = !user

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

  // Guest-only state
  const [guestInfo, setGuestInfo] = useState({
    name: '', phone: '', email: '', line1: '', line2: '', city: '', pincode: ''
  })
  const [guestErrors, setGuestErrors] = useState({})

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null)   // { discount, label } when valid
  const [couponError, setCouponError] = useState('')

  const deliveryCity = isGuest ? guestInfo.city : selectedAddress?.city
  const deliveryCharge = total < 500 ? 50 : 0
  const couponDiscount = coupon?.discount || 0
  const grandTotal = total + deliveryCharge - couponDiscount
  const freeDeliveryGap = Math.max(500 - total, 0)
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0)
  const deliveryEta = getEtaByLocation(deliveryCity)

  const handleApplyCoupon = () => {
    setCouponError('')
    const result = applyCoupon(couponInput, total)
    if (result.valid) {
      setCoupon({ discount: result.discount, label: result.label })
    } else {
      setCoupon(null)
      setCouponError(result.error)
    }
  }

  const handleRemoveCoupon = () => {
    setCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  useEffect(() => {
    if (items.length === 0 && step !== 'success') {
      navigate('/')
      return
    }
    if (user) {
      fetchAddresses()
    }
  }, [items.length, step, navigate, user])

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
        const persistedCurrent = nextAddresses.find(address => address.id === currentAddress.id)
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
    const { error } = await supabase.from('addresses').insert({
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
    setForm(prev => ({
      ...prev,
      [field]: field === 'pincode' ? value.replace(/\D/g, '').slice(0, 6) : value
    }))
    setAddressErrors(prev => ({ ...prev, [field]: '' }))
    setAddressMessage('')
  }

  const setGuestField = (field) => (e) => {
    const value = field === 'pincode'
      ? e.target.value.replace(/\D/g, '').slice(0, 6)
      : field === 'phone'
        ? e.target.value.replace(/\D/g, '').slice(0, 10)
        : e.target.value
    setGuestInfo(prev => ({ ...prev, [field]: value }))
    setGuestErrors(prev => ({ ...prev, [field]: '' }))
    setCheckoutMessage('')
  }

  const handleGuestContinue = () => {
    const errs = validateGuestInfo(guestInfo)
    if (Object.keys(errs).length > 0) {
      setGuestErrors(errs)
      return
    }
    setStep('review')
  }

  const openAddressForm = () => { setShowForm(true); setAddressErrors({}); setAddressMessage('') }
  const closeAddressForm = () => { setShowForm(false); setForm(initialAddressForm); setAddressErrors({}); setAddressMessage('') }

  const ensureCheckoutReady = async () => {
    if (isGuest) return
    const { error: profileError } = await ensureProfile(user)
    if (profileError) {
      throw new Error(profileError.message || 'Could not prepare your account for checkout.')
    }
  }

  const buildOrderInsertPayload = ({ resolvedPaymentMethod, resolvedPaymentStatus, paymentDetails }) => {
    const base = {
      status: 'pending',
      payment_method: resolvedPaymentMethod,
      payment_status: resolvedPaymentStatus,
      subtotal: total,
      delivery_charge: deliveryCharge,
      discount: couponDiscount || null,
      coupon_code: coupon ? couponInput.trim().toUpperCase() : null,
      total: grandTotal
    }

    const payload = isGuest
      ? {
          ...base,
          user_id: null,
          address_id: null,
          guest_name: guestInfo.name.trim(),
          guest_phone: guestInfo.phone.trim(),
          guest_email: guestInfo.email.trim() || null,
          guest_address: {
            line1: guestInfo.line1.trim(),
            line2: guestInfo.line2.trim() || '',
            city: guestInfo.city.trim(),
            pincode: guestInfo.pincode
          }
        }
      : {
          ...base,
          user_id: user.id,
          address_id: selectedAddress.id
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

  const finalizeOrder = async ({ resolvedPaymentMethod, resolvedPaymentStatus, paymentDetails }) => {
    const orderPayload = buildOrderInsertPayload({ resolvedPaymentMethod, resolvedPaymentStatus, paymentDetails })

    let { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderError && supportsExtendedPaymentColumns(orderError.message)) {
      const {
        payment_gateway: _pg, razorpay_order_id: _roi, razorpay_payment_id: _rpi,
        razorpay_signature: _rs, paid_at: _pa, payment_gateway_payload: _pgp,
        ...fallbackPayload
      } = orderPayload

      const retry = await supabase.from('orders').insert(fallbackPayload).select().single()
      order = retry.data
      orderError = retry.error

      if (!orderError && resolvedPaymentMethod === 'razorpay') {
        setCheckoutMessage('Payment succeeded. The order was saved, but the Razorpay tracking columns still need the SQL patch in Supabase.')
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
      await supabase.rpc('decrement_stock', { product_id: item.id, qty: item.qty })
    }

    trackPurchase({ orderId: order.id, total: grandTotal, deliveryCharge, items })
    clearCart()
    setOrderId(order.id)
    setStep('success')
  }

  const handleCashOnDeliveryOrder = async () => {
    await ensureCheckoutReady()
    await finalizeOrder({ resolvedPaymentMethod: 'cod', resolvedPaymentStatus: 'unpaid' })
  }

  const handleRazorpayOrder = async () => {
    await ensureCheckoutReady()

    const Razorpay = await loadRazorpayCheckout()
    const receipt = createRazorpayReceipt()
    const razorpayAmount = Math.round(grandTotal * 100)

    const customerName = isGuest
      ? guestInfo.name
      : (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '1ShopStore Customer')

    const customerEmail = isGuest ? (guestInfo.email || '') : (user?.email || '')
    const customerPhone = isGuest ? guestInfo.phone : (user?.phone || user?.user_metadata?.phone || '')
    const deliveryCity = isGuest ? guestInfo.city : selectedAddress?.city

    const { data } = await createRazorpayOrder({
      amount: razorpayAmount,
      currency: 'INR',
      receipt,
      notes: {
        user_id: isGuest ? 'guest' : user.id,
        address_label: isGuest ? 'Guest' : selectedAddress?.label,
        city: deliveryCity,
        items: `${itemCount}`,
        source: '1shopstore-web'
      }
    })

    if (!data?.order?.id || !data?.key) {
      throw new Error('Could not start Razorpay checkout.')
    }

    await new Promise((resolve, reject) => {
      const paymentWindow = new Razorpay({
        key: data.key,
        amount: data.order.amount,
        currency: data.order.currency,
        name: '1ShopStore',
        description: `Order total ${formatCurrency(grandTotal)}`,
        order_id: data.order.id,
        prefill: { name: customerName, email: customerEmail, contact: customerPhone },
        notes: {
          address_label: isGuest ? 'Guest delivery' : (selectedAddress?.label || 'Delivery address'),
          service_area: deliveryCity || '',
          receipt
        },
        theme: { color: '#2563eb' },
        modal: { ondismiss: () => reject(new Error('Payment was cancelled before completion.')) },
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
        reject(new Error(response?.error?.description || 'Razorpay could not complete the payment.'))
      })
      paymentWindow.open()
    })
  }

  const placeOrder = async () => {
    if (isGuest) {
      const errs = validateGuestInfo(guestInfo)
      if (Object.keys(errs).length > 0) {
        setGuestErrors(errs)
        setCheckoutMessage('Please fix the highlighted fields.')
        return
      }
    } else if (!selectedAddress) {
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
      <div className="order-success-overlay">
        <div className="order-success-modal reveal">
          <div className="order-success-icon">✓</div>
          <h2 className="order-success-title">Order Placed!</h2>
          <p className="order-success-sub">
            Your order has been received and is being processed by our team.
          </p>

          <div className="order-success-id">
            <span>Order ID</span>
            <strong>#{orderId?.slice(0, 8).toUpperCase()}</strong>
          </div>

          <div className="order-success-info">
            <div className="order-success-info-row">
              <span>📦</span>
              <p>You'll receive a confirmation once the store processes your order.</p>
            </div>
            <div className="order-success-info-row">
              <span>🚚</span>
              <p>Track delivery status in real-time from your orders page.</p>
            </div>
          </div>

          {isGuest ? (
            <div className="guest-success-cta">
              <p>Create an account to track this order and check out faster next time.</p>
              <button
                type="button"
                className="button button--primary button--full"
                onClick={() => navigate('/login')}
              >
                Create account
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button button--primary button--full"
              style={{ marginTop: 8 }}
              onClick={() => navigate('/orders')}
            >
              View My Orders
            </button>
          )}

          <button
            type="button"
            className="button button--ghost button--full"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/')}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="checkout-steps">
        <span className={`step-pill ${step === 'address' ? 'step-pill--active' : 'step-pill--complete'}`}>
          1 {isGuest ? 'Your details' : 'Address'}
        </span>
        <span className={`step-pill ${step === 'review' ? 'step-pill--active' : ''}`}>
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
                  <h2 className="card-title">
                    {isGuest ? 'Where should we deliver?' : 'Choose where this order should go'}
                  </h2>
                  {isGuest ? (
                    <p className="card-copy">
                      No account needed. Fill in your details and we'll deliver straight to you.{' '}
                      <button type="button" className="text-link" onClick={() => navigate('/login')}>
                        Sign in
                      </button>{' '}
                      for faster checkout.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="checkout-estimate">
                <p className="eyebrow">{deliveryEta}</p>
                <p>
                  {deliveryCity
                    ? `Delivery estimate based on ${deliveryCity}`
                    : 'Enter your city to see delivery ETA.'}
                </p>
              </div>

              {isGuest ? (
                /* ── Guest address form ─────────────────────────── */
                <div className="form-grid">
                  <div className="form-grid form-grid--split">
                    <label className="field">
                      <span>Full name</span>
                      <input
                        className={`input${guestErrors.name ? ' input--invalid' : ''}`}
                        placeholder="Your name"
                        value={guestInfo.name}
                        onChange={setGuestField('name')}
                        autoComplete="name"
                      />
                      {guestErrors.name ? <span className="field__message field__message--error">{guestErrors.name}</span> : null}
                    </label>

                    <label className="field">
                      <span>Mobile number</span>
                      <input
                        className={`input${guestErrors.phone ? ' input--invalid' : ''}`}
                        placeholder="10-digit number"
                        inputMode="numeric"
                        value={guestInfo.phone}
                        onChange={setGuestField('phone')}
                        autoComplete="tel"
                      />
                      {guestErrors.phone ? <span className="field__message field__message--error">{guestErrors.phone}</span> : null}
                    </label>
                  </div>

                  <label className="field">
                    <span>Email <span style={{ color: 'var(--text-soft)', fontWeight: 400, fontSize: '0.8rem' }}>(optional — for order updates)</span></span>
                    <input
                      className="input"
                      placeholder="you@example.com"
                      type="email"
                      value={guestInfo.email}
                      onChange={setGuestField('email')}
                      autoComplete="email"
                    />
                  </label>

                  <label className="field">
                    <span>Address line 1</span>
                    <input
                      className={`input${guestErrors.line1 ? ' input--invalid' : ''}`}
                      placeholder="Street, building, landmark"
                      value={guestInfo.line1}
                      onChange={setGuestField('line1')}
                      autoComplete="address-line1"
                    />
                    {guestErrors.line1 ? <span className="field__message field__message--error">{guestErrors.line1}</span> : null}
                  </label>

                  <label className="field">
                    <span>Address line 2 <span style={{ color: 'var(--text-soft)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></span>
                    <input
                      className="input"
                      placeholder="Floor, wing, flat number"
                      value={guestInfo.line2}
                      onChange={setGuestField('line2')}
                      autoComplete="address-line2"
                    />
                  </label>

                  <div className="form-grid form-grid--split">
                    <label className="field">
                      <span>City</span>
                      <input
                        className={`input${guestErrors.city ? ' input--invalid' : ''}`}
                        placeholder="City"
                        value={guestInfo.city}
                        onChange={setGuestField('city')}
                        autoComplete="address-level2"
                      />
                      {guestErrors.city ? <span className="field__message field__message--error">{guestErrors.city}</span> : null}
                    </label>

                    <label className="field">
                      <span>Pincode</span>
                      <input
                        className={`input${guestErrors.pincode ? ' input--invalid' : ''}`}
                        placeholder="6-digit pincode"
                        inputMode="numeric"
                        value={guestInfo.pincode}
                        onChange={setGuestField('pincode')}
                        autoComplete="postal-code"
                      />
                      {guestErrors.pincode ? <span className="field__message field__message--error">{guestErrors.pincode}</span> : null}
                    </label>
                  </div>

                  <button
                    type="button"
                    className="button button--primary button--full"
                    onClick={handleGuestContinue}
                  >
                    Continue to review
                  </button>
                </div>
              ) : (
                /* ── Logged-in: saved addresses ─────────────────── */
                <>
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
                            <span className="field__message field__message--error">{addressErrors.line1}</span>
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
                            <span className="field__message field__message--error">{addressErrors.line2}</span>
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
                              <span className="field__message field__message--error">{addressErrors.city}</span>
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
                              <span className="field__message field__message--error">{addressErrors.pincode}</span>
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
                </>
              )}
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

            {coupon ? (
              <div className="order-line coupon-applied-row">
                <span>Coupon ({couponInput.toUpperCase()})</span>
                <span className="coupon-discount">−{formatCurrency(couponDiscount)}</span>
              </div>
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
                  <h2 className="card-title">
                    {isGuest ? guestInfo.name : selectedAddress?.label}
                  </h2>
                </div>
                <button type="button" className="text-link" onClick={() => setStep('address')}>
                  Change
                </button>
              </div>
              {isGuest ? (
                <p className="summary-text">
                  {guestInfo.line1}
                  {guestInfo.line2 ? `, ${guestInfo.line2}` : ''}
                  <br />
                  {guestInfo.city} · {guestInfo.pincode}
                  <br />
                  <span style={{ color: 'var(--text-soft)' }}>{guestInfo.phone}</span>
                </p>
              ) : (
                <p className="summary-text">
                  {selectedAddress?.line1}
                  {selectedAddress?.line2 ? `, ${selectedAddress.line2}` : ''}
                  <br />
                  {selectedAddress?.city} · {selectedAddress?.pincode}
                </p>
              )}
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
                  { value: 'cod', icon: '💵', label: 'Cash on delivery', detail: 'Pay when the order reaches you' },
                  { value: 'razorpay', icon: '📱', label: 'Razorpay / UPI / cards', detail: 'Pay securely before the order is placed' }
                ].map(method => (
                  <button
                    key={method.value}
                    type="button"
                    className={`payment-card ${paymentMethod === method.value ? 'payment-card--active' : ''}`}
                    onClick={() => { setPaymentMethod(method.value); setCheckoutMessage('') }}
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

            {/* ── Coupon input ── */}
            {!coupon ? (
              <div className="coupon-row">
                <input
                  className="input coupon-input"
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button
                  type="button"
                  className="button button--secondary coupon-btn"
                  onClick={handleApplyCoupon}
                  disabled={!couponInput.trim()}
                >
                  Apply
                </button>
              </div>
            ) : (
              <div className="coupon-applied">
                <div className="coupon-applied__info">
                  <span className="coupon-applied__tag">🏷 {couponInput.toUpperCase()}</span>
                  <span className="coupon-applied__label">{coupon.label}</span>
                </div>
                <button type="button" className="coupon-applied__remove" onClick={handleRemoveCoupon}>✕</button>
              </div>
            )}
            {couponError ? <p className="coupon-error">{couponError}</p> : null}

            {coupon ? (
              <div className="bill-row coupon-applied-row">
                <span>Discount</span>
                <span className="coupon-discount">−{formatCurrency(couponDiscount)}</span>
              </div>
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
                  ? paymentMethod === 'cod' ? 'Placing order...' : 'Opening Razorpay...'
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
