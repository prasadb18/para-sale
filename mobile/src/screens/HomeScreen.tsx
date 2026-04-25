import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Image, Dimensions, Alert, Modal, RefreshControl,
} from 'react-native'
import { supabase } from '../lib/supabase'
// react-native-maps is not bundled in Expo Go — load lazily to avoid crash
let MapView: any = null
let Region: any = null
try {
  const maps = require('react-native-maps')
  MapView = maps.default
  Region = maps.Region
} catch {}
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
import * as Location from 'expo-location'
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native'
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCategories, getProducts, Category, Product } from '../api'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import useRecentlyViewedStore from '../store/recentlyViewedStore'
import { RootStackParamList, TabParamList } from '../navigation'
import { formatCurrency } from '../lib/currency'
import { CategoryRowSkeleton, HomeFeaturedSkeleton } from '../components/Skeleton'

// Composite type so we can navigate to BOTH tab screens AND stack screens
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>

const { width: W } = Dimensions.get('window')

// ── Colors ────────────────────────────────────────────────────────────
const C = {
  navy1:  '#0c2d5e',
  navy2:  '#0e3d82',
  blue1:  '#dbeafe',
  blue2:  '#eff6ff',
  accent: '#0c64c0',
}

// ── Category icon helper ──────────────────────────────────────────────
const CAT_PRESETS = [
  { match: ['electrical', 'wire', 'cable', 'lighting', 'switch', 'mcb'], icon: '⚡' },
  { match: ['plumb', 'pipe', 'valve', 'sanitary', 'water', 'tap'],       icon: '💧' },
  { match: ['paint', 'primer', 'putty', 'chemical', 'adhesive'],         icon: '🎨' },
  { match: ['tool', 'safety', 'fastener', 'hardware', 'drill', 'screw'], icon: '🔧' },
  { match: ['light', 'led', 'bulb', 'fitting'],                           icon: '💡' },
]
const FALLBACK_ICONS = ['🛒', '🧱', '📦', '🔌', '🪟', '🧰']
function getCatIcon(cat: Category, i: number) {
  const src = `${cat.slug} ${cat.name}`.toLowerCase()
  return CAT_PRESETS.find(p => p.match.some(k => src.includes(k)))?.icon
    ?? FALLBACK_ICONS[i % FALLBACK_ICONS.length]
}

// ── Banner definitions — each has a search keyword for Products ───────
const BANNERS = [
  {
    id: 'electricals', label: 'NEWLY LISTED', title: 'Fresh Electricals',
    sub: 'Wires, switches & MCBs in stock', color: '#1e3a8a', accent: '#3b82f6',
    icon: '⚡', search: 'electrical', catName: 'Electricals',
  },
  {
    id: 'painting', label: 'FEATURED', title: 'Painting Season',
    sub: 'Primers, emulsions & rollers', color: '#92400e', accent: '#f59e0b',
    icon: '🎨', search: 'paint', catName: 'Paints',
  },
  {
    id: 'plumbing', label: 'FEATURED', title: 'Plumbing Supplies',
    sub: 'Pipes, taps & fittings', color: '#065f46', accent: '#10b981',
    icon: '🔧', search: 'pipe', catName: 'Plumbing',
  },
  {
    id: 'tools', label: 'OFFER', title: 'Site Tool Kits',
    sub: 'Drills, anchors & fasteners', color: '#4c1d95', accent: '#8b5cf6',
    icon: '🛠️', search: 'drill', catName: 'Tools',
  },
]

