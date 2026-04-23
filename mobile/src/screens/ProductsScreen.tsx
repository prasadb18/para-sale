import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, TextInput,
  StyleSheet, TouchableOpacity, RefreshControl,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getProducts, Product } from '../api'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/cartStore'
import { RootStackParamList, TabParamList } from '../navigation'
import { ProductsGridSkeleton } from '../components/Skeleton'

type Nav   = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<TabParamList, 'Products'>

type Filter  = 'all' | 'offer' | 'instock'
type SortKey = 'default' | 'price_asc' | 'price_desc' | 'name_asc'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'offer',   label: 'On Offer' },
  { key: 'instock', label: 'In Stock' },
]

const SORT_OPTIONS: { key: SortKey; label: string; sub: string }[] = [
  { key: 'default',    label: 'Featured',           sub: 'Default ordering'      },
  { key: 'price_asc',  label: 'Price: Low to High', sub: 'Cheapest first'        },
  { key: 'price_desc', label: 'Price: High to Low', sub: 'Most expensive first'  },
  { key: 'name_asc',   label: 'Name: A to Z',       sub: 'Alphabetical'          },
]

// ── Sort & Filter bottom-sheet ────────────────────────────────────────────────
interface SortFilterSheetProps {
  visible: boolean
  sort: SortKey
  minPrice: string
  maxPrice: string
  onApply: (sort: SortKey, min: string, max: string) => void
  onClose: () => void
}

