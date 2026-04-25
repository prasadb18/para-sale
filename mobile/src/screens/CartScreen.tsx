import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, Alert, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useCartStore, { CartItem, ServiceBooking } from '../store/cartStore'
import useAuthStore from '../store/authStore'
import useGuestStore from '../store/guestStore'
import { formatCurrency } from '../lib/currency'
import { RootStackParamList } from '../navigation'
import DeliveryEstimate from '../components/DeliveryEstimate'
import { getProducts, Product } from '../api'

type Nav = NativeStackNavigationProp<RootStackParamList>

const SERVICE_MATCH = [
  { match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan/i, type: 'electrical' as const, icon: '⚡', label: 'Electrician', color: '#1565c0' },
  { match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i,             type: 'plumbing'   as const, icon: '🔧', label: 'Plumber',      color: '#00695c' },
  { match: /paint|primer|putty|varnish|enamel|wood finish/i,               type: 'painting'   as const, icon: '🎨', label: 'Painter',      color: '#e65100' },
]

const SVC_ICON:  Record<string, string> = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL: Record<string, string> = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }
const SVC_STATUS_COLOR: Record<string, string> = {
  pending: '#f39c12', confirmed: '#1565c0', assigned: '#2e7d32', completed: '#6a1b9a', cancelled: '#c62828'
}

