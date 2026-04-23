import React from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  Image, StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useWishlistStore from '../store/wishlistStore'
import useCartStore from '../store/cartStore'
import { formatCurrency, calcDiscount } from '../lib/currency'
import { RootStackParamList } from '../navigation'
import { Product } from '../api'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function WishlistScreen() {
  const navigation   = useNavigation<Nav>()
  const items        = useWishlistStore(s => s.items)
  const toggle       = useWishlistStore(s => s.toggle)
  const addItem      = useCartStore(s => s.addItem)

  const handleAddToCart = (product: Product) => {
    addItem(product)
    toggle(product)   // remove from wishlist after adding to cart
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🤍</Text>
        <Text style={styles.emptyTitle}>No saved items</Text>
        <Text style={styles.emptyCopy}>Tap the heart on any product to save it here.</Text>
        <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.browseBtnText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderItem = ({ item }: { item: Product }) => {
    const discount = calcDiscount(item.mrp, item.price)
    const inStock  = Number(item.stock || 0) > 0
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
        activeOpacity={0.85}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}><Text style={{ fontSize: 32 }}>📦</Text></View>
        )}
        {discount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{discount}% off</Text>
          </View>
        )}
        {/* Remove from wishlist */}
        <TouchableOpacity style={styles.removeBtn} onPress={() => toggle(item)}>
          <Text style={styles.removeBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.price}>{formatCurrency(item.price)}</Text>
          {discount > 0 && <Text style={styles.mrp}>{formatCurrency(item.mrp)}</Text>}
          {!inStock && <Text style={styles.oos}>Out of stock</Text>}
          <TouchableOpacity
            style={[styles.addBtn, !inStock && styles.addBtnDisabled]}
            onPress={() => inStock && handleAddToCart(item)}
            disabled={!inStock}
          >
            <Text style={styles.addBtnText}>{inStock ? 'Add to cart' : 'Unavailable'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Items</Text>
        <Text style={styles.headerCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={p => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#0c2d5e', paddingHorizontal: 16,
    paddingTop: 56, paddingBottom: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerCount: { fontSize: 13, color: '#93c5fd', fontWeight: '500' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyCopy:  { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  browseBtn:  { backgroundColor: '#0c64c0', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  image:       { width: '100%', height: 120, backgroundColor: '#f3f4f6' },
  placeholder: { height: 100, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#16a34a', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { fontSize: 11, color: '#6b7280', fontWeight: '700' },
  body: { padding: 10 },
  brand: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  name:  { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4, lineHeight: 18 },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  mrp:   { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through', marginBottom: 4 },
  oos:   { fontSize: 11, color: '#ef4444', marginBottom: 4 },
  addBtn: {
    backgroundColor: '#0c64c0', borderRadius: 7,
    paddingVertical: 7, alignItems: 'center', marginTop: 6,
  },
  addBtnDisabled: { backgroundColor: '#e5e7eb' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