function SortFilterSheet({ visible, sort, minPrice, maxPrice, onApply, onClose }: SortFilterSheetProps) {
  const [localSort, setLocalSort]       = useState<SortKey>(sort)
  const [localMin,  setLocalMin]        = useState(minPrice)
  const [localMax,  setLocalMax]        = useState(maxPrice)

  // Sync when parent resets
  useEffect(() => { setLocalSort(sort); setLocalMin(minPrice); setLocalMax(maxPrice) }, [visible])

  const reset = () => { setLocalSort('default'); setLocalMin(''); setLocalMax('') }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sf.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sf.sheet}>
        {/* Handle */}
        <View style={sf.handle} />
        <View style={sf.sheetHeader}>
          <Text style={sf.sheetTitle}>Sort & Filter</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={sf.resetText}>Reset all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Sort section ── */}
          <Text style={sf.sectionLabel}>SORT BY</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[sf.optRow, localSort === opt.key && sf.optRowActive]}
              onPress={() => setLocalSort(opt.key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[sf.optLabel, localSort === opt.key && sf.optLabelActive]}>{opt.label}</Text>
                <Text style={sf.optSub}>{opt.sub}</Text>
              </View>
              <View style={[sf.radio, localSort === opt.key && sf.radioActive]}>
                {localSort === opt.key && <View style={sf.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}

          {/* ── Price range section ── */}
          <Text style={[sf.sectionLabel, { marginTop: 20 }]}>PRICE RANGE</Text>
          <View style={sf.priceRow}>
            <View style={sf.priceInputWrap}>
              <Text style={sf.pricePrefix}>₹</Text>
              <TextInput
                style={sf.priceInput}
                placeholder="Min"
                keyboardType="numeric"
                value={localMin}
                onChangeText={setLocalMin}
                returnKeyType="next"
              />
            </View>
            <View style={sf.priceSep} />
            <View style={sf.priceInputWrap}>
              <Text style={sf.pricePrefix}>₹</Text>
              <TextInput
                style={sf.priceInput}
                placeholder="Max"
                keyboardType="numeric"
                value={localMax}
                onChangeText={setLocalMax}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Quick price presets */}
          <View style={sf.presetRow}>
            {[
              { label: 'Under ₹500',  min: '',    max: '500' },
              { label: '₹500–₹2k',   min: '500', max: '2000' },
              { label: '₹2k–₹5k',    min: '2000',max: '5000' },
              { label: 'Above ₹5k',  min: '5000',max: '' },
            ].map(p => (
              <TouchableOpacity
                key={p.label}
                style={[
                  sf.preset,
                  localMin === p.min && localMax === p.max && sf.presetActive,
                ]}
                onPress={() => { setLocalMin(p.min); setLocalMax(p.max) }}
              >
                <Text style={[
                  sf.presetText,
                  localMin === p.min && localMax === p.max && sf.presetTextActive,
                ]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity style={sf.applyBtn} onPress={() => onApply(localSort, localMin, localMax)}>
          <Text style={sf.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProductsScreen() {
  const navigation = useNavigation<Nav>()
  const route      = useRoute<Route>()
  const addItem    = useCartStore(s => s.addItem)

  const [allProducts,   setAllProducts]   = useState<Product[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [search,        setSearch]        = useState(route.params?.search ?? '')
  const [categorySlug,  setCategorySlug]  = useState(route.params?.categorySlug ?? '')
  const [categoryName,  setCategoryName]  = useState(route.params?.categoryName ?? '')
  const [filter,        setFilter]        = useState<Filter>('all')
  const [sort,          setSort]          = useState<SortKey>('default')
  const [minPrice,      setMinPrice]      = useState('')
  const [maxPrice,      setMaxPrice]      = useState('')
  const [showSheet,     setShowSheet]     = useState(false)

  // justNavigatedRef: set true when route.params change (banner/home pushes new params).
  // useFocusEffect consumes it — if true, keep filter; if false, it's a tab switch → reset.
  const justNavigatedRef = useRef(false)

  useEffect(() => {
    justNavigatedRef.current = true
    setSearch(route.params?.search ?? '')
    setCategorySlug(route.params?.categorySlug ?? '')
    setCategoryName(route.params?.categoryName ?? '')
    setFilter('all')
    setSort('default')
    setMinPrice('')
    setMaxPrice('')
  }, [route.params])

  useFocusEffect(useCallback(() => {
    if (justNavigatedRef.current) {
      // Came here via banner/home navigation — keep the filter
      justNavigatedRef.current = false
    } else {
      // Came here via tab switch — reset everything
      setCategorySlug('')
      setCategoryName('')
      setSearch('')
      setFilter('all')
      setSort('default')
      setMinPrice('')
      setMaxPrice('')
    }
  }, []))

  const fetchProducts = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    getProducts(categorySlug || undefined, search || undefined)
      .then(res => setAllProducts(res.data || []))
      .finally(() => { if (isRefresh) setRefreshing(false); else setLoading(false) })
  }, [search, categorySlug])

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(false), 300)
    return () => clearTimeout(t)
  }, [search, categorySlug])

  // ── Client-side filter + sort pipeline ───────────────────────────────────
  const minNum = minPrice ? Number(minPrice) : null
  const maxNum = maxPrice ? Number(maxPrice) : null

  const products = allProducts
    .filter(p => {
      if (filter === 'instock') return Number(p.stock || 0) > 0
      if (filter === 'offer')   return Number(p.mrp || 0) > Number(p.price || 0)
      return true
    })
    .filter(p => {
      const price = Number(p.price || 0)
      if (minNum !== null && price < minNum) return false
      if (maxNum !== null && price > maxNum) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'price_asc')  return Number(a.price) - Number(b.price)
      if (sort === 'price_desc') return Number(b.price) - Number(a.price)
      if (sort === 'name_asc')   return (a.name ?? '').localeCompare(b.name ?? '')
      return 0
    })

  // Count active non-default sort/filter options for badge
  const activeCount = (sort !== 'default' ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0)

  const title = categoryName || (categorySlug ? categorySlug : 'All Products')

  const clearAll = () => {
    setSearch(''); setCategorySlug(''); setCategoryName('')
    setFilter('all'); setSort('default'); setMinPrice(''); setMaxPrice('')
  }

  const hasAnyFilter = !!(categorySlug || search || filter !== 'all' || activeCount > 0)

  return (
    <View style={styles.container}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.count}>
              {loading ? 'Loading…' : `${products.length} item${products.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          {hasAnyFilter && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Text style={styles.clearBtnText}>✕ Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={categoryName ? `Search in ${categoryName}…` : 'Search products…'}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips + Sort button */}
        <View style={styles.filterRow}>
          <View style={styles.filterChips}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort & Filter button */}
          <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSheet(true)}>
            <Text style={styles.sortBtnIcon}>⇅</Text>
            <Text style={styles.sortBtnText}>Sort</Text>
            {activeCount > 0 && (
              <View style={styles.sortBadge}>
                <Text style={styles.sortBadgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active sort/price chips */}
        {(sort !== 'default' || minPrice || maxPrice) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipsScroll} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
            {sort !== 'default' && (
              <TouchableOpacity style={styles.activeChip} onPress={() => setSort('default')}>
                <Text style={styles.activeChipText}>{SORT_OPTIONS.find(o => o.key === sort)?.label} ✕</Text>
              </TouchableOpacity>
            )}
            {(minPrice || maxPrice) && (
              <TouchableOpacity style={styles.activeChip} onPress={() => { setMinPrice(''); setMaxPrice('') }}>
                <Text style={styles.activeChipText}>
                  {minPrice && maxPrice ? `₹${minPrice}–₹${maxPrice}` : minPrice ? `≥ ₹${minPrice}` : `≤ ₹${maxPrice}`} ✕
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Content ───────────────────────────────────────────────── */}
      {loading ? (
        <ProductsGridSkeleton />
      ) : products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyCopy}>
            {search
              ? `No results for "${search}"`
              : filter !== 'all'
              ? 'Nothing matches this filter.'
              : activeCount > 0
              ? 'Try a wider price range or different sort.'
              : categoryName
              ? `No products in ${categoryName} yet.`
              : 'No products available.'}
          </Text>
          <TouchableOpacity style={styles.clearFilter} onPress={clearAll}>
            <Text style={styles.clearFilterText}>Show all products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchProducts(true)} colors={['#0c64c0']} tintColor="#0c64c0" />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              compact
              onSelect={() => navigation.navigate('ProductDetail', { id: item.id })}
              onAdd={addItem}
            />
          )}
        />
      )}

      {/* ── Sort & Filter sheet ────────────────────────────────────── */}
      <SortFilterSheet
        visible={showSheet}
        sort={sort}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={(s, min, max) => { setSort(s); setMinPrice(min); setMaxPrice(max); setShowSheet(false) }}
        onClose={() => setShowSheet(false)}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    backgroundColor: '#0c2d5e',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  count: { fontSize: 12, color: '#93c5fd', fontWeight: '500', marginTop: 2 },

  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  clearBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#111827' },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChips: { flex: 1, flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  filterChipText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  filterChipTextActive: { color: '#0c2d5e', fontWeight: '700' },

  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    position: 'relative',
  },
  sortBtnIcon: { fontSize: 14, color: '#fff', fontWeight: '700' },
  sortBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  sortBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#f59e0b', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sortBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

  activeChipsScroll: { marginTop: 8 },
  activeChip: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  activeChipText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  grid: { padding: 12 },
  gridRow: { gap: 12, marginBottom: 12 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptyCopy: { fontSize: 14, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
  clearFilter: {
    backgroundColor: '#0c64c0', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  clearFilterText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})

// ── Sheet styles ──────────────────────────────────────────────────────────────
const sf = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36,
    maxHeight: '85%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d1d5db', alignSelf: 'center', marginTop: 10, marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  resetText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.8, marginBottom: 10,
  },

  optRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optRowActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  optLabel: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  optLabelActive: { color: '#1d4ed8' },
  optSub: { fontSize: 12, color: '#9ca3af' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: '#2563eb' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  priceSep: { width: 16, height: 1.5, backgroundColor: '#d1d5db' },
  priceInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, backgroundColor: '#f9fafb',
  },
  pricePrefix: { fontSize: 15, color: '#6b7280', marginRight: 4 },
  priceInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#111827' },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  preset: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  presetActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  presetText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  presetTextActive: { color: '#2563eb', fontWeight: '700' },

  applyBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
