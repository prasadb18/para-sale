import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated, Easing, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
import { RootStackParamList } from '../navigation'

type Nav   = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'OrderTracking'>

// ── Status configuration ──────────────────────────────────────────
const STEPS = ['pending', 'confirmed', 'dispatched', 'delivered'] as const
type OrderStatus = typeof STEPS[number] | 'cancelled'

const STEP_META: Record<string, { icon: string; label: string; desc: string; eta: string; color: string }> = {
  pending:    { icon: '🕐', label: 'Order Placed',   desc: 'We have received your order',               eta: 'Confirming in ~30 min',       color: '#f59e0b' },
  confirmed:  { icon: '✅', label: 'Confirmed',       desc: 'Your order is being prepared for dispatch', eta: 'Dispatching within 2 hours',  color: '#3b82f6' },
  dispatched: { icon: '🚚', label: 'Out for Delivery',desc: 'Your order is on the way',                  eta: 'Arriving in 30–60 min',       color: '#8b5cf6' },
  delivered:  { icon: '🎉', label: 'Delivered',       desc: 'Your order has been delivered',             eta: 'Enjoy your purchase!',        color: '#16a34a' },
  cancelled:  { icon: '❌', label: 'Cancelled',       desc: 'This order was cancelled',                  eta: '',                            color: '#ef4444' },
}

const STORE_PHONE = '+919999999999'  // replace with actual store phone

// ── Pulsing dot for active step ───────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.5, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ]),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [scale, opacity])

  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[ts.pulseBg, { backgroundColor: color, transform: [{ scale }], opacity }]} />
      <View style={[ts.dot, { backgroundColor: color }]} />
    </View>
  )
}

