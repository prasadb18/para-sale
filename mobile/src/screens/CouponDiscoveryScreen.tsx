import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COUPONS_LIST, Coupon } from '../lib/coupons'
import { RootStackParamList } from '../navigation'
import { formatCurrency } from '../lib/currency'

type Nav   = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Coupons'>

function CouponCard({ coupon, cartTotal, onApply }: { coupon: Coupon; cartTotal: number; onApply: (code: string) => void }) {
  const eligible    = cartTotal >= coupon.minOrder
  const [copied, setCopied] = useState(false)

  const discount = coupon.type === 'percent'
    ? (cartTotal * coupon.value) / 100
    : coupon.value

  const handleCopy = async () => {
    await Share.share({ message: coupon.code })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <View style={[s.card, !eligible && s.cardDim]}>
      {/* Dashed left border stripe */}
      <View style={[s.stripe, { backgroundColor: eligible ? '#0c64c0' : '#d1d5db' }]} />

      <View style={s.cardBody}>
        <View style={s.topRow}>
          <Text style={s.codeIcon}>{coupon.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.code}>{coupon.code}</Text>
            <Text style={s.label}>{coupon.label}</Text>
          </View>
          {eligible && (
            <Text style={s.saving}>Save {coupon.type === 'percent' ? `${coupon.value}%` : formatCurrency(coupon.value)}</Text>
          )}
        </View>

        <Text style={s.desc}>{coupon.desc}</Text>

        {!eligible && (
          <Text style={s.notEligible}>
            Add {formatCurrency(coupon.minOrder - cartTotal)} more to use this coupon
          </Text>
        )}

        <View style={s.actions}>
          <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
            <Text style={s.copyBtnText}>{copied ? '✓ Copied!' : 'Copy Code'}</Text>
          </TouchableOpacity>
          {eligible && (
            <TouchableOpacity style={s.applyBtn} onPress={() => onApply(coupon.code)}>
              <Text style={s.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

export default function CouponDiscoveryScreen() {
  const navigation = useNavigation<Nav>()
  const route      = useRoute<Route>()
  const insets     = useSafeAreaInsets()
  const cartTotal  = (route.params as any)?.cartTotal ?? 0
  const onApply    = (route.params as any)?.onApply

  const handleApply = (code: string) => {
    if (onApply) {
      onApply(code)
      navigation.goBack()
    } else {
      Alert.alert('Coupon Code', `Use code "${code}" at checkout.`)
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Text style={s.heroIcon}>🏷️</Text>
        <Text style={s.heroTitle}>Available Coupons</Text>
        {cartTotal > 0 && (
          <Text style={s.heroSub}>Cart total: {formatCurrency(cartTotal)}</Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        {COUPONS_LIST.map(c => (
          <CouponCard
            key={c.code}
            coupon={c}
            cartTotal={cartTotal}
            onApply={handleApply}
          />
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  hero: {
    backgroundColor: '#0c2d5e', alignItems: 'center',
    paddingTop: 32, paddingBottom: 28, marginBottom: 20,
  },
  heroIcon:  { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardDim:  { opacity: 0.65 },
  stripe:   { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  topRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  codeIcon: { fontSize: 26 },
  code:     { fontSize: 16, fontWeight: '800', color: '#111827', letterSpacing: 1 },
  label:    { fontSize: 13, color: '#6b7280', marginTop: 2 },
  saving:   { fontSize: 13, fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  desc:     { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: 8 },
  notEligible: { fontSize: 12, color: '#f59e0b', fontWeight: '600', marginBottom: 8 },
  actions:  { flexDirection: 'row', gap: 10 },
  copyBtn:  { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  applyBtn: { backgroundColor: '#0c64c0', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})
