import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ScrollView } from 'react-native'

// ── Core animated box ────────────────────────────────────────────────────────
export function SkeletonBox({
  width, height, borderRadius = 8, style,
}: {
  width?: number | string
  height: number
  borderRadius?: number
  style?: object
}) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [anim])

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] })

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#d1d5db' },
        { opacity },
        style,
      ]}
    />
  )
}

// ── Product tile skeleton (home screen horizontal row) ───────────────────────
export function ProductTileSkeleton() {
  return (
    <View style={s.tilWrap}>
      <SkeletonBox width={140} height={110} borderRadius={0} />
      <View style={{ padding: 8 }}>
        <SkeletonBox width={110} height={11} borderRadius={5} style={{ marginBottom: 6 }} />
        <SkeletonBox width={80}  height={11} borderRadius={5} style={{ marginBottom: 8 }} />
        <SkeletonBox width={55}  height={13} borderRadius={5} style={{ marginBottom: 10 }} />
        <SkeletonBox width={124} height={28} borderRadius={8} />
      </View>
    </View>
  )
}

// ── Product card skeleton (products grid, 2-col) ─────────────────────────────
export function ProductCardSkeleton() {
  return (
    <View style={s.cardWrap}>
      <SkeletonBox width="100%" height={130} borderRadius={0} />
      <View style={{ padding: 10 }}>
        <SkeletonBox width="90%" height={12} borderRadius={5} style={{ marginBottom: 6 }} />
        <SkeletonBox width="60%" height={12} borderRadius={5} style={{ marginBottom: 10 }} />
        <SkeletonBox width="40%" height={14} borderRadius={5} style={{ marginBottom: 10 }} />
        <SkeletonBox width="100%" height={32} borderRadius={8} />
      </View>
    </View>
  )
}

// ── Products grid skeleton (6 cards) ─────────────────────────────────────────
export function ProductsGridSkeleton() {
  return (
    <View style={s.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={s.gridCell}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  )
}

// ── Order card skeleton ───────────────────────────────────────────────────────
export function OrderCardSkeleton() {
  return (
    <View style={s.orderCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <SkeletonBox width={120} height={14} borderRadius={5} />
        <SkeletonBox width={72}  height={22} borderRadius={11} />
      </View>
      <SkeletonBox width={90}  height={11} borderRadius={5} style={{ marginBottom: 6 }} />
      <SkeletonBox width={80}  height={18} borderRadius={5} />
    </View>
  )
}

// ── Booking card skeleton ─────────────────────────────────────────────────────
export function BookingCardSkeleton() {
  return (
    <View style={s.bookingCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <SkeletonBox width={44} height={44} borderRadius={12} />
          <View>
            <SkeletonBox width={120} height={14} borderRadius={5} style={{ marginBottom: 6 }} />
            <SkeletonBox width={90}  height={11} borderRadius={5} />
          </View>
        </View>
        <SkeletonBox width={70} height={24} borderRadius={12} />
      </View>
      <SkeletonBox width="80%" height={11} borderRadius={5} style={{ marginBottom: 6 }} />
      <SkeletonBox width={60}  height={14} borderRadius={5} />
    </View>
  )
}

// ── Home featured-products skeleton (horizontal row) ─────────────────────────
export function HomeFeaturedSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
      {Array.from({ length: 4 }).map((_, i) => <ProductTileSkeleton key={i} />)}
    </ScrollView>
  )
}

// ── Category tile skeleton ────────────────────────────────────────────────────
export function CategoryRowSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ alignItems: 'center', width: 72 }}>
          <SkeletonBox width={54} height={54} borderRadius={14} style={{ marginBottom: 6 }} />
          <SkeletonBox width={44} height={10} borderRadius={5} />
        </View>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  // Product tile
  tilWrap: {
    width: 140, backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  // Product card (grid)
  cardWrap: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', shadowColor: '#000',
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 12, gap: 12,
  },
  gridCell: { width: '47%' },
  // Order card
  orderCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  // Booking card
  bookingCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
})
