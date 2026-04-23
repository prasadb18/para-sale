import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as StoreReview from 'expo-store-review'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import useGuestStore from '../store/guestStore'
import { formatCurrency } from '../lib/currency'
import { supabase } from '../lib/supabase'
import { createRazorpayOrder, verifyRazorpayPayment } from '../api'
import DeliveryEstimate from '../components/DeliveryEstimate'

async function maybeRequestReview(userId: string) {
  const available = await StoreReview.isAvailableAsync()
  if (!available) return
  const asked = await AsyncStorage.getItem('review_asked')
  if (asked) return
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) < 2) return
  setTimeout(async () => {
    await StoreReview.requestReview()
    await AsyncStorage.setItem('review_asked', '1')
  }, 1500)
}

interface SavedAddress {
  id: string
  label: string
  full_name: string
  phone: string
  line1: string
  line2?: string
  city: string
  pincode: string
  is_default: boolean
}

// react-native-razorpay is not bundled in Expo Go — load lazily to avoid crash
let RazorpayCheckout: any = null
try { RazorpayCheckout = require('react-native-razorpay').default } catch {}

const COUPONS: Record<string, { type: 'percent' | 'flat'; value: number; minOrder: number; label: string }> = {
  FIRST10: { type: 'percent', value: 10, minOrder: 0,    label: '10% off your order' },
  SAVE50:  { type: 'flat',    value: 50, minOrder: 500,  label: '₹50 off on orders above ₹500' },
  BULK100: { type: 'flat',    value: 100,minOrder: 1000, label: '₹100 off on orders above ₹1000' },
  WELCOME: { type: 'percent', value: 5,  minOrder: 0,    label: '5% welcome discount' },
}

const SVC_LABEL: Record<string, string> = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }

type PaymentMethod = 'cod' | 'razorpay'

