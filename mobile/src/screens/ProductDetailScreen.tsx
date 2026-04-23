import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, FlatList,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  Dimensions, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native'

const { width: SCREEN_W } = Dimensions.get('window')
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getProduct, getProducts, getProductReviews, getProductReviewSummary, submitReview, deleteReview, getProductVariants, Product, Review, ReviewSummary, ProductVariant } from '../api'
import useCartStore from '../store/cartStore'
import useWishlistStore from '../store/wishlistStore'
import useAuthStore from '../store/authStore'
import useRecentlyViewedStore from '../store/recentlyViewedStore'
import DeliveryEstimate from '../components/DeliveryEstimate'
import { formatCurrency, calcDiscount } from '../lib/currency'
import { RootStackParamList } from '../navigation'

type Route = RouteProp<RootStackParamList, 'ProductDetail'>
type Nav   = NativeStackNavigationProp<RootStackParamList>

// ── Return policy ──────────────────────────────────────────────────
const RETURN_POLICIES = [
  {
    match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i,
    icon: '⚡', title: 'Electricals — Exchange only',
    lines: ['Non-returnable once installed or packaging opened.', 'Manufacturing defects exchangeable within 7 days.', 'Bring unused in original packaging for exchange.'],
  },
  {
    match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i,
    icon: '🔧', title: 'Plumbing — Exchange only',
    lines: ['Non-returnable once fitted or sealed packaging opened.', 'Manufacturing defects exchangeable within 7 days.', 'Physical damage during installation not covered.'],
  },
  {
    match: /paint|primer|putty|varnish|enamel|wood finish/i,
    icon: '🎨', title: 'Paints & Finishes — No returns',
    lines: ['Paints cannot be returned once opened.', 'Verify shade before use — custom tints are final.', 'Contact us within 24 hrs of delivery for supply issues.'],
  },
  {
    match: /tool|drill|saw|hammer|screw|nut|bolt|fastener|anchor/i,
    icon: '🛠️', title: 'Tools & Hardware — 7-day exchange',
    lines: ['Exchange within 7 days for manufacturing defects.', 'Original packaging must be included.', 'Items with signs of use/damage not eligible.'],
  },
]
const DEFAULT_POLICY = {
  icon: '🔄', title: '7-day exchange on defects',
  lines: ['Items can be exchanged within 7 days for manufacturing defects.', 'Proof of purchase required. Contact us via WhatsApp.'],
}

// ── Service combo match ────────────────────────────────────────────
const SERVICE_MAP = [
  { match: /electric|wire|cable|switch|socket|mcb|breaker|light|led|fan|fitting/i, type: 'electrical' as const, icon: '⚡', label: 'Electrician', color: '#1565c0', bg: '#e8f1fb' },
  { match: /pipe|tap|fitting|plumb|sanit|basin|toilet|valve/i,                    type: 'plumbing'   as const, icon: '🔧', label: 'Plumber',      color: '#00695c', bg: '#e0f5f5' },
  { match: /paint|primer|putty|varnish|enamel|wood finish/i,                      type: 'painting'   as const, icon: '🎨', label: 'Painter',      color: '#e65100', bg: '#fff8e1' },
]

// ── Image Gallery ─────────────────────────────────────────────────
function ImageGallery({ images, onTap }: { images: string[]; onTap: (idx: number) => void }) {
  const [active, setActive] = useState(0)
  const listRef = useRef<FlatList>(null)

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    setActive(idx)
  }

  if (images.length === 0) {
    return (
      <View style={gStyles.placeholder}>
        <Text style={{ fontSize: 64 }}>📦</Text>
      </View>
    )
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => onTap(index)}>
            <Image source={{ uri: item }} style={gStyles.image} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />

      {/* Dots */}
      {images.length > 1 && (
        <View style={gStyles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[gStyles.dot, i === active && gStyles.dotActive]} />
          ))}
        </View>
      )}

      {/* Counter badge */}
      {images.length > 1 && (
        <View style={gStyles.counter}>
          <Text style={gStyles.counterText}>{active + 1}/{images.length}</Text>
        </View>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={gStyles.thumbStrip} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          {images.map((uri, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                listRef.current?.scrollToIndex({ index: i, animated: true })
                setActive(i)
              }}
            >
              <Image
                source={{ uri }}
                style={[gStyles.thumb, i === active && gStyles.thumbActive]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ── Full-screen zoom modal ─────────────────────────────────────────
function ZoomModal({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: startIndex, animated: false })
    }, 50)
  }, [startIndex])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    setCurrent(idx)
  }

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width: SCREEN_W }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Image
                source={{ uri: item }}
                style={{ width: SCREEN_W, height: SCREEN_W }}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        />

        {/* Close */}
        <TouchableOpacity style={gStyles.zoomClose} onPress={onClose}>
          <Text style={gStyles.zoomCloseText}>✕</Text>
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={gStyles.zoomCounter}>
            <Text style={gStyles.zoomCounterText}>{current + 1} / {images.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const gStyles = StyleSheet.create({
  placeholder: { height: 280, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  image:       { width: SCREEN_W, height: 300, backgroundColor: '#f3f4f6' },
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 8 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d1d5db' },
  dotActive:   { backgroundColor: '#0c64c0', width: 18 },
  counter: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  thumbStrip:  { marginTop: 10, marginBottom: 4 },
  thumb:       { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: '#0c64c0' },
  zoomClose: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomCloseText:   { color: '#fff', fontSize: 18, fontWeight: '700' },
  zoomCounter:     { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  zoomCounterText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})

// ── Star display ───────────────────────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = rating >= i
        const half   = !filled && rating >= i - 0.5
        return (
          <Text key={i} style={{ fontSize: size, color: filled || half ? '#f59e0b' : '#d1d5db' }}>
            {filled ? '★' : half ? '⯨' : '☆'}
          </Text>
        )
      })}
    </View>
  )
}

