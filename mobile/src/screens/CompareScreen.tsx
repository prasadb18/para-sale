import React from 'react'
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useCompareStore from '../store/compareStore'
import useCartStore from '../store/cartStore'
import { formatCurrency, calcDiscount } from '../lib/currency'
import { RootStackParamList } from '../navigation'
import { Product } from '../api'

type Nav = NativeStackNavigationProp<RootStackParamList>

const { width: SCREEN_W } = Dimensions.get('window')
const COL_W = Math.floor((SCREEN_W - 32) / 3)   // fits 3 columns in screen width

const ROWS: Array<{ label: string; key: keyof Product | 'discount' | 'stock_status' }> = [
  { label: 'Price',       key: 'price' },
  { label: 'MRP',         key: 'mrp' },
  { label: 'Discount',    key: 'discount' },
  { label: 'Brand',       key: 'brand' },
  { label: 'Category',    key: 'category_name' },
  { label: 'Availability',key: 'stock_status' },
]

function cellValue(product: Product, key: typeof ROWS[number]['key']): string {
  switch (key) {
    case 'price':       return formatCurrency(product.price)
    case 'mrp':         return formatCurrency(product.mrp)
    case 'discount': {
      const d = calcDiscount(product.mrp, product.price)
      return d > 0 ? `${d}% off` : '—'
    }
    case 'brand':        return product.brand || '—'
    case 'category_name':return product.category_name || '—'
    case 'stock_status': return Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock'
    default:             return '—'
  }
}

function highlight(products: Product[], key: typeof ROWS[number]['key']): string | null {
  if (key === 'price') {
    const min = Math.min(...products.map(p => Number(p.price)))
    return String(min)
  }
  if (key === 'discount') {
    const max = Math.max(...products.map(p => calcDiscount(p.mrp, p.price)))
    return max > 0 ? String(max) : null
  }
  return null
}

export default function CompareScreen() {
  const navigation = useNavigation<Nav>()
  const insets     = useSafeAreaInsets()
  const items      = useCompareStore(s => s.items)
  const remove     = useCompareStore(s => s.remove)
  const clear      = useCompareStore(s => s.clear)
  const addToCart  = useCartStore(s => s.addItem)

  if (items.length === 0) {
    return (
      <View style={[s.empty, { paddingTop: insets.top + 40 }]}>
        <Text style={s.emptyIcon}>⚖️</Text>
        <Text style={s.emptyTitle}>Nothing to compare</Text>
        <Text style={s.emptySub}>Tap "Compare" on any product to add it here.</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.goBack()}>
          <Text style={s.emptyBtnText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Product header cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.headerRow}>
            {items.map(p => (
              <View key={String(p.id)} style={[s.headerCard, { width: COL_W }]}>
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => remove(p.id)}
                >
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={s.headerImg} resizeMode="cover" />
                  : <View style={[s.headerImg, s.headerImgPlaceholder]}><Text style={{ fontSize: 28 }}>📦</Text></View>}
                <Text style={s.headerName} numberOfLines={2}>{p.name}</Text>
                <Text style={s.headerPrice}>{formatCurrency(p.price)}</Text>
                <TouchableOpacity
                  style={[s.addBtn, Number(p.stock) === 0 && s.addBtnDisabled]}
                  disabled={Number(p.stock) === 0}
                  onPress={() => {
                    addToCart(p)
                    navigation.goBack()
                  }}
                >
                  <Text style={s.addBtnText}>{Number(p.stock) > 0 ? 'Add to Cart' : 'Out of Stock'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Comparison rows */}
        {ROWS.map((row, ri) => {
          const best = highlight(items, row.key)
          return (
            <View key={row.key} style={[s.row, ri % 2 === 0 && s.rowAlt]}>
              <View style={s.rowLabel}>
                <Text style={s.rowLabelText}>{row.label}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.rowValues}>
                  {items.map(p => {
                    const val = cellValue(p, row.key)
                    const isBest = best !== null && (
                      row.key === 'price'
                        ? Number(p.price) === Number(best)
                        : row.key === 'discount'
                          ? calcDiscount(p.mrp, p.price) === Number(best)
                          : false
                    )
                    const isOos = row.key === 'stock_status' && Number(p.stock) === 0
                    return (
                      <View key={String(p.id)} style={[s.cell, { width: COL_W }]}>
                        <Text style={[
                          s.cellText,
                          isBest && s.cellBest,
                          isOos && s.cellOos,
                          row.key === 'stock_status' && Number(p.stock) > 0 && s.cellInStock,
                        ]}>
                          {val}
                        </Text>
                        {isBest && <Text style={s.bestBadge}>Best</Text>}
                      </View>
                    )
                  })}
                </View>
              </ScrollView>
            </View>
          )
        })}

        {/* Description comparison */}
        {items.some(p => p.description) && (
          <View style={s.descSection}>
            <Text style={s.descTitle}>Description</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {items.map(p => (
                  <View key={String(p.id)} style={[s.descCard, { width: COL_W + 20 }]}>
                    <Text style={s.descText}>{p.description || '—'}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={s.clearBtn} onPress={clear}>
          <Text style={s.clearBtnText}>Clear Comparison</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:     { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub:      { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  emptyBtn:      { backgroundColor: '#0c64c0', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  emptyBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },

  headerRow:     { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  headerCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  headerImg:            { width: '100%', height: 100, backgroundColor: '#f3f4f6' },
  headerImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  headerName:  { fontSize: 12, fontWeight: '600', color: '#111827', padding: 8, paddingBottom: 2, lineHeight: 16 },
  headerPrice: { fontSize: 14, fontWeight: '800', color: '#0c64c0', paddingHorizontal: 8, paddingBottom: 8 },
  removeBtn: {
    position: 'absolute', top: 6, right: 6, zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { fontSize: 10, color: '#6b7280', fontWeight: '700' },
  addBtn:         { margin: 8, marginTop: 0, backgroundColor: '#0c64c0', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#e5e7eb' },
  addBtnText:     { color: '#fff', fontSize: 12, fontWeight: '700' },

  row:        { flexDirection: 'row', alignItems: 'stretch', minHeight: 44 },
  rowAlt:     { backgroundColor: '#f3f4f6' },
  rowLabel:   { width: 88, justifyContent: 'center', paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  rowLabelText: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowValues:  { flexDirection: 'row' },
  cell:       { justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10, position: 'relative' },
  cellText:   { fontSize: 13, color: '#374151', fontWeight: '500' },
  cellBest:   { color: '#15803d', fontWeight: '700' },
  cellOos:    { color: '#ef4444' },
  cellInStock:{ color: '#15803d' },
  bestBadge:  {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#dcfce7', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    fontSize: 9, color: '#15803d', fontWeight: '700',
  },

  descSection: { padding: 16, paddingTop: 20 },
  descTitle:   { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  descCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  descText: { fontSize: 12, color: '#374151', lineHeight: 18 },

  clearBtn:     { margin: 16, marginTop: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 10 },
  clearBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
})