// ── Payment method card ───────────────────────────────────────────────────────
function PayMethodCard({
  selected, method, icon, title, sub, onPress,
}: {
  selected: boolean
  method: PaymentMethod
  icon: string
  title: string
  sub: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[pm.card, selected && pm.cardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[pm.radio, selected && pm.radioActive]}>
        {selected && <View style={pm.radioDot} />}
      </View>
      <Text style={pm.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[pm.title, selected && pm.titleActive]}>{title}</Text>
        <Text style={pm.sub}>{sub}</Text>
      </View>
      {selected && method === 'razorpay' && (
        <View style={pm.rzpBadge}>
          <Text style={pm.rzpBadgeText}>Secure</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const pm = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 14, marginBottom: 10, backgroundColor: '#f9fafb',
  },
  cardActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: '#2563eb' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  icon: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  titleActive: { color: '#1d4ed8' },
  sub: { fontSize: 12, color: '#9ca3af' },
  rzpBadge: {
    backgroundColor: '#dcfce7', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  rzpBadgeText: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const navigation  = useNavigation()
  const insets      = useSafeAreaInsets()
  const { items, total, clearCart, serviceBookings, clearServiceBookings } = useCartStore()
  const { user }               = useAuthStore()
  const { name: gName, phone: gPhone, isGuest, clear: clearGuest } = useGuestStore()

  // Saved addresses
  const [savedAddresses,   setSavedAddresses]   = useState<SavedAddress[]>([])
  const [selectedAddrId,   setSelectedAddrId]   = useState<string | null>(null)
  const [saveAddress,      setSaveAddress]      = useState(false)
  const [addrLabel,        setAddrLabel]        = useState('Home')

  // Address fields
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [line1,   setLine1]   = useState('')
  const [line2,   setLine2]   = useState('')
  const [city,    setCity]    = useState('')
  const [pincode, setPincode] = useState('')

  // Pre-fill from guest store if checking out as guest
  useEffect(() => {
    if (!user && isGuest) {
      setName(gName)
      setPhone(gPhone)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load saved addresses + profile name/phone for logged-in users
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).single(),
    ]).then(([addrRes, profileRes]) => {
      const addresses = (addrRes.data as SavedAddress[]) ?? []
      setSavedAddresses(addresses)
      const defaultAddr = addresses.find(a => a.is_default) ?? addresses[0]
      if (defaultAddr) {
        applyAddress(defaultAddr)
        setSelectedAddrId(defaultAddr.id)
      } else if (profileRes.data) {
        setName(profileRes.data.full_name ?? '')
        setPhone(profileRes.data.phone ?? '')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const applyAddress = (addr: SavedAddress) => {
    setName(addr.full_name)
    setPhone(addr.phone)
    setLine1(addr.line1)
    setLine2(addr.line2 ?? '')
    setCity(addr.city)
    setPincode(addr.pincode)
  }

  const selectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddrId(addr.id)
    applyAddress(addr)
  }

  const selectNewAddress = () => {
    setSelectedAddrId(null)
    setLine1('')
    setLine2('')
    setCity('')
    setPincode('')
  }

  // Coupon
  const [couponInput, setCouponInput] = useState('')
  const [coupon,      setCoupon]      = useState<{ discount: number; label: string } | null>(null)
  const [couponError, setCouponError] = useState('')

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')

  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [orderId, setOrderId] = useState('')
  const [paidOnline, setPaidOnline] = useState(false)

  const deliveryCharge = total >= 500 ? 0 : 50
  const couponDiscount = coupon?.discount || 0
  const serviceTotal   = serviceBookings.reduce((s, b) => s + (b.visiting_charge || 200) + (b.extra_charges || 0), 0)
  const grandTotal     = total + deliveryCharge - couponDiscount + serviceTotal

  const applyCoupon = () => {
    const c = COUPONS[couponInput.trim().toUpperCase()]
    if (!c) { setCouponError('Invalid coupon code.'); return }
    if (total < c.minOrder) { setCouponError(`Minimum order ₹${c.minOrder} required.`); return }
    const discount = c.type === 'percent' ? Math.round(total * c.value / 100) : c.value
    setCoupon({ discount, label: c.label })
    setCouponError('')
  }

  const validate = () => {
    if (!name.trim())                          { Alert.alert('Enter your name'); return false }
    if (!/^\d{10}$/.test(phone.trim()))        { Alert.alert('Enter valid 10-digit mobile number'); return false }
    if (!line1.trim())                         { Alert.alert('Enter address line 1'); return false }
    if (!city.trim())                          { Alert.alert('Enter city'); return false }
    if (!/^\d{6}$/.test(pincode.trim()))       { Alert.alert('Enter valid 6-digit pincode'); return false }
    return true
  }

  // ── Shared: insert order to Supabase ─────────────────────────────────────
  const insertOrder = async (payMethod: PaymentMethod) => {
    const guestAddress = {
      line1: line1.trim(), line2: line2.trim(),
      city: city.trim(),   pincode: pincode.trim(),
    }
    const payload: Record<string, unknown> = {
      status:          'pending',
      payment_method:  payMethod,
      payment_status:  'unpaid',
      total:           grandTotal,
      delivery_charge: deliveryCharge,
      discount:        couponDiscount || null,
      coupon_code:     coupon ? couponInput.trim().toUpperCase() : null,
      guest_name:      name.trim(),
      guest_phone:     phone.trim(),
      guest_address:   guestAddress,
    }
    if (user) payload.user_id = user.id

    const { data: order, error } = await supabase
      .from('orders')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return order
  }

  // ── Shared: insert items + decrement stock + link services ────────────────
  const finaliseOrder = async (orderId: string) => {
    await supabase.from('order_items').insert(
      items.map(item => ({
        order_id: orderId,
        product_id: item.productId ?? item.id,
        quantity: item.qty,
        price_at_order: item.price,
        variant_label: item.variantLabel ?? null,
      }))
    )
    for (const item of items) {
      await supabase.rpc('decrement_stock', { product_id: item.productId ?? item.id, qty: item.qty })
    }
    if (serviceBookings.length > 0) {
      await Promise.all(serviceBookings.map(b =>
        supabase.from('service_bookings').update({ order_id: orderId }).eq('id', b.id)
      ))
    }
    // Save address if user opted in and hasn't selected an existing one
    if (user && saveAddress && !selectedAddrId) {
      const isFirst = savedAddresses.length === 0
      await supabase.from('user_addresses').insert({
        user_id:   user.id,
        label:     addrLabel.trim() || 'Home',
        full_name: name.trim(),
        phone:     phone.trim(),
        line1:     line1.trim(),
        line2:     line2.trim() || null,
        city:      city.trim(),
        pincode:   pincode.trim(),
        is_default: isFirst,
      })
    }
  }

  // ── COD flow ─────────────────────────────────────────────────────────────
  const handleCOD = async () => {
    setLoading(true)
    try {
      const order = await insertOrder('cod')
      await finaliseOrder(order.id)
      clearCart()
      clearServiceBookings()
      clearGuest()
      setOrderId(order.id.slice(0, 8).toUpperCase())
      setDone(true)
      if (user) maybeRequestReview(user.id)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to place order.')
    } finally {
      setLoading(false)
    }
  }

  // ── Razorpay flow ─────────────────────────────────────────────────────────
  const handleRazorpay = async () => {
    setLoading(true)
    let supabaseOrderId: string | null = null

    try {
      // 1. Create order in our DB first (to get an ID for Razorpay receipt)
      const order = await insertOrder('razorpay')
      supabaseOrderId = order.id

      // 2. Create Razorpay order on our backend
      const amountPaise = Math.round(grandTotal * 100)
      const { data: rzpData } = await createRazorpayOrder({
        amount: amountPaise,
        currency: 'INR',
        receipt: order.id.slice(0, 40),
        notes: { name: name.trim(), phone: phone.trim() },
      })

      setLoading(false) // release spinner before opening checkout UI

      // 3. Open Razorpay checkout
      if (!RazorpayCheckout) {
        Alert.alert('Not supported', 'Online payments are not available in Expo Go. Please use Cash on Delivery.')
        await supabase.from('orders').delete().eq('id', supabaseOrderId)
        return
      }
      const paymentData = await RazorpayCheckout.open({
        description: 'Order from 1ShopStore',
        currency: 'INR',
        key: rzpData.key,
        amount: amountPaise,
        name: '1ShopStore',
        order_id: rzpData.order.id,
        prefill: {
          email:   user?.email ?? '',
          contact: phone.trim(),
          name:    name.trim(),
        },
        theme: { color: '#0c64c0' },
      })

      // 4. Verify signature on our backend
      setLoading(true)
      await verifyRazorpayPayment({
        orderId:             paymentData.razorpay_order_id,
        razorpay_order_id:   paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature:  paymentData.razorpay_signature,
      })

      // 5. Mark order paid in Supabase
      await supabase.from('orders').update({
        payment_status:      'paid',
        razorpay_order_id:   paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
      }).eq('id', order.id)

      // 6. Insert items, decrement stock, link services
      await finaliseOrder(order.id)

      clearCart()
      clearServiceBookings()
      clearGuest()
      setPaidOnline(true)
      setOrderId(order.id.slice(0, 8).toUpperCase())
      setDone(true)
      if (user) maybeRequestReview(user.id)

    } catch (err: unknown) {
      // Razorpay checkout cancelled by user (error.code === 0)
      const code = (err as { code?: number })?.code
      if (code === 0) {
        // Cancel the pending Supabase order so it doesn't clutter the DB
        if (supabaseOrderId) {
          await supabase.from('orders').update({ status: 'cancelled' }).eq('id', supabaseOrderId)
        }
        Alert.alert('Payment cancelled', 'Your order was not placed.')
      } else {
        Alert.alert('Payment failed', err instanceof Error ? err.message : 'Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceOrder = async () => {
    if (!validate()) return
    if (paymentMethod === 'razorpay') {
      await handleRazorpay()
    } else {
      await handleCOD()
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneIcon}>{paidOnline ? '🎉' : '✅'}</Text>
        <Text style={styles.doneTitle}>Order Placed!</Text>
        <Text style={styles.doneSub}>Order #{orderId}</Text>
        {paidOnline && (
          <View style={styles.paidBadge}>
            <Text style={styles.paidBadgeText}>Payment Confirmed</Text>
          </View>
        )}
        <Text style={styles.doneCopy}>
          {paidOnline
            ? `Your payment was received.\nWe'll dispatch your order to ${city.trim()}.`
            : `We'll call you on ${phone} to confirm delivery.\n${serviceBookings.length > 0 ? 'Your technician booking is confirmed.' : ''}`
          }
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Back to Store</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Delivery details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>

        {/* Saved address picker — only for logged-in users with saved addresses */}
        {savedAddresses.length > 0 && (
          <View style={styles.addrPicker}>
            <Text style={styles.addrPickerLabel}>Saved Addresses</Text>
            {savedAddresses.map(addr => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addrCard, selectedAddrId === addr.id && styles.addrCardActive]}
                onPress={() => selectSavedAddress(addr)}
                activeOpacity={0.8}
              >
                <View style={[styles.addrRadio, selectedAddrId === addr.id && styles.addrRadioActive]}>
                  {selectedAddrId === addr.id && <View style={styles.addrRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.addrCardTopRow}>
                    <Text style={styles.addrLabelText}>{addr.label}</Text>
                    {addr.is_default && <Text style={styles.addrDefaultBadge}>Default</Text>}
                  </View>
                  <Text style={styles.addrLine} numberOfLines={1}>{addr.full_name} · {addr.phone}</Text>
                  <Text style={styles.addrLine} numberOfLines={2}>
                    {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addrCard, selectedAddrId === null && styles.addrCardActive]}
              onPress={selectNewAddress}
              activeOpacity={0.8}
            >
              <View style={[styles.addrRadio, selectedAddrId === null && styles.addrRadioActive]}>
                {selectedAddrId === null && <View style={styles.addrRadioDot} />}
              </View>
              <Text style={styles.addrNewText}>+ Enter a new address</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Address form — shown when "new address" is selected (or no saved addresses) */}
        {(selectedAddrId === null || savedAddresses.length === 0) && (
          <>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />
            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput style={styles.input} placeholder="10-digit number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
            <Text style={styles.label}>Address Line 1 *</Text>
            <TextInput style={styles.input} placeholder="Flat / Building / Street" value={line1} onChangeText={setLine1} />
            <Text style={styles.label}>Address Line 2</Text>
            <TextInput style={styles.input} placeholder="Landmark (optional)" value={line2} onChangeText={setLine2} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>City *</Text>
                <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput style={styles.input} placeholder="6 digits" value={pincode} onChangeText={setPincode} keyboardType="numeric" maxLength={6} />
              </View>
            </View>

            {/* Save address option — only for logged-in users */}
            {user && (
              <View style={styles.saveAddrRow}>
                <TouchableOpacity
                  style={[styles.saveAddrCheck, saveAddress && styles.saveAddrCheckActive]}
                  onPress={() => setSaveAddress(v => !v)}
                >
                  {saveAddress && <Text style={styles.saveAddrCheckMark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.saveAddrText}>Save this address</Text>
                {saveAddress && (
                  <TextInput
                    style={styles.addrLabelInput}
                    value={addrLabel}
                    onChangeText={setAddrLabel}
                    placeholder="Label (Home / Work)"
                    maxLength={20}
                  />
                )}
              </View>
            )}
          </>
        )}

        {/* When using a saved address, still show name/phone (pre-filled, editable) */}
        {selectedAddrId !== null && savedAddresses.length > 0 && (
          <>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />
            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput style={styles.input} placeholder="10-digit number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
          </>
        )}
      </View>

      {/* Order summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        {items.map(item => (
          <View key={String(item.id)} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemQty}>×{item.qty}</Text>
            <Text style={styles.itemPrice}>{formatCurrency(item.price * item.qty)}</Text>
          </View>
        ))}

        {serviceBookings.length > 0 && (
          <View style={styles.svcBlock}>
            <Text style={styles.svcBlockHeading}>🛠️ Technician Services</Text>
            {serviceBookings.map(b => (
              <View key={b.service_type} style={styles.itemRow}>
                <Text style={styles.itemName}>{SVC_LABEL[b.service_type]} · {b.scheduled_date}</Text>
                <Text style={styles.itemPrice}>{formatCurrency((b.visiting_charge || 200) + (b.extra_charges || 0))}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <DeliveryEstimate cartTotal={total} />

        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Subtotal</Text>
          <Text style={styles.billValue}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Delivery</Text>
          <Text style={styles.billValue}>{deliveryCharge === 0 ? 'Free' : formatCurrency(deliveryCharge)}</Text>
        </View>
        {serviceTotal > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Services</Text>
            <Text style={styles.billValue}>{formatCurrency(serviceTotal)}</Text>
          </View>
        )}

        {/* Coupon */}
        {!coupon ? (
          <View style={styles.couponRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Coupon code"
              value={couponInput}
              onChangeText={t => { setCouponInput(t.toUpperCase()); setCouponError('') }}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.couponBtn} onPress={applyCoupon} disabled={!couponInput.trim()}>
              <Text style={styles.couponBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.couponApplied}>
            <Text style={styles.couponAppliedText}>🏷 {couponInput.toUpperCase()} — {coupon.label}</Text>
            <TouchableOpacity onPress={() => setCoupon(null)}>
              <Text style={{ color: '#9ca3af' }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
        {coupon && (
          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: '#16a34a' }]}>Discount</Text>
            <Text style={[styles.billValue, { color: '#16a34a' }]}>−{formatCurrency(couponDiscount)}</Text>
          </View>
        )}

        <View style={[styles.billRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
        </View>
      </View>

      {/* Payment method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <PayMethodCard
          selected={paymentMethod === 'cod'}
          method="cod"
          icon="💵"
          title="Cash on Delivery"
          sub="Pay when your order arrives"
          onPress={() => setPaymentMethod('cod')}
        />
        <PayMethodCard
          selected={paymentMethod === 'razorpay'}
          method="razorpay"
          icon="💳"
          title="Pay Online"
          sub="UPI, Cards, Net Banking via Razorpay"
          onPress={() => setPaymentMethod('razorpay')}
        />
        {paymentMethod === 'razorpay' && (
          <View style={styles.rzpNote}>
            <Text style={styles.rzpNoteText}>
              🔒 Payments are secured by Razorpay. We never store your card details.
            </Text>
          </View>
        )}
      </View>

      {/* Place order button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <TouchableOpacity style={[styles.orderBtn, paymentMethod === 'razorpay' && styles.orderBtnOnline]} onPress={handlePlaceOrder} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.orderBtnText}>
                {paymentMethod === 'razorpay'
                  ? `Pay ${formatCurrency(grandTotal)} →`
                  : `Place Order · ${formatCurrency(grandTotal)}`}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  section: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0,
    borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  label: { fontSize: 13, color: '#6b7280', fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    marginBottom: 14, backgroundColor: '#f9fafb',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemName: { flex: 1, fontSize: 14, color: '#374151' },
  itemQty: { fontSize: 13, color: '#9ca3af', marginRight: 10 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#111827' },
  svcBlock: {
    backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#a5d6a7',
  },
  svcBlockHeading: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 14, color: '#6b7280' },
  billValue: { fontSize: 14, color: '#374151', fontWeight: '500' },
  couponRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  couponBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  couponBtnText: { fontWeight: '700', color: '#374151', fontSize: 14 },
  couponApplied: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  couponAppliedText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  couponError: { fontSize: 12, color: '#ef4444', marginBottom: 8 },
  totalRow: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingTop: 12, marginTop: 4, marginBottom: 0,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#111827' },

  rzpNote: {
    backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: '#bbf7d0',
  },
  rzpNoteText: { fontSize: 12, color: '#166534', lineHeight: 18 },

  footer: { padding: 20, paddingBottom: 20 },
  orderBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  orderBtnOnline: { backgroundColor: '#0c2d5e' },
  orderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon: { fontSize: 56, marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  doneSub: { fontSize: 16, color: '#6b7280', marginBottom: 10 },
  paidBadge: {
    backgroundColor: '#dcfce7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14,
  },
  paidBadgeText: { fontSize: 13, color: '#16a34a', fontWeight: '700' },
  doneCopy: { fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  doneBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Saved address picker
  addrPicker:       { marginBottom: 16 },
  addrPickerLabel:  { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, marginBottom: 8, backgroundColor: '#f9fafb',
  },
  addrCardActive:   { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  addrRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  addrRadioActive:  { borderColor: '#2563eb' },
  addrRadioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  addrCardTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  addrLabelText:    { fontSize: 13, fontWeight: '700', color: '#111827' },
  addrDefaultBadge: {
    fontSize: 10, fontWeight: '700', color: '#1d4ed8',
    backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  addrLine:         { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  addrNewText:      { fontSize: 14, fontWeight: '600', color: '#0c64c0' },

  // Save address checkbox
  saveAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  saveAddrCheck: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  saveAddrCheckActive:  { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  saveAddrCheckMark:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  saveAddrText:         { fontSize: 14, color: '#374151', fontWeight: '500' },
  addrLabelInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 13,
    backgroundColor: '#f9fafb', minWidth: 120,
  },
})