// ── Project kits — each has a search keyword ─────────────────────────
const KITS = [
  { id: 'wiring',   icon: '⚡', name: 'Basic Wiring Kit',        tagline: 'Wires, switches, MCB & distribution box',  color: '#e8f1fb', accent: '#1565c0', search: 'wire' },
  { id: 'plumbing', icon: '🚿', name: 'Bathroom Plumbing Kit',   tagline: 'CPVC pipes, ball valves, basin taps',      color: '#e0f5f5', accent: '#00695c', search: 'pipe' },
  { id: 'painting', icon: '🎨', name: 'Painting Starter Kit',    tagline: 'Wall primer, emulsion, rollers & brushes', color: '#fff8e1', accent: '#e65100', search: 'paint' },
  { id: 'tools',    icon: '🛠️', name: 'Site Tool Kit',           tagline: 'Measuring tape, drill bits, fasteners',   color: '#f3e5f5', accent: '#6a1b9a', search: 'drill' },
  { id: 'lighting', icon: '💡', name: 'Lighting Setup Kit',      tagline: 'LED bulbs, batten lights, downlights',    color: '#f0fdf4', accent: '#2e7d32', search: 'led' },
  { id: 'safety',   icon: '🔒', name: 'Safety & Protection Kit', tagline: 'MCB breakers, earthing & protection',     color: '#fce4ec', accent: '#b71c1c', search: 'mcb' },
]

