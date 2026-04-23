import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { Product } from '../api'
import { formatCurrency, calcDiscount } from '../lib/currency'
import useWishlistStore from '../store/wishlistStore'

interface Props {
  product: Product
  onSelect: () => void
  onAdd: (product: Product) => void
  compact?: boolean  // 2-column grid mode
  avgRating?: number
  reviewCount?: number
}

function StarRow({ avg, count }: { avg: number; count: number }) {
  const filled = Math.round(avg)
  return (
    <View style={starStyles.row}>
      {[1,2,3,4,5].map(i => (
        <Text key={i} style={[starStyles.star, { color: i <= filled ? '#f59e0b' : '#d1d5db' }]}>★</Text>
      ))}
      <Text style={starStyles.count}>{avg} ({count})</Text>
    </View>
  )
}

const starStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 4 },
  star:  { fontSize: 11 },
  count: { fontSize: 10, color: '#6b7280', marginLeft: 3 },
})

export default function ProductCard({ product, onSelect, onAdd, compact, avgRating, reviewCount }: Props) {
  const discount     = calcDiscount(product.mrp, product.price)
  const inStock      = Number(product.stock || 0) > 0
  const toggle       = useWishlistStore(s => s.toggle)
  const isWishlisted = useWishlistStore(s => s.isWishlisted(product.id))

  const Heart = () => (
    <TouchableOpacity
      style={styles.heartBtn}
      onPress={e => { e.stopPropagation?.(); toggle(product) }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.heartIcon}>{isWishlisted ? '❤️' : '🤍'}</Text>
    </TouchableOpacity>
  )

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onSelect} activeOpacity={0.85}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.compactImage} resizeMode="cover" />
        ) : (
          <View style={styles.compactPlaceholder}>
            <Text style={{ fontSize: 28 }}>📦</Text>
          </View>
        )}
        {discount > 0 && (
          <View style={styles.compactBadge}>
            <Text style={styles.compactBadgeText}>{discount}% off</Text>
          </View>
        )}
        <Heart />
        <View style={styles.compactBody}>
          {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}
          <Text style={styles.compactName} numberOfLines={2}>{product.name}</Text>
          {avgRating && reviewCount ? <StarRow avg={avgRating} count={reviewCount} /> : null}
          <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          {discount > 0 && (
            <Text style={styles.mrp}>{formatCurrency(product.mrp)}</Text>
          )}
          {!inStock && <Text style={styles.outOfStock}>Out of stock</Text>}
          <TouchableOpacity
            style={[styles.compactAddBtn, !inStock && styles.addBtnDisabled]}
            onPress={() => inStock && onAdd(product)}
            disabled={!inStock}
          >
            <Text style={styles.addBtnText}>{inStock ? '+ Add' : 'Out of stock'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onSelect} activeOpacity={0.85}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>📦</Text>
        </View>
      )}
      {discount > 0 && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>{discount}% off</Text>
        </View>
      )}
      <Heart />

      <View style={styles.body}>
        {product.brand ? (
          <Text style={styles.brand}>{product.brand}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {avgRating && reviewCount ? <StarRow avg={avgRating} count={reviewCount} /> : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          {discount > 0 && (
            <Text style={styles.mrp}>{formatCurrency(product.mrp)}</Text>
          )}
        </View>

        {!inStock && (
          <Text style={styles.outOfStock}>Out of stock</Text>
        )}

        <TouchableOpacity
          style={[styles.addBtn, !inStock && styles.addBtnDisabled]}
          onPress={() => inStock && onAdd(product)}
          disabled={!inStock}
        >
          <Text style={styles.addBtnText}>
            {inStock ? 'Add to cart' : 'Out of stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // ── Full-width card ──────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  image: { width: '100%', height: 160, backgroundColor: '#f3f4f6' },
  imagePlaceholder: {
    height: 120, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 36 },
  discountBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: '#16a34a', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  discountBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  body: { padding: 12 },

  // ── Compact 2-col card ──────────────────────────────────────────
  compactCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  compactImage: { width: '100%', height: 120, backgroundColor: '#f3f4f6' },
  compactPlaceholder: {
    height: 100, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  compactBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#16a34a', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  compactBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  compactBody: { padding: 10 },
  compactName: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4, lineHeight: 18 },
  compactAddBtn: {
    backgroundColor: '#0c64c0', borderRadius: 7,
    paddingVertical: 7, alignItems: 'center', marginTop: 8,
  },

  // ── Heart button ────────────────────────────────────────────────
  heartBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 16, width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  heartIcon: { fontSize: 15 },

  // ── Shared ──────────────────────────────────────────────────────
  brand: {
    fontSize: 10, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  name: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexWrap: 'wrap', marginBottom: 8,
  },
  price: { fontSize: 16, fontWeight: '700', color: '#111827' },
  mrp: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  outOfStock: { fontSize: 12, color: '#ef4444', marginBottom: 6 },
  addBtn: {
    backgroundColor: '#0c64c0', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: '#e5e7eb' },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
