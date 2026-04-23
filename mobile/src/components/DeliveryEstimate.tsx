import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getDeliveryEstimate } from '../lib/delivery'

interface Props {
  cartTotal?: number   // used to decide "Free" vs "₹50"
  compact?: boolean    // single-line chip (for product detail)
}

export default function DeliveryEstimate({ cartTotal = 0, compact = false }: Props) {
  const est      = useMemo(() => getDeliveryEstimate(), [])
  const isFree   = cartTotal >= 500
  const charge   = isFree ? 'Free delivery' : 'Delivery ₹50'
  const freeHint = !isFree && cartTotal > 0
    ? `  ·  Add ₹${500 - Math.round(cartTotal)} more for free delivery`
    : ''

  if (compact) {
    return (
      <View style={s.chip}>
        <Text style={s.chipIcon}>🚚</Text>
        <Text style={s.chipText}>
          <Text style={isFree ? s.free : s.paid}>{charge}</Text>
          {'  ·  '}
          <Text style={s.date}>Delivered {est.label}</Text>
          {est.byTime ? <Text style={s.time}> {est.byTime}</Text> : null}
        </Text>
      </View>
    )
  }

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.truckIcon}>🚚</Text>
        <View style={{ flex: 1 }}>
          <View style={s.row}>
            <Text style={[s.label, isFree ? s.free : s.paid]}>{charge}</Text>
            <Text style={s.separator}>·</Text>
            <Text style={s.date}>
              Delivered {est.label}
              {est.byTime ? <Text style={s.time}> {est.byTime}</Text> : ''}
            </Text>
          </View>
          {est.isSameDay && (
            <Text style={s.sameDay}>⚡ Order now for same-day delivery</Text>
          )}
          {freeHint ? <Text style={s.freeHint}>{freeHint.trim()}</Text> : null}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  // ── Compact chip (product detail) ──────────────────────────────
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#bbf7d0',
    marginBottom: 12,
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, color: '#374151', flexShrink: 1 },

  // ── Full card (cart / checkout) ─────────────────────────────────
  card: {
    backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  truckIcon: { fontSize: 18, marginRight: 2 },
  separator: { fontSize: 13, color: '#9ca3af' },
  label:     { fontSize: 13, fontWeight: '700' },
  date:      { fontSize: 13, color: '#374151', fontWeight: '500' },
  time:      { fontSize: 12, color: '#6b7280' },
  sameDay:   { fontSize: 11, color: '#15803d', fontWeight: '600', marginTop: 3 },
  freeHint:  { fontSize: 11, color: '#0c64c0', marginTop: 3 },

  // ── Colour tokens ───────────────────────────────────────────────
  free: { color: '#15803d' },
  paid: { color: '#b45309' },
})