// ── Interactive star picker ────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 12 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 36, color: value >= i ? '#f59e0b' : '#d1d5db' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── Helpers ────────────────────────────────────────────────────────
const ratingLabel = (r: number) => ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][r] ?? ''

const formatReviewDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ProductDetailScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const user       = useAuthStore(s => s.user)
  const [product, setProduct]     = useState<Product | null>(null)
  const [related, setRelated]     = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [added, setAdded]         = useState(false)
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)

  // Reviews state
  const [summary, setSummary]         = useState<ReviewSummary | null>(null)
  const [reviews, setReviews]         = useState<Review[]>([])
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)

  // Variants
  const [variants, setVariants]               = useState<ProductVariant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  // Write review modal
  const [modalVisible, setModalVisible] = useState(false)
  const [draftRating, setDraftRating]   = useState(0)
  const [draftText, setDraftText]       = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const addItem      = useCartStore(s => s.addItem)
  const toggleWish   = useWishlistStore(s => s.toggle)
  const isWishlisted = useWishlistStore(s => product ? s.isWishlisted(product.id) : false)
  const addViewed    = useRecentlyViewedStore(s => s.addViewed)
  const insets       = useSafeAreaInsets()

  const loadReviews = useCallback((productId: string | number) => {
    setReviewsLoading(true)
    Promise.all([
      getProductReviewSummary(productId),
      getProductReviews(productId),
    ])
      .then(([sumRes, revRes]) => {
        setSummary(sumRes.data)
        setReviews(revRes.data)
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    setRelated([])
    setSummary(null)
    setReviews([])
    setVariants([])
    setSelectedVariant(null)
    getProduct(route.params.id)
      .then(res => {
        setProduct(res.data)
        const slug = (res.data as unknown as { category_slug?: string }).category_slug
        if (slug) {
          getProducts(slug).then(r => {
            setRelated((r.data || []).filter(p => String(p.id) !== String(route.params.id)).slice(0, 6))
          })
        }
        loadReviews(res.data.id)
        addViewed(res.data)
        getProductVariants(res.data.id).then(vRes => {
          if (vRes.data.length > 0) {
            setVariants(vRes.data)
            setSelectedVariant(vRes.data[0])
          }
        }).catch(() => {})
      })
      .catch(() => Alert.alert('Error', 'Could not load product.'))
      .finally(() => setLoading(false))
  }, [route.params.id, loadReviews])

  const handleSubmitReview = async () => {
    if (!user) { navigation.navigate('Login'); return }
    if (draftRating === 0) { Alert.alert('Select a rating', 'Please tap a star before submitting.'); return }
    setSubmitting(true)
    try {
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      await submitReview(product!.id, {
        user_id: user.id,
        rating: draftRating,
        review_text: draftText.trim() || undefined,
        reviewer_name: name,
      })
      setModalVisible(false)
      setDraftRating(0)
      setDraftText('')
      loadReviews(product!.id)
    } catch {
      Alert.alert('Error', 'Could not submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReview = (review: Review) => {
    if (!user) return
    Alert.alert('Delete Review', 'Remove your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteReview(product!.id, review.id, user.id).catch(() => {})
          loadReviews(product!.id)
        },
      },
    ])
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" /></View>
  if (!product) return <View style={styles.centered}><Text style={styles.errorText}>Product not found.</Text></View>

  const activePrice = selectedVariant ? selectedVariant.price : product.price
  const activeMrp   = selectedVariant ? (selectedVariant.mrp ?? product.mrp) : product.mrp
  const activeStock = selectedVariant ? selectedVariant.stock : Number(product.stock || 0)

  const discount = calcDiscount(activeMrp, activePrice)
  const inStock  = activeStock > 0
  const catName  = (product as unknown as { categories?: { name: string } }).categories?.name || ''
  const policy   = RETURN_POLICIES.find(p => p.match.test(catName)) || DEFAULT_POLICY
  const svc      = SERVICE_MAP.find(s => s.match.test(catName))

  const handleAdd = () => {
    if (variants.length > 0 && !selectedVariant) {
      Alert.alert('Select a variant', 'Please choose an option before adding to cart.')
      return
    }
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: activePrice,
      mrp: activeMrp,
      image_url: product.image_url,
      brand: product.brand,
      spec: selectedVariant ? `${selectedVariant.attribute_name}: ${selectedVariant.value}` : (product as unknown as { spec?: string }).spec,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant ? `${selectedVariant.attribute_name}: ${selectedVariant.value}` : undefined,
      categories: (product as unknown as { categories?: { name: string } }).categories,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const myReview    = reviews.find(r => r.user_id === user?.id)
  const displayReviews = showAllReviews ? reviews : reviews.slice(0, 3)

  // Build image list: prefer images[] array, fall back to image_url
  const imageList: string[] = (
    product.images && product.images.length > 0
      ? product.images
      : product.image_url
        ? [product.image_url]
        : []
  )

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <ImageGallery images={imageList} onTap={idx => setZoomIndex(idx)} />

        <View style={styles.body}>
          {catName ? <Text style={styles.category}>{catName}</Text> : null}
          {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}
          <Text style={styles.name}>{product.name}</Text>

          {/* Spec badge */}
          {(product as unknown as { spec?: string }).spec ? (
            <View style={styles.specBadge}>
              <Text style={styles.specText}>{(product as unknown as { spec?: string }).spec}</Text>
            </View>
          ) : null}

          {/* Rating inline summary (below name) */}
          {summary && summary.count > 0 ? (
            <TouchableOpacity
              style={styles.ratingInline}
              onPress={() => setShowAllReviews(true)}
              activeOpacity={0.7}
            >
              <Stars rating={summary.avg} size={15} />
              <Text style={styles.ratingAvgText}>{summary.avg}</Text>
              <Text style={styles.ratingCountText}>({summary.count} {summary.count === 1 ? 'review' : 'reviews'})</Text>
            </TouchableOpacity>
          ) : null}

          {/* Variant picker */}
          {variants.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={styles.variantLabel}>{variants[0].attribute_name}:</Text>
              <View style={styles.variantChips}>
                {variants.map(v => {
                  const isSelected = selectedVariant?.id === v.id
                  const outOfStock = v.stock <= 0
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.variantChip,
                        isSelected && styles.variantChipSelected,
                        outOfStock && styles.variantChipOos,
                      ]}
                      onPress={() => !outOfStock && setSelectedVariant(v)}
                      disabled={outOfStock}
                    >
                      <Text style={[
                        styles.variantChipText,
                        isSelected && styles.variantChipTextSelected,
                        outOfStock && styles.variantChipTextOos,
                      ]}>
                        {v.value}
                      </Text>
                      {outOfStock && <Text style={styles.variantOosTag}> (OOS)</Text>}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          {/* Price row */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(activePrice)}</Text>
            {discount > 0 && (
              <>
                <Text style={styles.mrp}>{formatCurrency(activeMrp)}</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>{discount}% off</Text></View>
              </>
            )}
          </View>

          {/* Delivery estimate */}
          <DeliveryEstimate compact />

          {/* Description */}
          {product.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>About this product</Text>
              <Text style={styles.desc}>{product.description}</Text>
            </View>
          ) : null}

          {/* Service combo CTA */}
          {svc ? (
            <TouchableOpacity
              style={[styles.svcCta, { backgroundColor: svc.bg, borderColor: svc.color }]}
              onPress={() => navigation.navigate('Services', { type: svc.type, fromCart: false })}
            >
              <Text style={{ fontSize: 24 }}>{svc.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.svcCtaTitle, { color: svc.color }]}>Need a {svc.label}?</Text>
                <Text style={styles.svcCtaDesc}>We can install or fit this product for you. Book now →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Return policy */}
          <View style={styles.policyBox}>
            <Text style={styles.policyTitle}>{policy.icon} {policy.title}</Text>
            {policy.lines.map((line, i) => (
              <Text key={i} style={styles.policyLine}>• {line}</Text>
            ))}
          </View>

          {/* ── Ratings & Reviews section ── */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => {
                  if (!user) { navigation.navigate('Login'); return }
                  setDraftRating(myReview?.rating ?? 0)
                  setDraftText(myReview?.review_text ?? '')
                  setModalVisible(true)
                }}
              >
                <Text style={styles.writeReviewText}>{myReview ? 'Edit Review' : '+ Write Review'}</Text>
              </TouchableOpacity>
            </View>

            {reviewsLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} />
            ) : summary && summary.count > 0 ? (
              <>
                {/* Summary card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryLeft}>
                    <Text style={styles.avgNumber}>{summary.avg}</Text>
                    <Stars rating={summary.avg} size={18} />
                    <Text style={styles.summaryCount}>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</Text>
                  </View>
                  <View style={styles.summaryBars}>
                    {[5, 4, 3, 2, 1].map(star => {
                      const cnt = summary.dist[star as keyof typeof summary.dist] ?? 0
                      const pct = summary.count > 0 ? (cnt / summary.count) * 100 : 0
                      return (
                        <View key={star} style={styles.barRow}>
                          <Text style={styles.barLabel}>{star}★</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: pct > 0 ? '#f59e0b' : '#e5e7eb' }]} />
                          </View>
                          <Text style={styles.barCount}>{cnt}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>

                {/* Review list */}
                {displayReviews.map(review => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{(review.reviewer_name || 'U')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Stars rating={review.rating} size={12} />
                          <Text style={styles.reviewLabel}>{ratingLabel(review.rating)}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
                        {review.user_id === user?.id && (
                          <TouchableOpacity onPress={() => handleDeleteReview(review)}>
                            <Text style={{ fontSize: 11, color: '#ef4444' }}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {review.review_text ? (
                      <Text style={styles.reviewText}>{review.review_text}</Text>
                    ) : null}
                  </View>
                ))}

                {reviews.length > 3 && (
                  <TouchableOpacity
                    style={styles.seeAllBtn}
                    onPress={() => setShowAllReviews(v => !v)}
                  >
                    <Text style={styles.seeAllText}>
                      {showAllReviews ? 'Show less' : `See all ${reviews.length} reviews`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.noReviews}>
                <Text style={styles.noReviewsEmoji}>⭐</Text>
                <Text style={styles.noReviewsTitle}>No reviews yet</Text>
                <Text style={styles.noReviewsSub}>Be the first to review this product</Text>
              </View>
            )}
          </View>
        </View>

        {/* Related Products */}
        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>You may also like</Text>
            <FlatList
              data={related}
              keyExtractor={p => String(p.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.relatedCard}
                  onPress={() => navigation.replace('ProductDetail', { id: item.id })}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.relatedImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.relatedPlaceholder}><Text style={{ fontSize: 24 }}>📦</Text></View>
                  )}
                  <Text style={styles.relatedName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.relatedPrice}>{formatCurrency(item.price)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Footer CTA */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
          <TouchableOpacity
            style={[styles.wishBtn, isWishlisted && styles.wishBtnActive]}
            onPress={() => toggleWish(product)}
          >
            <Text style={styles.wishBtnIcon}>{isWishlisted ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, (!inStock || added) && styles.addBtnDone]}
            onPress={handleAdd}
            disabled={!inStock || added}
          >
            <Text style={styles.addBtnText}>
              {added ? '✓ Added to cart' : inStock ? 'Add to cart' : 'Out of stock'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Full-screen zoom modal ── */}
      {zoomIndex !== null && (
        <ZoomModal images={imageList} startIndex={zoomIndex} onClose={() => setZoomIndex(null)} />
      )}

      {/* ── Write / Edit Review Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{myReview ? 'Edit Your Review' : 'Write a Review'}</Text>
            <Text style={styles.modalProductName} numberOfLines={1}>{product.name}</Text>

            <StarPicker value={draftRating} onChange={setDraftRating} />
            {draftRating > 0 && (
              <Text style={styles.ratingLabelText}>{ratingLabel(draftRating)}</Text>
            )}

            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience (optional)..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              value={draftText}
              onChangeText={setDraftText}
            />
            <Text style={styles.charCount}>{draftText.length}/500</Text>

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || draftRating === 0) && styles.submitBtnDisabled]}
              onPress={handleSubmitReview}
              disabled={submitting || draftRating === 0}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>{myReview ? 'Update Review' : 'Submit Review'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#6b7280', fontSize: 16 },
  image: { width: '100%', height: 280, backgroundColor: '#f3f4f6' },
  imagePlaceholder: { height: 200, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  category: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  brand:    { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  name:     { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8, lineHeight: 30 },
  specBadge: { alignSelf: 'flex-start', backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  specText:  { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  // Inline rating (below name)
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  ratingAvgText: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  ratingCountText: { fontSize: 13, color: '#6b7280' },

  variantSection: { marginBottom: 14 },
  variantLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  variantChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
  },
  variantChipSelected: { borderColor: '#0c64c0', backgroundColor: '#eff6ff' },
  variantChipOos: { borderColor: '#e5e7eb', backgroundColor: '#f9fafb', opacity: 0.5 },
  variantChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  variantChipTextSelected: { color: '#0c64c0' },
  variantChipTextOos: { color: '#9ca3af' },
  variantOosTag: { fontSize: 11, color: '#9ca3af' },

  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  price:  { fontSize: 24, fontWeight: '700', color: '#111827' },
  mrp:    { fontSize: 16, color: '#9ca3af', textDecorationLine: 'line-through' },
  badge:  { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  descSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 20, marginBottom: 20 },
  descTitle:   { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  desc:        { fontSize: 14, color: '#6b7280', lineHeight: 22 },
  svcCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  svcCtaTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  svcCtaDesc:  { fontSize: 12, color: '#555' },
  policyBox: { backgroundColor: '#f8fafb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e4eaf0', marginBottom: 24 },
  policyTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  policyLine:  { fontSize: 13, color: '#6b7280', marginBottom: 4, lineHeight: 20 },

  // ── Reviews section ──────────────────────────────────────────────
  reviewsSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 20 },
  reviewsHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle:   { fontSize: 18, fontWeight: '700', color: '#111827' },
  writeReviewBtn: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  writeReviewText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },

  // Summary card
  summaryCard: { flexDirection: 'row', backgroundColor: '#fffbeb', borderRadius: 14, padding: 16, marginBottom: 16, gap: 20 },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  avgNumber:   { fontSize: 40, fontWeight: '800', color: '#92400e', lineHeight: 46 },
  summaryCount: { fontSize: 12, color: '#78716c', marginTop: 4 },
  summaryBars: { flex: 1, gap: 5, justifyContent: 'center' },
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 11, color: '#6b7280', width: 20, textAlign: 'right' },
  barBg:    { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  barCount: { fontSize: 11, color: '#6b7280', width: 18 },

  // Review card
  reviewCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  reviewTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0c2d5e',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  reviewLabel:  { fontSize: 11, color: '#92400e', fontWeight: '600' },
  reviewDate:   { fontSize: 11, color: '#9ca3af' },
  reviewText:   { fontSize: 14, color: '#374151', lineHeight: 21 },

  seeAllBtn: { alignItems: 'center', paddingVertical: 12 },
  seeAllText: { fontSize: 14, color: '#0c64c0', fontWeight: '600' },

  noReviews:      { alignItems: 'center', paddingVertical: 28 },
  noReviewsEmoji: { fontSize: 36, marginBottom: 8 },
  noReviewsTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  noReviewsSub:   { fontSize: 13, color: '#9ca3af', marginTop: 4 },

  footer: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 20 },
  wishBtn: {
    width: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  wishBtnActive: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  wishBtnIcon: { fontSize: 22 },
  addBtn: { flex: 1, backgroundColor: '#0c64c0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addBtnDone: { backgroundColor: '#16a34a' },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  relatedSection: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  relatedTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  relatedCard: {
    width: 140, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  relatedImage: { width: 140, height: 100, backgroundColor: '#f3f4f6' },
  relatedPlaceholder: { width: 140, height: 100, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  relatedName:  { fontSize: 12, color: '#374151', fontWeight: '500', padding: 8, paddingBottom: 4, lineHeight: 17 },
  relatedPrice: { fontSize: 13, fontWeight: '700', color: '#111827', paddingHorizontal: 8, paddingBottom: 10 },

  // ── Write review modal ────────────────────────────────────────────
  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 12,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalProductName: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 4 },
  ratingLabelText: { textAlign: 'center', fontSize: 15, color: '#92400e', fontWeight: '600', marginBottom: 8 },
  reviewInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#111827',
    minHeight: 100, textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4, marginBottom: 12 },
  submitBtn: { backgroundColor: '#0c64c0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