function CartRow({ item }: { item: CartItem }) {
  const navigation = useNavigation<Nav>()
  const { updateQty, removeItem } = useCartStore()
  const svc = SERVICE_MATCH.find(s => s.match.test(item.name) || s.match.test(item.categories?.name || ''))

  return (
    <View style={styles.row}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.rowImage} resizeMode="cover" />
      ) : (
        <View style={styles.rowImagePlaceholder}>
          <Text>📦</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {item.variantLabel ? <Text style={styles.rowSpec}>{item.variantLabel}</Text> : item.spec ? <Text style={styles.rowSpec}>{item.spec}</Text> : null}
        <Text style={styles.rowPrice}>{formatCurrency(item.price)} each</Text>

        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.qty - 1)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{item.qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.qty + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {svc ? (
          <TouchableOpacity
            style={[styles.svcBtn, { borderColor: svc.color }]}
            onPress={() => navigation.navigate('Services', { type: svc.type, fromCart: true })}
          >
            <Text style={[styles.svcBtnText, { color: svc.color }]}>
              {svc.icon} Need a {svc.label}? · ₹200
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

function ServiceLine({ booking }: { booking: ServiceBooking }) {
  const { removeServiceBooking } = useCartStore()
  const charge = (booking.visiting_charge || 200) + (booking.extra_charges || 0)
  return (
    <View style={styles.svcLine}>
      <View style={{ flex: 1 }}>
        <Text style={styles.svcLineTitle}>
          {SVC_ICON[booking.service_type]} {SVC_LABEL[booking.service_type]} (Service)
        </Text>
        <Text style={styles.svcLineMeta}>
          {booking.scheduled_date} · {booking.time_slot}
        </Text>
      </View>
      <Text style={styles.svcLinePrice}>{formatCurrency(charge)}</Text>
      <TouchableOpacity onPress={() => removeServiceBooking(booking.service_type)} style={{ marginLeft: 8 }}>
        <Text style={{ color: '#9ca3af', fontSize: 16 }}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Auth Gate Modal ────────────────────────────────────────────────────────────
function AuthGateModal({ visible, grandTotal, onClose }: { visible: boolean; grandTotal: number; onClose: () => void }) {
  const navigation  = useNavigation<Nav>()
  const { setGuest } = useGuestStore()
  const [tab, setTab]       = useState<'choice' | 'guest'>('choice')
  const [gName, setGName]   = useState('')
  const [gPhone, setGPhone] = useState('')

  const handleGuest = () => {
    if (!gName.trim())                        { Alert.alert('Enter your name'); return }
    if (!/^\d{10}$/.test(gPhone.trim()))      { Alert.alert('Enter valid 10-digit mobile number'); return }
    setGuest(gName.trim(), gPhone.trim())
    onClose()
    navigation.navigate('Checkout')
  }

  const handleSignIn = () => {
    onClose()
    navigation.navigate('Login')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.gateOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.gateBg} activeOpacity={1} onPress={onClose} />
        <View style={styles.gateSheet}>
          <View style={styles.gatePill} />

          {tab === 'choice' ? (
            <>
              <Text style={styles.gateTitle}>How would you like to order?</Text>
              <Text style={styles.gateSub}>Total: {formatCurrency(grandTotal)}</Text>

              <TouchableOpacity style={styles.gateSignInBtn} onPress={handleSignIn}>
                <Text style={styles.gateSignInIcon}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gateSignInTitle}>Sign In / Sign Up</Text>
                  <Text style={styles.gateSignInSub}>Track orders, reorder easily, earn rewards</Text>
                </View>
                <Text style={styles.gateArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gateGuestBtn} onPress={() => setTab('guest')}>
                <Text style={styles.gateGuestIcon}>🛍️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gateGuestTitle}>Continue as Guest</Text>
                  <Text style={styles.gateGuestSub}>Quick checkout, no account needed</Text>
                </View>
                <Text style={styles.gateArrow}>›</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setTab('choice')} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#0c64c0', fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.gateTitle}>Guest Details</Text>
              <Text style={styles.gateSub}>We need your name and phone for delivery</Text>

              <TextInput
                style={styles.gateInput}
                placeholder="Full Name"
                value={gName}
                onChangeText={setGName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.gateInput}
                placeholder="10-digit Mobile Number"
                value={gPhone}
                onChangeText={setGPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <TouchableOpacity style={styles.gateProceedBtn} onPress={handleGuest}>
                <Text style={styles.gateProceedText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function EmptyCartSuggestions() {
  const navigation = useNavigation<Nav>()
  const addItem    = useCartStore(s => s.addItem)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    getProducts()
      .then(r => setSuggestions((r.data || []).filter(p => Number(p.stock || 0) > 0).slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <ScrollView style={styles.emptySuggestScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.emptyTop}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyCopy}>Here are some things you might need:</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#0c64c0" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.suggestGrid}>
          {suggestions.map(p => (
            <TouchableOpacity
              key={String(p.id)}
              style={styles.suggestCard}
              onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
              activeOpacity={0.85}
            >
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.suggestImg} resizeMode="cover" />
              ) : (
                <View style={styles.suggestImgPlaceholder}><Text style={{ fontSize: 22 }}>📦</Text></View>
              )}
              <Text style={styles.suggestName} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.suggestPrice}>{formatCurrency(p.price)}</Text>
              <TouchableOpacity style={styles.suggestAddBtn} onPress={() => addItem(p)}>
                <Text style={styles.suggestAddTxt}>+ Add</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

export default function CartScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const { items, total, clearCart, serviceBookings } = useCartStore()
  const { user } = useAuthStore()
  const { isGuest } = useGuestStore()
  const [gateVisible, setGateVisible] = useState(false)

  const serviceTotal = serviceBookings.reduce((sum, b) => sum + (b.visiting_charge || 200) + (b.extra_charges || 0), 0)
  const deliveryCharge = total >= 500 ? 0 : 50
  const grandTotal = total + deliveryCharge + serviceTotal

  const handleCheckout = () => {
    if (user || isGuest) {
      navigation.navigate('Checkout')
    } else {
      setGateVisible(true)
    }
  }

  if (items.length === 0) {
    return <EmptyCartSuggestions />
  }

  return (
    <View style={styles.container}>
      <AuthGateModal
        visible={gateVisible}
        grandTotal={grandTotal}
        onClose={() => setGateVisible(false)}
      />

      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearCart },
        ])}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {items.map(item => <CartRow key={String(item.id)} item={item} />)}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        {serviceBookings.length > 0 && (
          <View style={styles.svcSummary}>
            <Text style={styles.svcSummaryHeading}>🛠️ Technician Services</Text>
            {serviceBookings.map(b => <ServiceLine key={b.service_type} booking={b} />)}
          </View>
        )}

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
        <View style={[styles.billRow, styles.billTotalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
        </View>

        <DeliveryEstimate cartTotal={total} />

        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutBtnText}>Proceed to Checkout · {formatCurrency(grandTotal)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56,
    paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  clearText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptySuggestScroll: { flex: 1, backgroundColor: '#f9fafb' },
  emptyTop: { alignItems: 'center', paddingTop: 48, paddingBottom: 20 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyCopy: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  suggestGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  suggestCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 12,
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  suggestImg: { width: '100%', height: 110, backgroundColor: '#f3f4f6' },
  suggestImgPlaceholder: { width: '100%', height: 110, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  suggestName:  { fontSize: 12, color: '#374151', fontWeight: '500', padding: 8, paddingBottom: 2, lineHeight: 17 },
  suggestPrice: { fontSize: 13, fontWeight: '700', color: '#111827', paddingHorizontal: 8, marginBottom: 6 },
  suggestAddBtn: { margin: 8, marginTop: 0, backgroundColor: '#0c64c0', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  suggestAddTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    marginBottom: 12, overflow: 'hidden', shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  rowImage: { width: 90, height: '100%', minHeight: 90, backgroundColor: '#f3f4f6' },
  rowImagePlaceholder: {
    width: 90, minHeight: 90, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1, padding: 12 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSpec: { fontSize: 12, color: '#2563eb', fontWeight: '500', marginBottom: 4 },
  rowPrice: { fontSize: 14, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  qtyValue: { fontSize: 15, fontWeight: '600', color: '#111827', minWidth: 20, textAlign: 'center' },
  removeBtn: { marginLeft: 'auto' },
  removeBtnText: { fontSize: 13, color: '#ef4444' },
  svcBtn: {
    marginTop: 8, borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start',
  },
  svcBtnText: { fontSize: 12, fontWeight: '700' },
  footer: {
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingBottom: 16,
  },
  svcSummary: {
    backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#a5d6a7',
  },
  svcSummaryHeading: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 8 },
  svcLine: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#c8e6c9',
  },
  svcLineTitle: { fontSize: 13, fontWeight: '600', color: '#1b5e20' },
  svcLineMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  svcLinePrice: { fontSize: 13, fontWeight: '700', color: '#1b5e20' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billLabel: { fontSize: 14, color: '#6b7280' },
  billValue: { fontSize: 14, color: '#374151', fontWeight: '500' },
  billTotalRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginTop: 4, marginBottom: 14 },
  totalLabel: { fontSize: 16, color: '#111827', fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  checkoutBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Auth gate modal
  gateOverlay: { flex: 1, justifyContent: 'flex-end' },
  gateBg:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  gateSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  gatePill:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 20 },
  gateTitle:  { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  gateSub:    { fontSize: 14, color: '#6b7280', marginBottom: 20 },

  gateSignInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#eff6ff', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#bfdbfe', marginBottom: 12,
  },
  gateSignInIcon:  { fontSize: 24 },
  gateSignInTitle: { fontSize: 15, fontWeight: '700', color: '#1d4ed8', marginBottom: 2 },
  gateSignInSub:   { fontSize: 12, color: '#3b82f6' },

  gateGuestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 12,
  },
  gateGuestIcon:  { fontSize: 24 },
  gateGuestTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 2 },
  gateGuestSub:   { fontSize: 12, color: '#6b7280' },
  gateArrow:      { fontSize: 22, color: '#9ca3af' },

  gateInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    marginBottom: 12, backgroundColor: '#f9fafb',
  },
  gateProceedBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  gateProceedText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