// ── Step row ─────────────────────────────────────────────────────
function StepRow({ step, currentIdx, myIdx }: { step: string; currentIdx: number; myIdx: number }) {
  const meta    = STEP_META[step]
  const done    = myIdx < currentIdx
  const active  = myIdx === currentIdx
  const pending = myIdx > currentIdx

  const dotColor = done ? '#16a34a' : active ? meta.color : '#d1d5db'
  const lineColor = done ? '#16a34a' : '#e5e7eb'
  const isLast = myIdx === STEPS.length - 1

  return (
    <View style={ts.stepRow}>
      {/* Left: dot + vertical line */}
      <View style={ts.stepLeft}>
        {active
          ? <PulseDot color={meta.color} />
          : <View style={[ts.dot, { backgroundColor: done ? '#16a34a' : '#d1d5db', width: 20, height: 20 }]}>
              {done && <Text style={ts.checkmark}>✓</Text>}
            </View>
        }
        {!isLast && <View style={[ts.line, { backgroundColor: lineColor }]} />}
      </View>

      {/* Right: label + desc + eta */}
      <View style={[ts.stepContent, isLast ? {} : { paddingBottom: 24 }]}>
        <Text style={[ts.stepLabel, { color: pending ? '#9ca3af' : '#111827' }, active && { fontWeight: '800' }]}>
          {meta.label}
        </Text>
        {!pending && <Text style={ts.stepDesc}>{meta.desc}</Text>}
        {active && meta.eta ? (
          <View style={[ts.etaChip, { borderColor: meta.color + '66', backgroundColor: meta.color + '15' }]}>
            <Text style={[ts.etaText, { color: meta.color }]}>{meta.eta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────
interface OrderData {
  id: string
  status: string
  created_at: string
  total: number
  delivery_charge: number
  payment_method: string
  payment_status: string
  guest_name: string
  guest_phone: string
  guest_address: { line1?: string; line2?: string; city?: string; pincode?: string } | null
  order_items: { quantity: number; price_at_order: number; products: { name: string } | null }[]
}

export default function OrderTrackingScreen() {
  const navigation = useNavigation<Nav>()
  const route      = useRoute<Route>()
  const insets     = useSafeAreaInsets()
  const { orderId } = route.params

  const [order, setOrder]     = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)

  // Initial fetch
  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(quantity, price_at_order, products(name))')
      .eq('id', orderId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setOrder(data as OrderData)
          setLiveStatus(data.status)
        }
        setLoading(false)
      })
  }, [orderId])

  // ── Real-time subscription ────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          const newStatus = (payload.new as { status: string }).status
          setLiveStatus(newStatus)
          setOrder(prev => prev ? { ...prev, status: newStatus } : prev)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0c64c0" />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const status      = liveStatus ?? order.status
  const isCancelled = status === 'cancelled'
  const isDelivered = status === 'delivered'
  const currentIdx  = STEPS.indexOf(status as typeof STEPS[number])
  const meta        = STEP_META[status] ?? STEP_META.pending
  const shortId     = order.id.slice(0, 8).toUpperCase()
  const orderDate   = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const itemCount   = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Track Order</Text>
          <Text style={styles.headerSub}>#{shortId} · {orderDate}</Text>
        </View>
        {/* Live indicator */}
        {!isCancelled && !isDelivered && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Status hero card ── */}
        <View style={[styles.heroCard, { borderColor: meta.color + '55' }]}>
          <Text style={styles.heroIcon}>{meta.icon}</Text>
          <Text style={[styles.heroStatus, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.heroDesc}>{meta.desc}</Text>
          {meta.eta && !isDelivered && !isCancelled && (
            <View style={[styles.heroEta, { backgroundColor: meta.color + '18', borderColor: meta.color + '55' }]}>
              <Text style={[styles.heroEtaText, { color: meta.color }]}>⏱  {meta.eta}</Text>
            </View>
          )}
        </View>

        {/* ── Timeline ── */}
        {!isCancelled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Progress</Text>
            <View style={ts.timeline}>
              {STEPS.map((step, idx) => (
                <StepRow key={step} step={step} currentIdx={currentIdx} myIdx={idx} />
              ))}
            </View>
          </View>
        )}

        {/* ── Delivery address ── */}
        {order.guest_address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivering to</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressName}>{order.guest_name}</Text>
                <Text style={styles.addressLine}>
                  {[order.guest_address.line1, order.guest_address.line2, order.guest_address.city, order.guest_address.pincode]
                    .filter(Boolean).join(', ')}
                </Text>
                <Text style={styles.addressPhone}>{order.guest_phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Order summary ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(order.total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>{order.delivery_charge === 0 ? 'Free' : formatCurrency(order.delivery_charge)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Total Paid</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(order.total)}</Text>
            </View>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>
                {order.payment_method === 'cod' ? '💵 Cash on Delivery' : '💳 Paid Online'}
                {'  ·  '}
                {order.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Help / Call store ── */}
        {!isDelivered && !isCancelled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Need Help?</Text>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${STORE_PHONE}`)}
            >
              <Text style={styles.callBtnIcon}>📞</Text>
              <View>
                <Text style={styles.callBtnTitle}>Call Store</Text>
                <Text style={styles.callBtnSub}>We're available Mon–Sat, 9 AM – 7 PM</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.waBtn}
              onPress={() => Linking.openURL(`https://wa.me/${STORE_PHONE.replace('+', '')}?text=Hi, I need help with order #${shortId}`)}
            >
              <Text style={styles.waBtnIcon}>💬</Text>
              <View>
                <Text style={styles.waBtnTitle}>WhatsApp Us</Text>
                <Text style={styles.waBtnSub}>Quick reply via WhatsApp</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backBtn:   { backgroundColor: '#0c64c0', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0c2d5e', paddingHorizontal: 16, paddingBottom: 16,
  },
  headerBack:     { padding: 4 },
  headerBackIcon: { fontSize: 22, color: '#fff', fontWeight: '600' },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:      { fontSize: 12, color: '#93c5fd', marginTop: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ffffff22', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  liveText:  { fontSize: 11, fontWeight: '800', color: '#4ade80', letterSpacing: 1 },

  heroCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 20,
    padding: 24, alignItems: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  heroIcon:    { fontSize: 52, marginBottom: 10 },
  heroStatus:  { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  heroDesc:    { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  heroEta:     { marginTop: 14, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  heroEtaText: { fontSize: 13, fontWeight: '700' },

  section:      { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },

  addressCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  addressIcon: { fontSize: 20, marginTop: 2 },
  addressName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  addressLine: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  addressPhone: { fontSize: 13, color: '#374151', fontWeight: '500', marginTop: 4 },

  summaryCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel:     { fontSize: 14, color: '#6b7280' },
  summaryValue:     { fontSize: 14, color: '#374151', fontWeight: '500' },
  summaryTotalRow:  { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  summaryTotalValue: { fontSize: 15, fontWeight: '800', color: '#111827' },
  paymentBadge:     { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  paymentBadgeText: { fontSize: 13, color: '#374151' },

  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#eff6ff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 10,
  },
  callBtnIcon:  { fontSize: 26 },
  callBtnTitle: { fontSize: 15, fontWeight: '700', color: '#1d4ed8' },
  callBtnSub:   { fontSize: 12, color: '#6b7280', marginTop: 2 },

  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  waBtnIcon:  { fontSize: 26 },
  waBtnTitle: { fontSize: 15, fontWeight: '700', color: '#15803d' },
  waBtnSub:   { fontSize: 12, color: '#6b7280', marginTop: 2 },
})

const ts = StyleSheet.create({
  timeline:    { paddingLeft: 4 },
  stepRow:     { flexDirection: 'row', gap: 14 },
  stepLeft:    { alignItems: 'center', width: 22 },
  dot:         { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pulseBg:     { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  checkmark:   { fontSize: 12, color: '#fff', fontWeight: '800' },
  line:        { width: 2, flex: 1, marginTop: 4, minHeight: 20 },
  stepContent: { flex: 1, paddingBottom: 8 },
  stepLabel:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  stepDesc:    { fontSize: 13, color: '#6b7280', marginTop: 2 },
  etaChip:     { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  etaText:     { fontSize: 12, fontWeight: '700' },
})
