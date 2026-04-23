import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { formatCurrency } from '../lib/currency'
import { RootStackParamList } from '../navigation'
import { OrderCardSkeleton } from '../components/Skeleton'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface ReturnRequest {
  reason: string
  status: 'pending' | 'approved' | 'rejected'
}

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  price_at_order: number
  products: { name: string; image_url?: string } | null
}

interface ServiceBooking {
  id: string
  service_type: string
  scheduled_date: string
  time_slot: string
  visiting_charge: number
  extra_charges: number
  status: string
  technicians: { name: string; phone: string } | null
}

interface Order {
  id: string
  created_at: string
  status: string
  total: number
  payment_method: string
  payment_status: string
  delivery_charge: number
  discount: number | null
  guest_name: string
  guest_phone: string
  guest_address: { line1?: string; line2?: string; city?: string; pincode?: string } | null
  order_items: OrderItem[]
  service_bookings: ServiceBooking[]
}

const ORDER_STEPS = ['pending', 'confirmed', 'dispatched', 'delivered']

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fff8e1', color: '#f59e0b', label: 'Pending' },
  confirmed:  { bg: '#e3f2fd', color: '#1565c0', label: 'Confirmed' },
  dispatched: { bg: '#e8f5e9', color: '#2e7d32', label: 'Dispatched' },
  delivered:  { bg: '#f3e5f5', color: '#6a1b9a', label: 'Delivered' },
  cancelled:  { bg: '#fce4ec', color: '#c62828', label: 'Cancelled' },
  paid:       { bg: '#dcfce7', color: '#16a34a', label: 'Paid' },
}