// ── Project kit card with Add to Cart ────────────────────────────────
function KitCard({ kit, onAdd }: {
  kit: typeof KITS[number]
  onAdd: (search: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const handleAdd = async () => {
    setLoading(true)
    await onAdd(kit.search)
    setLoading(false)
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <View style={[kc.card, { backgroundColor: kit.color, borderColor: kit.accent + '50' }]}>
      <Text style={kc.icon}>{kit.icon}</Text>
      <Text style={[kc.name, { color: kit.accent }]}>{kit.name}</Text>
      <Text style={kc.tagline}>{kit.tagline}</Text>
      <TouchableOpacity
        style={[kc.btn, { backgroundColor: kit.accent }, (loading || done) && { opacity: 0.75 }]}
        onPress={handleAdd}
        disabled={loading || done}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={kc.btnText}>{done ? '✓ Added!' : '+ Add to Cart'}</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const kc = StyleSheet.create({
  card: {
    width: 160, borderRadius: 16, padding: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  icon:    { fontSize: 28, marginBottom: 8 },
  name:    { fontSize: 13, fontWeight: '700', marginBottom: 4, lineHeight: 18 },
  tagline: { fontSize: 11, color: '#6b7280', lineHeight: 15, marginBottom: 10 },
  btn:     { borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})

// ── Compact product tile (horizontal scroll) ──────────────────────────
function ProductTile({ p, onPress, onAdd }: { p: Product; onPress: () => void; onAdd: () => void }) {
  const inStock = Number(p.stock || 0) > 0
  return (
    <TouchableOpacity style={pt.wrap} onPress={onPress} activeOpacity={0.85}>
      {p.image_url
        ? <Image source={{ uri: p.image_url }} style={pt.img} resizeMode="cover" />
        : <View style={pt.placeholder}><Text style={{ fontSize: 28 }}>📦</Text></View>
      }
      <Text style={pt.name} numberOfLines={2}>{p.name}</Text>
      <Text style={pt.price}>{formatCurrency(p.price)}</Text>
      <TouchableOpacity
        style={[pt.addBtn, !inStock && pt.addBtnDis]}
        onPress={onAdd} disabled={!inStock}
      >
        <Text style={pt.addBtnText}>{inStock ? '+ Add' : 'N/A'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ═══════════════════════════════════════════════════════════════════════
interface PastOrder {
  id: string
  created_at: string
  total: number
  order_items: { product_id: string; quantity: number; price_at_order: number; products: { name: string; image_url?: string } | null }[]
}

// ── Flash Sale countdown timer ────────────────────────────────────────
function useCountdown(targetHour: number) {
  const getRemaining = () => {
    const now = new Date()
    const end = new Date()
    end.setHours(targetHour, 0, 0, 0)
    if (end <= now) end.setDate(end.getDate() + 1)
    const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const sec = diff % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }
  const [time, setTime] = useState(getRemaining)
  useEffect(() => {
    const id = setInterval(() => setTime(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const [categories, setCategories] = useState<Category[]>([])
  const [products,   setProducts]   = useState<Product[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([])

  const count        = useCartStore(s => s.count)
  const addItem      = useCartStore(s => s.addItem)
  const recentItems  = useRecentlyViewedStore(s => s.items)
  const clearViewed  = useRecentlyViewedStore(s => s.clearViewed)
  const user         = useAuthStore(s => s.user)

  const [locationText, setLocationText] = useState('Detecting location…')
  const [locationLoading, setLocationLoading] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 19.215, longitude: 73.086,   // default: Dombivli
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  })
  const [confirmingMap, setConfirmingMap] = useState(false)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const [c, p] = await Promise.all([getCategories(), getProducts()])
      setCategories(c.data || [])
      setProducts(p.data || [])
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    detectLocation()
  }, [])

  useEffect(() => {
    if (!user) { setPastOrders([]); return }
    ;(async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, created_at, total, order_items(product_id, quantity, price_at_order, products(name, image_url))')
          .eq('user_id', user.id)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(4)
        setPastOrders((data || []) as unknown as PastOrder[])
      } catch {}
    })()
  }, [user])

  const detectLocation = async () => {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationText('📍 Set your location')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      // Centre the map on user's real GPS position
      setMapRegion(r => ({
        ...r,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }))
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      })
      if (place) {
        const parts = [place.name || place.street, place.subregion || place.city]
          .filter(Boolean)
        setLocationText(parts.join(', ') || place.city || 'Your location')
      }
    } catch {
      setLocationText('📍 Set your location')
    } finally {
      setLocationLoading(false)
    }
  }

  const handleLocationTap = async () => {
    // Request permission first so map is centred on user when modal opens
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setMapRegion(r => ({
          ...r,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }))
      } catch { /* use last known region */ }
    }
    setShowLocationModal(true)
  }

  // Called when user finishes panning the map — stores new centre
  const onRegionChange = useCallback((r: Region) => setMapRegion(r), [])

  // Reverse-geocode the map centre and save as delivery location
  const handleConfirmMapLocation = async () => {
    setConfirmingMap(true)
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      })
      if (place) {
        const parts = [place.name || place.street, place.subregion || place.city]
          .filter(Boolean)
        setLocationText(parts.join(', ') || place.city || 'Selected location')
      } else {
        setLocationText(`${mapRegion.latitude.toFixed(4)}, ${mapRegion.longitude.toFixed(4)}`)
      }
    } catch {
      setLocationText('Selected location')
    } finally {
      setConfirmingMap(false)
      setShowLocationModal(false)
    }
  }

  const flashCountdown = useCountdown(23) // ends at 11 PM
  const inStock = products.filter(p => Number(p.stock || 0) > 0)
  const flashDeals = products.filter(p => p.mrp && Number(p.mrp) > Number(p.price) && Number(p.stock || 0) > 0).slice(0, 8)

  // ── Navigation helpers ────────────────────────────────────────────
  // Navigate to Products tab, optionally filtered by category or search
  const goToProducts = (params?: { categorySlug?: string; categoryName?: string; search?: string }) => {
    navigation.navigate('Products', params ?? {})
  }

  // Navigate to a stack screen
  const goTo = (screen: keyof RootStackParamList, params?: object) =>
    (navigation as any).navigate(screen, params)

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0c64c0']} tintColor="#0c64c0" />
        }
      >
        {/* ══ 1. STICKY HEADER (darkest navy) ════════════════════════ */}
        <View style={s.stickyHeader}>
          {/* Top bar */}
          <View style={s.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.storeTitle}>1ShopStore</Text>
              <TouchableOpacity style={s.locationRow} onPress={handleLocationTap} activeOpacity={0.7}>
                {locationLoading
                  ? <ActivityIndicator size="small" color="#93c5fd" style={{ marginRight: 6 }} />
                  : <Text style={s.locationPin}>📍</Text>
                }
                <Text style={s.locationText} numberOfLines={1}>{locationText}</Text>
                <Text style={s.locationChevron}>⌄</Text>
              </TouchableOpacity>
            </View>
            <View style={s.topIcons}>
              {/* Cart icon → Cart tab */}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => navigation.navigate('Cart')}
              >
                <Text style={s.iconBtnIcon}>🛒</Text>
                {count > 0 && (
                  <View style={s.cartBadge}>
                    <Text style={s.cartBadgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Profile icon → Account tab */}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => navigation.navigate('Account')}
              >
                <Text style={s.iconBtnIcon}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar → dedicated SearchScreen with auto-focus */}
          <View style={s.searchBar}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => goTo('Search')}
              activeOpacity={0.85}
            >
              <Text style={s.searchIcon}>🔍</Text>
              <Text style={s.searchPlaceholder}>Search "wires, paint, pipes..."</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Search', { voice: true })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.searchMic}>🎤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ 2. CATEGORY TABS (medium navy) ══════════════════════════ */}
        {/* Tapping a category tab → Products screen filtered to that category */}
        <View style={s.tabsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabsList}
          >
            {/* "All" tab → Products with all filters cleared */}
            <TouchableOpacity
              style={s.tab}
              onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}
            >
              <Text style={s.tabIcon}>🏠</Text>
              <Text style={s.tabLabel}>All</Text>
            </TouchableOpacity>

            {/* Each category → Products filtered to that category */}
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={String(cat.id)}
                style={s.tab}
                onPress={() => goToProducts({ categorySlug: cat.slug, categoryName: cat.name })}
              >
                <Text style={s.tabIcon}>{getCatIcon(cat, i)}</Text>
                <Text style={s.tabLabel} numberOfLines={1}>
                  {cat.name.length > 10 ? cat.name.slice(0, 9) + '…' : cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ══ 3. FEATURED BANNERS (light blue bg) ═══════════════════ */}
        {/* Each banner → Products filtered by that banner's search term */}
        <View style={s.bannersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.bannersList}
            decelerationRate="fast"
            snapToInterval={W - 52}
            snapToAlignment="start"
          >
            {BANNERS.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[s.bannerCard, { backgroundColor: b.color }]}
                onPress={() => goToProducts({ search: b.search, categoryName: b.catName })}
                activeOpacity={0.9}
              >
                <View style={[s.bannerLabel, { backgroundColor: b.accent }]}>
                  <Text style={s.bannerLabelText}>{b.label}</Text>
                </View>
                <Text style={s.bannerTitle}>{b.title}</Text>
                <Text style={s.bannerSub}>{b.sub}</Text>
                <View style={s.bannerIconWrap}>
                  <Text style={s.bannerIcon}>{b.icon}</Text>
                </View>
                <View style={[s.bannerCta, { backgroundColor: b.accent }]}>
                  <Text style={s.bannerCtaText}>Shop Now →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ══ 4. CATEGORY ROW (light blue, horizontal scroll) ══════ */}
        {/* Each tile → Products filtered to that category */}
        <View style={s.catGridSection}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}>
              <Text style={s.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <CategoryRowSkeleton />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.catHorizontal}
            >
              <TouchableOpacity
                style={s.catTile}
                onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}
                activeOpacity={0.82}
              >
                <View style={s.catTileIconWrap}>
                  <Text style={s.catTileIcon}>🏠</Text>
                </View>
                <Text style={s.catTileName} numberOfLines={1}>All</Text>
              </TouchableOpacity>
              {categories.map((cat, i) => (
                <TouchableOpacity
                  key={String(cat.id)}
                  style={s.catTile}
                  onPress={() => goToProducts({ categorySlug: cat.slug, categoryName: cat.name })}
                  activeOpacity={0.82}
                >
                  <View style={s.catTileIconWrap}>
                    <Text style={s.catTileIcon}>{getCatIcon(cat, i)}</Text>
                  </View>
                  <Text style={s.catTileName} numberOfLines={1}>
                    {cat.name.length > 9 ? cat.name.slice(0, 8) + '…' : cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ══ 5. FEATURED PRODUCTS (white) ═════════════════════════ */}
        {/* Each product → ProductDetail; "View all" → Products */}
        {(loading || products.length > 0) && (
          <View style={s.productsSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Featured Products</Text>
              {!loading && (
                <TouchableOpacity onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}>
                  <Text style={s.seeAll}>View all →</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <HomeFeaturedSkeleton />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 20 }}
              >
                {products.slice(0, 8).map(p => (
                  <ProductTile
                    key={String(p.id)}
                    p={p}
                    onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                    onAdd={() => addItem(p)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ══ 5b. FLASH DEALS ══════════════════════════════════════ */}
        {flashDeals.length > 0 && (
          <View style={s.flashSection}>
            <View style={s.flashHeader}>
              <View style={s.flashTitleRow}>
                <Text style={s.flashTitle}>⚡ Flash Deals</Text>
                <View style={s.flashTimerPill}>
                  <Text style={s.flashTimerText}>Ends in {flashCountdown}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}>
                <Text style={s.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {flashDeals.map(p => {
                const disc = Math.round(((Number(p.mrp) - Number(p.price)) / Number(p.mrp)) * 100)
                return (
                  <TouchableOpacity
                    key={String(p.id)}
                    style={s.flashCard}
                    onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                    activeOpacity={0.88}
                  >
                    <View style={s.flashDiscBadge}><Text style={s.flashDiscText}>{disc}% OFF</Text></View>
                    {p.image_url
                      ? <Image source={{ uri: p.image_url }} style={s.flashImg} resizeMode="cover" />
                      : <View style={[s.flashImg, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 28 }}>📦</Text></View>
                    }
                    <View style={s.flashBody}>
                      <Text style={s.flashName} numberOfLines={2}>{p.name}</Text>
                      <View style={s.flashPriceRow}>
                        <Text style={s.flashPrice}>{formatCurrency(p.price)}</Text>
                        <Text style={s.flashMrp}>{formatCurrency(p.mrp)}</Text>
                      </View>
                      <TouchableOpacity style={s.flashAddBtn} onPress={() => addItem(p)}>
                        <Text style={s.flashAddBtnText}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* ══ 6. STATS STRIP (dark navy — contrast break) ══════════ */}
        <View style={s.statsStrip}>
          <TouchableOpacity style={s.statItem} onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}>
            <Text style={s.statNum}>{loading ? '—' : categories.length}</Text>
            <Text style={s.statLbl}>Categories</Text>
          </TouchableOpacity>
          <View style={s.statDot} />
          <TouchableOpacity style={s.statItem} onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })}>
            <Text style={s.statNum}>{loading ? '—' : products.length}</Text>
            <Text style={s.statLbl}>Products</Text>
          </TouchableOpacity>
          <View style={s.statDot} />
          <TouchableOpacity style={s.statItem} onPress={() => goToProducts({ search: '' })}>
            <Text style={s.statNum}>{loading ? '—' : inStock.length}</Text>
            <Text style={s.statLbl}>In Stock</Text>
          </TouchableOpacity>
        </View>

        {/* ══ 7. PROJECT KITS ══════════════════════════════════════ */}
        <View style={s.kitsSection}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Project Kits</Text>
            <Text style={s.sectionSubtitle}>Everything for a job — added in one tap</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 20 }}
          >
            {KITS.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                onAdd={async (search) => {
                  const res = await getProducts(undefined, search)
                  const inStockItems = (res.data || []).filter(p => Number(p.stock || 0) > 0).slice(0, 5)
                  if (inStockItems.length === 0) {
                    Alert.alert('No items in stock', 'None of the kit items are currently in stock.')
                    return
                  }
                  inStockItems.forEach(p => addItem(p))
                  Alert.alert(`${kit.name} Added!`, `${inStockItems.length} item${inStockItems.length > 1 ? 's' : ''} added to your cart.`)
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* ══ 8. FREE DELIVERY BANNER ══════════════════════════════ */}
        <View style={s.freeDeliveryBanner}>
          <Text style={s.freeDeliveryIcon}>🛵</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.freeDeliveryTitle}>Get FREE delivery</Text>
            <Text style={s.freeDeliverySub}>on your order above ₹500</Text>
          </View>
          <TouchableOpacity onPress={() => goToProducts({ categorySlug: '', categoryName: '', search: '' })} style={s.freeDeliveryBtn}>
            <Text style={s.freeDeliveryBtnText}>Shop →</Text>
          </TouchableOpacity>
        </View>

        {/* ══ 9. TECHNICIAN PROMO ══════════════════════════════════ */}
        {/* Each service tile → Services screen for that type */}
        <View style={s.techPromo}>
          <Text style={s.techPromoTitle}>🛠️ Need a Technician?</Text>
          <Text style={s.techPromoSub}>
            Book an electrician, plumber or painter. ₹200 visiting charge, same-day availability.
          </Text>
          <View style={s.techPromoServices}>
            {([
              { icon: '⚡', label: 'Electrician', type: 'electrical' as const, color: '#1565c0', bg: '#e8f1fb' },
              { icon: '🔧', label: 'Plumber',     type: 'plumbing'   as const, color: '#00695c', bg: '#e0f5f5' },
              { icon: '🎨', label: 'Painter',     type: 'painting'   as const, color: '#e65100', bg: '#fff8e1' },
            ] as const).map(svc => (
              <TouchableOpacity
                key={svc.type}
                style={[s.techSvcBtn, { backgroundColor: svc.bg }]}
                onPress={() => goTo('Services', { type: svc.type })}
              >
                <Text style={{ fontSize: 22 }}>{svc.icon}</Text>
                <Text style={[s.techSvcLabel, { color: svc.color }]}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ══ 10. RECENTLY VIEWED ══════════════════════════════════ */}
        {recentItems.length > 0 && (
          <View style={s.recentSection}>
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionTitle}>Recently Viewed</Text>
                <Text style={s.sectionSubtitle}>Pick up where you left off</Text>
              </View>
              <TouchableOpacity onPress={clearViewed}>
                <Text style={s.recentClear}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 20 }}
            >
              {recentItems.slice(0, 10).map(p => (
                <TouchableOpacity
                  key={String(p.id)}
                  style={s.recentCard}
                  onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                  activeOpacity={0.88}
                >
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={s.recentImage} resizeMode="cover" />
                  ) : (
                    <View style={s.recentPlaceholder}>
                      <Text style={{ fontSize: 24 }}>📦</Text>
                    </View>
                  )}
                  <View style={s.recentBody}>
                    <Text style={s.recentName} numberOfLines={2}>{p.name}</Text>
                    <Text style={s.recentPrice}>{formatCurrency(p.price)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ══ 11. ORDER AGAIN ══════════════════════════════════════ */}
        {pastOrders.length > 0 && (
          <View style={s.orderAgainSection}>
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionTitle}>Order Again</Text>
                <Text style={s.sectionSubtitle}>Quick reorder from your recent orders</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={s.seeAll}>All orders →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 20 }}
            >
              {pastOrders.map(order => {
                const firstItem = order.order_items?.[0]
                const img = firstItem?.products?.image_url
                const name = firstItem?.products?.name ?? 'Order'
                const extra = (order.order_items?.length ?? 1) - 1
                return (
                  <View key={order.id} style={s.orderAgainCard}>
                    {img ? (
                      <Image source={{ uri: img }} style={s.orderAgainImg} resizeMode="cover" />
                    ) : (
                      <View style={s.orderAgainImgPlaceholder}><Text style={{ fontSize: 24 }}>📦</Text></View>
                    )}
                    <Text style={s.orderAgainName} numberOfLines={2}>{name}{extra > 0 ? ` +${extra} more` : ''}</Text>
                    <Text style={s.orderAgainTotal}>{formatCurrency(order.total)}</Text>
                    <TouchableOpacity
                      style={s.orderAgainBtn}
                      onPress={() => navigation.navigate('Orders')}
                    >
                      <Text style={s.orderAgainBtnText}>🔄 Reorder</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Location Map Picker Modal ───────────────────────────── */}
      <Modal visible={showLocationModal} animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
        <View style={{ flex: 1 }}>
          {/* Map fills the screen — falls back to a placeholder in Expo Go */}
          {MapView ? (
            <MapView
              style={{ flex: 1 }}
              region={mapRegion}
              onRegionChangeComplete={onRegionChange}
              showsUserLocation
              showsMyLocationButton={false}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f0fe' }}>
              <Text style={{ fontSize: 40 }}>🗺️</Text>
              <Text style={{ marginTop: 12, color: '#555', textAlign: 'center', paddingHorizontal: 32 }}>
                Map not available in Expo Go.{'\n'}Use the GPS button below to set your location.
              </Text>
            </View>
          )}

          {/* Fixed centre-pin overlay */}
          <View style={s.mapPinWrap} pointerEvents="none">
            <Text style={s.mapPinEmoji}>📍</Text>
            <View style={s.mapPinShadow} />
          </View>

          {/* Top bar — title + close */}
          <View style={s.mapTopBar}>
            <TouchableOpacity style={s.mapCloseBtn} onPress={() => setShowLocationModal(false)}>
              <Text style={s.mapCloseTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={s.mapTopTitle}>Choose Delivery Location</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* GPS re-centre button */}
          <TouchableOpacity style={s.mapGpsBtn} onPress={async () => {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status !== 'granted') return
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            setMapRegion(r => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
          }}>
            <Text style={s.mapGpsTxt}>🎯</Text>
          </TouchableOpacity>

          {/* Bottom confirm card */}
          <View style={s.mapBottomCard}>
            <Text style={s.mapBottomHint}>Move the map to set your delivery pin</Text>
            <TouchableOpacity
              style={s.mapConfirmBtn}
              onPress={handleConfirmMapLocation}
              disabled={confirmingMap}
            >
              {confirmingMap
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.mapConfirmTxt}>✓  Confirm this Location</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Product tile styles ───────────────────────────────────────────────
const pt = StyleSheet.create({
  wrap: {
    width: 140, backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  img: { width: 140, height: 110, backgroundColor: '#f3f4f6' },
  placeholder: {
    width: 140, height: 100, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 12, fontWeight: '600', color: '#111827', padding: 8, paddingBottom: 4, lineHeight: 17 },
  price: { fontSize: 13, fontWeight: '700', color: '#111827', paddingHorizontal: 8, paddingBottom: 6 },
  addBtn: {
    margin: 8, marginTop: 0, backgroundColor: C.accent,
    borderRadius: 8, paddingVertical: 6, alignItems: 'center',
  },
  addBtnDis: { backgroundColor: '#e5e7eb' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})

// ── Main screen styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },

  // 1. Sticky header
  stickyHeader: { backgroundColor: C.navy1, paddingBottom: 12 },
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
  },
  storeTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationPin: { fontSize: 13 },
  locationText: { fontSize: 13, color: '#93c5fd', fontWeight: '500', flex: 1 },
  locationChevron: { fontSize: 14, color: '#93c5fd', marginLeft: 2 },
  topIcons: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingTop: 4 },
  iconBtn: { position: 'relative', padding: 6 },
  iconBtnIcon: { fontSize: 22 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 18, height: 18, backgroundColor: '#ef4444',
    borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchPlaceholder: { flex: 1, fontSize: 14, color: '#9ca3af' },
  searchMic: { fontSize: 18 },

  // 2. Category tabs
  tabsSection: { backgroundColor: C.navy2, paddingBottom: 0 },
  tabsList: { paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  tab: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  tabIcon: { fontSize: 20, marginBottom: 4 },
  tabLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // 3. Featured banners
  bannersSection: { backgroundColor: C.blue1, paddingVertical: 16 },
  bannersList: { paddingHorizontal: 16, gap: 12 },
  bannerCard: { width: W - 56, borderRadius: 18, padding: 20, overflow: 'hidden', position: 'relative' },
  bannerLabel: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10,
  },
  bannerLabelText: { fontSize: 10, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, lineHeight: 28 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16, lineHeight: 18 },
  bannerIconWrap: { position: 'absolute', right: 20, top: 20 },
  bannerIcon: { fontSize: 56, opacity: 0.35 },
  bannerCta: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  bannerCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // 4. Category row (horizontal scroll)
  catGridSection: {
    backgroundColor: C.blue2,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16,
  },
  catHorizontal: { gap: 10, paddingRight: 8 },
  catTile: { alignItems: 'center', width: 72 },
  catTileIconWrap: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  catTileIcon: { fontSize: 24 },
  catTileName: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 14 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  sectionSubtitle: { fontSize: 12, color: '#6b7280' },
  seeAll: { fontSize: 13, color: C.accent, fontWeight: '600' },

  // 5. Products section
  productsSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 20,
  },

  // 6. Stats strip
  statsStrip: {
    flexDirection: 'row', backgroundColor: C.navy1,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  statLbl: { fontSize: 11, color: '#93c5fd', fontWeight: '500' },
  statDot: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  // 7. Project kits
  kitsSection: {
    backgroundColor: '#f8faff',
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24,
  },
  kitCard: { width: 185, borderRadius: 16, padding: 16, borderWidth: 1 },
  kitIcon: { fontSize: 30, marginBottom: 10 },
  kitName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  kitTagline: { fontSize: 11, color: '#555', lineHeight: 16, marginBottom: 14 },
  kitExplore: { fontSize: 12, fontWeight: '700' },

  // 8. Free delivery
  freeDeliveryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#eff6ff', margin: 16, marginTop: 0,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#bfdbfe',
  },
  freeDeliveryIcon: { fontSize: 28 },
  freeDeliveryTitle: { fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 2 },
  freeDeliverySub: { fontSize: 12, color: '#3b82f6' },
  freeDeliveryBtn: {
    backgroundColor: C.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  freeDeliveryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // 9. Technician promo
  techPromo: {
    margin: 16, marginTop: 0, backgroundColor: '#fff',
    borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  techPromoTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 6 },
  techPromoSub: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 16 },
  techPromoServices: { flexDirection: 'row', gap: 10 },
  techSvcBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  techSvcLabel: { fontSize: 12, fontWeight: '700' },

  // Map location picker
  mapTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.navy1, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
  },
  mapCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapCloseTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  mapTopTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  mapPinWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  mapPinEmoji: { fontSize: 40, marginBottom: -6 },
  mapPinShadow: {
    width: 12, height: 6, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mapGpsBtn: {
    position: 'absolute', right: 16, bottom: 160,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  mapGpsTxt: { fontSize: 22 },
  mapBottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 10,
  },
  mapBottomHint: {
    fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 14,
  },
  mapConfirmBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  mapConfirmTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Recently Viewed ──────────────────────────────────────────────
  recentSection: { paddingLeft: 20, paddingTop: 4, paddingBottom: 8 },
  recentClear:   { fontSize: 13, color: '#9ca3af', paddingRight: 20 },
  recentCard: {
    width: 130, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  recentImage:       { width: 130, height: 90, backgroundColor: '#f3f4f6' },
  recentPlaceholder: { width: 130, height: 90, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  recentBody:  { padding: 8 },
  recentName:  { fontSize: 12, fontWeight: '500', color: '#374151', lineHeight: 16, marginBottom: 4 },
  recentPrice: { fontSize: 13, fontWeight: '700', color: '#111827' },

  orderAgainSection: { paddingLeft: 20, paddingTop: 4, paddingBottom: 8 },
  orderAgainCard: {
    width: 150, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  orderAgainImg: { width: 150, height: 100, backgroundColor: '#f3f4f6' },
  orderAgainImgPlaceholder: { width: 150, height: 100, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  orderAgainName:  { fontSize: 12, fontWeight: '500', color: '#374151', padding: 8, paddingBottom: 2, lineHeight: 16 },
  orderAgainTotal: { fontSize: 13, fontWeight: '700', color: '#111827', paddingHorizontal: 8, marginBottom: 6 },
  orderAgainBtn: { margin: 8, marginTop: 0, backgroundColor: '#eff6ff', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  orderAgainBtnText: { fontSize: 12, fontWeight: '700', color: '#0c64c0' },

  flashSection: { marginTop: 8, marginBottom: 8 },
  flashHeader: { paddingHorizontal: 20, marginBottom: 12 },
  flashTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flashTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  flashTimerPill: { backgroundColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  flashTimerText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  flashCard: {
    width: 150, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, marginLeft: 12,
  },
  flashDiscBadge: { position: 'absolute', top: 8, left: 8, zIndex: 1, backgroundColor: '#ef4444', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  flashDiscText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  flashImg: { width: 150, height: 110, backgroundColor: '#f3f4f6' },
  flashBody: { padding: 8 },
  flashName: { fontSize: 12, fontWeight: '500', color: '#374151', lineHeight: 16, marginBottom: 4 },
  flashPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  flashPrice: { fontSize: 14, fontWeight: '800', color: '#111827' },
  flashMrp: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  flashAddBtn: { backgroundColor: '#0c64c0', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  flashAddBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
})