const SVC_LABEL: Record<string, string> = {
  electrical: 'Electrician ⚡',
  plumbing: 'Plumber 🔧',
  painting: 'Painter 🎨',
}

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = ORDER_STEPS.indexOf(status)
  if (status === 'cancelled' || currentIdx < 0) return null
  return (
    <View style={tl.wrap}>
      {ORDER_STEPS.map((step, i) => {
        const done    = i <= currentIdx
        const active  = i === currentIdx
        const isLast  = i === ORDER_STEPS.length - 1
        return (
          <View key={step} style={tl.stepWrap}>
            <View style={[tl.dot, done ? tl.dotDone : tl.dotPending, active && tl.dotActive]}>
              {done && !active && <Text style={tl.check}>✓</Text>}
            </View>
            {!isLast && <View style={[tl.line, done && i < currentIdx ? tl.lineDone : tl.linePending]} />}
            <Text style={[tl.label, done ? tl.labelDone : tl.labelPending, active && tl.labelActive]}>
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const CANCELLABLE = new Set(['pending', 'confirmed'])

const RETURN_REASONS = [
  'Wrong item delivered',
  'Item damaged / defective',
  'Item not as described',
  'Changed my mind',
  'Other',
]

const RETURN_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Return Pending',  color: '#b45309', bg: '#fef3c7' },
  approved: { label: 'Return Approved', color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Return Rejected', color: '#b91c1c', bg: '#fee2e2' },
}

function OrderCard({
  order, onCancel, onReorder, onReturn, onDownloadInvoice, returnRequest,
}: {
  order: Order
  onCancel: (id: string) => Promise<void>
  onReorder: (order: Order) => Promise<void>
  onReturn: (orderId: string, reason: string) => Promise<void>
  onDownloadInvoice: (order: Order) => Promise<void>
  returnRequest: ReturnRequest | null
}) {
  const navigation   = useNavigation<Nav>()
  const [expanded,    setExpanded]    = useState(false)
  const [cancelling,  setCancelling]  = useState(false)
  const [reordering,  setReordering]  = useState(false)
  const [returning,   setReturning]   = useState(false)
  const [downloading, setDownloading] = useState(false)
  const meta = STATUS_META[order.status] || STATUS_META.pending

  const handleReorderPress = async () => {
    setReordering(true)
    try { await onReorder(order) } finally { setReordering(false) }
  }

  const handleReturnPress = () => {
    Alert.alert(
      'Return / Refund',
      'Select a reason for your return request:',
      [
        ...RETURN_REASONS.map(reason => ({
          text: reason,
          onPress: async () => {
            setReturning(true)
            try { await onReturn(order.id, reason) } finally { setReturning(false) }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    )
  }

  const handleDownloadInvoice = async () => {
    setDownloading(true)
    try { await onDownloadInvoice(order) } finally { setDownloading(false) }
  }

  const handleCancel = () => {
    const isPaid = order.payment_status === 'paid'
    Alert.alert(
      'Cancel Order?',
      isPaid
        ? `Order #${order.id.slice(-8).toUpperCase()} will be cancelled. Since you paid online, a refund will be processed to your original payment method within 5–7 business days.`
        : `Order #${order.id.slice(-8).toUpperCase()} will be cancelled and your items returned to stock.`,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              await onCancel(order.id)
            } finally {
              setCancelling(false)
            }
          },
        },
      ]
    )
  }
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <View style={styles.orderTopRow}>
            <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>{date}</Text>
          <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Status timeline */}
          <StatusTimeline status={order.status} />

          {/* Items */}
          {order.order_items?.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.itemsHeading}>Items Ordered</Text>
              {order.order_items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.products?.name ?? 'Product'}
                  </Text>
                  <Text style={styles.itemQtyPrice}>
                    ×{item.quantity} · {formatCurrency(item.price_at_order * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Service bookings */}
          {order.service_bookings?.length > 0 && (
            <View style={styles.svcSection}>
              <Text style={styles.itemsHeading}>🛠️ Technician Services</Text>
              {order.service_bookings.map(b => {
                const sm = STATUS_META[b.status] || STATUS_META.pending
                return (
                  <View key={b.id} style={styles.svcRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.svcLabel}>{SVC_LABEL[b.service_type] ?? b.service_type}</Text>
                      <Text style={styles.svcMeta}>📅 {b.scheduled_date} · {b.time_slot}</Text>
                      {b.technicians && (
                        <Text style={styles.svcTech}>👷 {b.technicians.name} · {b.technicians.phone}</Text>
                      )}
                    </View>
                    <View>
                      <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
                        <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
                      </View>
                      <Text style={styles.svcCharge}>
                        {formatCurrency((b.visiting_charge || 200) + (b.extra_charges || 0))}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Bill breakdown */}
          <View style={styles.bill}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Subtotal</Text>
              <Text style={styles.billValue}>
                {formatCurrency(order.total - (order.delivery_charge || 0) + (order.discount || 0))}
              </Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery</Text>
              <Text style={styles.billValue}>
                {order.delivery_charge ? formatCurrency(order.delivery_charge) : 'Free'}
              </Text>
            </View>
            {(order.discount ?? 0) > 0 && (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: '#16a34a' }]}>Discount</Text>
                <Text style={[styles.billValue, { color: '#16a34a' }]}>−{formatCurrency(order.discount!)}</Text>
              </View>
            )}
            <View style={[styles.billRow, styles.billTotal]}>
              <Text style={styles.billTotalLabel}>Total</Text>
              <Text style={styles.billTotalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>

          {/* Address + payment */}
          {order.guest_address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>
                {[order.guest_address.line1, order.guest_address.line2, order.guest_address.city, order.guest_address.pincode]
                  .filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          {order.guest_phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={styles.infoText}>{order.guest_name} · {order.guest_phone}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💵</Text>
            <Text style={styles.infoText}>
              {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
              {' · '}{order.payment_status}
            </Text>
          </View>

          {/* Action buttons — structured by status */}
          {(() => {
            const isActive    = ['pending', 'confirmed', 'dispatched'].includes(order.status)
            const isCancellable = CANCELLABLE.has(order.status)
            const hasBuyAgain = order.order_items?.length > 0
            return (
              <>
                {/* Row 1: Track + Cancel (when both present), or Track alone */}
                {isActive && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                    >
                      <Text style={styles.trackBtnText}>📍 Track Order</Text>
                    </TouchableOpacity>
                    {isCancellable && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={handleCancel}
                        disabled={cancelling}
                      >
                        {cancelling
                          ? <ActivityIndicator size="small" color="#dc2626" />
                          : <Text style={styles.cancelBtnText}>Cancel</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {/* Row 2 (or only row): Buy Again — full width */}
                {hasBuyAgain && (
                  <View style={[styles.actionRow, { marginTop: isActive ? 8 : 10 }]}>
                    <TouchableOpacity
                      style={[styles.reorderBtn, reordering && { opacity: 0.7 }]}
                      onPress={handleReorderPress}
                      disabled={reordering}
                    >
                      {reordering
                        ? <ActivityIndicator size="small" color="#0c64c0" />
                        : <Text style={styles.reorderBtnText}>🔄 Buy Again</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )
          })()}

          {/* Return/refund + Invoice row — for delivered orders */}
          {order.status === 'delivered' && (
            <View style={styles.actionRow}>
              {/* Return / Refund */}
              {returnRequest ? (
                <View style={[styles.returnStatusBadge, { backgroundColor: RETURN_STATUS_META[returnRequest.status].bg }]}>
                  <Text style={[styles.returnStatusText, { color: RETURN_STATUS_META[returnRequest.status].color }]}>
                    {RETURN_STATUS_META[returnRequest.status].label}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.returnBtn, returning && { opacity: 0.7 }]}
                  onPress={handleReturnPress}
                  disabled={returning}
                >
                  {returning
                    ? <ActivityIndicator size="small" color="#b45309" />
                    : <Text style={styles.returnBtnText}>↩ Return / Refund</Text>
                  }
                </TouchableOpacity>
              )}

              {/* Download Invoice */}
              <TouchableOpacity
                style={[styles.invoiceBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownloadInvoice}
                disabled={downloading}
              >
                {downloading
                  ? <ActivityIndicator size="small" color="#374151" />
                  : <Text style={styles.invoiceBtnText}>📄 Invoice</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Invoice-only row for paid non-delivered orders */}
          {order.status !== 'delivered' && order.payment_status === 'paid' && (
            <View style={[styles.actionRow, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity
                style={[styles.invoiceBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownloadInvoice}
                disabled={downloading}
              >
                {downloading
                  ? <ActivityIndicator size="small" color="#374151" />
                  : <Text style={styles.invoiceBtnText}>📄 Invoice</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Refund note for already-cancelled paid orders */}
          {order.status === 'cancelled' && order.payment_status === 'paid' && (
            <View style={styles.refundNote}>
              <Text style={styles.refundNoteText}>
                💳 Refund in progress — expect 5–7 business days to your original payment method.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export default function OrdersScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuthStore()
  const { addItem } = useCartStore()
  const [orders,          setOrders]          = useState<Order[]>([])
  const [returnRequests,  setReturnRequests]   = useState<Record<string, ReturnRequest>>({})
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (!user) { if (!isRefresh) setLoading(false); return }
    if (isRefresh) setRefreshing(true); else setLoading(true)

    const [ordersRes, returnsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          order_items(id, product_id, quantity, price_at_order, products(name, image_url)),
          service_bookings(id, service_type, scheduled_date, time_slot, visiting_charge, extra_charges, status, technicians(name, phone))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('return_requests')
        .select('order_id, reason, status')
        .eq('user_id', user.id),
    ])

    setOrders((ordersRes.data as Order[]) || [])
    const map: Record<string, ReturnRequest> = {}
    for (const r of (returnsRes.data || [])) {
      map[r.order_id] = { reason: r.reason, status: r.status }
    }
    setReturnRequests(map)

    if (isRefresh) setRefreshing(false); else setLoading(false)
  }, [user])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const cancelOrder = useCallback(async (orderId: string) => {
    // Find the order so we can restore stock
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    try {
      // 1. Mark the order as cancelled
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
      if (error) throw error

      // 2. Cancel any linked service bookings
      if (order.service_bookings?.length > 0) {
        await supabase
          .from('service_bookings')
          .update({ status: 'cancelled' })
          .eq('order_id', orderId)
      }

      // 3. Restore product stock for each item
      await Promise.all(
        (order.order_items ?? []).map(item =>
          supabase.rpc('increment_stock', { product_id: item.product_id, qty: item.quantity })
        )
      )

      // 4. Optimistically update local state — no full re-fetch needed
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelled',
                service_bookings: o.service_bookings?.map(b => ({ ...b, status: 'cancelled' })),
              }
            : o
        )
      )
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel order. Try again.')
    }
  }, [orders])

  const handleReorder = useCallback(async (order: Order) => {
    const ids = order.order_items.map(i => i.product_id)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, mrp, image_url, brand, spec')
      .in('id', ids)
    if (error || !products) {
      Alert.alert('Error', 'Could not load product details. Try again.')
      return
    }
    const map = new Map(products.map(p => [p.id, p]))
    const unavailable: string[] = []
    order.order_items.forEach(item => {
      const p = map.get(item.product_id)
      if (!p) { unavailable.push(item.products?.name ?? 'Unknown'); return }
      for (let i = 0; i < item.quantity; i++) {
        addItem({ productId: p.id, id: p.id, name: p.name, price: p.price, mrp: p.mrp ?? p.price, image_url: p.image_url, brand: p.brand, spec: p.spec })
      }
    })
    const goToCart = () => (navigation as any).navigate('Cart')
    if (unavailable.length > 0) {
      Alert.alert('Some items unavailable', `${unavailable.join(', ')} could not be added.`, [{ text: 'View Cart', onPress: goToCart }])
    } else {
      goToCart()
    }
  }, [addItem, navigation])

  const submitReturn = useCallback(async (orderId: string, reason: string) => {
    if (!user) return
    const { error } = await supabase.from('return_requests').insert({
      order_id: orderId, user_id: user.id, reason,
    })
    if (error) {
      Alert.alert('Error', 'Could not submit return request. Try again.')
      return
    }
    setReturnRequests(prev => ({ ...prev, [orderId]: { reason, status: 'pending' } }))
    Alert.alert('Request Submitted', 'We\'ll review your return request within 1–2 business days and contact you on your registered number.')
  }, [user])

  const downloadInvoice = useCallback(async (order: Order) => {
    const date = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const itemRows = (order.order_items ?? []).map(item => `
      <tr>
        <td>${item.products?.name ?? 'Product'}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">₹${item.price_at_order.toFixed(2)}</td>
        <td style="text-align:right">₹${(item.price_at_order * item.quantity).toFixed(2)}</td>
      </tr>`).join('')
    const subtotal = order.total - (order.delivery_charge || 0) + (order.discount || 0)
    const address  = order.guest_address
      ? [order.guest_address.line1, order.guest_address.line2, order.guest_address.city, order.guest_address.pincode].filter(Boolean).join(', ')
      : '—'

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; }
  .header { background: #0c2d5e; color: #fff; padding: 20px 24px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; } .header p { margin: 0; opacity: 0.75; font-size: 12px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 16px; }
  .col h4 { margin: 0 0 6px; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .col p  { margin: 0; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; color: #374151; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .totals { margin-left: auto; width: 260px; }
  .totals tr td { border: none; padding: 5px 12px; }
  .totals .grand td { font-weight: 700; font-size: 15px; border-top: 2px solid #111; padding-top: 10px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
</style></head><body>
  <div class="header">
    <h1>1ShopStore</h1>
    <p>Tax Invoice / Receipt</p>
  </div>
  <div class="row">
    <div class="col">
      <h4>Invoice #</h4>
      <p>${order.id.slice(-8).toUpperCase()}</p>
    </div>
    <div class="col">
      <h4>Date</h4>
      <p>${date}</p>
    </div>
    <div class="col">
      <h4>Payment</h4>
      <p>${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}</p>
    </div>
  </div>
  <div class="col" style="margin-bottom:20px">
    <h4>Billed To</h4>
    <p>${order.guest_name || '—'}<br/>${order.guest_phone || ''}<br/>${address}</p>
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">₹${subtotal.toFixed(2)}</td></tr>
    <tr><td>Delivery</td><td style="text-align:right">${order.delivery_charge ? '₹' + order.delivery_charge.toFixed(2) : 'Free'}</td></tr>
    ${(order.discount ?? 0) > 0 ? `<tr><td style="color:#16a34a">Discount</td><td style="text-align:right;color:#16a34a">−₹${order.discount!.toFixed(2)}</td></tr>` : ''}
    <tr class="grand"><td>Grand Total</td><td style="text-align:right">₹${order.total.toFixed(2)}</td></tr>
  </table>
  <div class="footer">Thank you for shopping with 1ShopStore · For support contact us via WhatsApp</div>
</body></html>`

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: `Invoice_${order.id.slice(-8).toUpperCase()}.pdf` })
      } else {
        Alert.alert('Saved', `Invoice saved to: ${uri}`)
      }
    } catch {
      Alert.alert('Error', 'Could not generate invoice. Try again.')
    }
  }, [])

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Sign in to view orders</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={{ padding: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </View>
      </View>
    )
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyCopy}>Your completed orders will appear here.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerCount}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} colors={['#0c64c0']} tintColor="#0c64c0" />
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onCancel={cancelOrder}
            onReorder={handleReorder}
            onReturn={submitReturn}
            onDownloadInvoice={downloadInvoice}
            returnRequest={returnRequests[item.id] ?? null}
          />
        )}
      />
    </View>
  )
}

// ── Timeline styles ──────────────────────────────────────────────────
const tl = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 20, paddingVertical: 12,
    backgroundColor: '#f8fafb', borderRadius: 10, paddingHorizontal: 8,
  },
  stepWrap: { flex: 1, alignItems: 'center' },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  dotDone:    { backgroundColor: '#0c64c0' },
  dotPending: { backgroundColor: '#e5e7eb' },
  dotActive:  { backgroundColor: '#0c64c0', borderWidth: 3, borderColor: '#bfdbfe' },
  check: { color: '#fff', fontSize: 11, fontWeight: '700' },
  line: {
    position: 'absolute', top: 12, left: '50%', right: '-50%',
    height: 2, zIndex: -1,
  },
  lineDone:    { backgroundColor: '#0c64c0' },
  linePending: { backgroundColor: '#e5e7eb' },
  label: { fontSize: 10, textAlign: 'center' },
  labelDone:   { color: '#0c64c0', fontWeight: '600' },
  labelPending: { color: '#9ca3af' },
  labelActive: { color: '#0c64c0', fontWeight: '800' },
})

// ── Screen styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  headerBar: {
    backgroundColor: '#0c2d5e', paddingHorizontal: 16,
    paddingTop: 56, paddingBottom: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerCount: { fontSize: 13, color: '#93c5fd', fontWeight: '500' },

  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyCopy: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  loginBtn: {
    marginTop: 20, backgroundColor: '#0c64c0',
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16,
  },
  orderTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  orderId: { fontSize: 14, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  orderDate: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  orderTotal: { fontSize: 18, fontWeight: '700', color: '#111827' },
  chevron: { fontSize: 12, color: '#9ca3af', marginLeft: 10 },

  // Expanded
  expandedSection: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  itemsSection: { marginBottom: 16 },
  itemsHeading: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  itemName: { flex: 1, fontSize: 13, color: '#374151', marginRight: 8 },
  itemQtyPrice: { fontSize: 13, fontWeight: '600', color: '#111827' },

  // Service bookings
  svcSection: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#a5d6a7',
  },
  svcRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  svcLabel: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 2 },
  svcMeta: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  svcTech: { fontSize: 11, color: '#2e7d32', fontWeight: '600' },
  svcCharge: { fontSize: 12, fontWeight: '600', color: '#111827', textAlign: 'right', marginTop: 4 },

  // Bill
  bill: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingTop: 12, marginBottom: 12,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billLabel: { fontSize: 13, color: '#6b7280' },
  billValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  billTotal: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingTop: 10, marginTop: 4,
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  billTotalValue: { fontSize: 17, fontWeight: '800', color: '#111827' },

  // Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6,
  },
  infoIcon: { fontSize: 14, marginRight: 8, marginTop: 1 },
  infoText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },

  cancelBtn: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },

  refundNote: {
    marginTop: 12, backgroundColor: '#eff6ff',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  refundNoteText: { fontSize: 12, color: '#1d4ed8', lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  trackBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#6ee7b7', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', backgroundColor: '#ecfdf5',
  },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  reorderBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#93c5fd', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', backgroundColor: '#eff6ff',
  },
  reorderBtnText: { fontSize: 13, fontWeight: '700', color: '#0c64c0' },

  returnBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#fcd34d', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', backgroundColor: '#fffbeb',
  },
  returnBtnText: { fontSize: 13, fontWeight: '700', color: '#b45309' },
  returnStatusBadge: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  returnStatusText: { fontSize: 13, fontWeight: '700' },

  invoiceBtn: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  invoiceBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
})
