import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Linking,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import { RootStackParamList } from '../navigation'
import { BookingCardSkeleton } from '../components/Skeleton'

const RATING_TAGS = ['Professional', 'On time', 'Clean work', 'Friendly', 'Skilled', 'Great value']

function RatingModal({ booking, userId, onClose, onDone }: {
  booking: { id: string; service_type: string; technicians?: { name: string } | null }
  userId: string
  onClose: () => void
  onDone: () => void
}) {
  const [stars, setStars]       = useState(0)
  const [tags, setTags]         = useState<string[]>([])
  const [review, setReview]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const submit = async () => {
    if (stars === 0) { Alert.alert('Select a rating'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('service_reviews').upsert({
        booking_id:   booking.id,
        user_id:      userId,
        rating:       stars,
        tags:         tags,
        review_text:  review.trim() || null,
      }, { onConflict: 'booking_id' })
      if (error) throw error
      onDone()
    } catch {
      Alert.alert('Error', 'Could not submit rating. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={rm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={rm.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={rm.sheet}>
          <View style={rm.handle} />
          <Text style={rm.title}>Rate your experience</Text>
          {booking.technicians && (
            <Text style={rm.techName}>👷 {booking.technicians.name}</Text>
          )}

          {/* Star picker */}
          <View style={rm.starsRow}>
            {[1,2,3,4,5].map(i => (
              <TouchableOpacity key={i} onPress={() => setStars(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[rm.star, stars >= i && rm.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {stars > 0 && (
            <Text style={rm.starLabel}>{['','Poor','Fair','Good','Very Good','Excellent'][stars]}</Text>
          )}

          {/* Tags */}
          <View style={rm.tagsWrap}>
            {RATING_TAGS.map(t => (
              <TouchableOpacity
                key={t}
                style={[rm.tag, tags.includes(t) && rm.tagActive]}
                onPress={() => toggleTag(t)}
              >
                <Text style={[rm.tagText, tags.includes(t) && rm.tagTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional review text */}
          <TextInput
            style={rm.input}
            placeholder="Share more details (optional)..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={300}
            value={review}
            onChangeText={setReview}
          />

          <TouchableOpacity
            style={[rm.submitBtn, (submitting || stars === 0) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={submitting || stars === 0}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={rm.submitBtnText}>Submit Review</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const rm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, paddingBottom: 40 },
  handle:   { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:    { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  techName: { fontSize: 14, color: '#2e7d32', fontWeight: '600', textAlign: 'center', marginTop: 6, marginBottom: 16 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 16 },
  star:     { fontSize: 42, color: '#d1d5db' },
  starActive: { color: '#f59e0b' },
  starLabel: { textAlign: 'center', fontSize: 15, color: '#92400e', fontWeight: '600', marginBottom: 14 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag:      { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  tagActive: { borderColor: '#0c64c0', backgroundColor: '#eff6ff' },
  tagText:   { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tagTextActive: { color: '#0c64c0', fontWeight: '700' },
  input:    { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  submitBtn: { backgroundColor: '#0c64c0', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

type Nav = NativeStackNavigationProp<RootStackParamList>

const SVC_ICON:  Record<string, string> = { electrical: '⚡', plumbing: '🔧', painting: '🎨' }
const SVC_LABEL: Record<string, string> = { electrical: 'Electrician', plumbing: 'Plumber', painting: 'Painter' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fff8e1', color: '#f39c12' },
  confirmed: { bg: '#e3f2fd', color: '#1565c0' },
  assigned:  { bg: '#e8f5e9', color: '#2e7d32' },
  completed: { bg: '#f3e5f5', color: '#6a1b9a' },
  cancelled: { bg: '#fce4ec', color: '#c62828' },
}

interface Booking {
  id: string
  service_type: string
  scheduled_date: string
  time_slot: string
  status: string
  visiting_charge: number
  extra_charges: number
  address: { line: string; city: string }
  description?: string
  technician_id?: string | null
  technicians?: { name: string; phone: string } | null
}

interface TechLocation { lat: number; lng: number; heading?: number; updated_at: string }

function TrackingModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const mapRef = useRef<MapView>(null)
  const [location, setLocation] = useState<TechLocation | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [lastSeen, setLastSeen] = useState('')

  const techId   = booking.technician_id
  const techName = booking.technicians?.name  ?? 'Technician'
  const techPhone= booking.technicians?.phone ?? ''

  // Fetch initial location then subscribe to real-time updates
  useEffect(() => {
    if (!techId) { setLoading(false); return }

    supabase
      .from('technician_locations')
      .select('lat, lng, heading, updated_at')
      .eq('technician_id', techId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLocation(data as TechLocation)
          setLastSeen(timeSince(data.updated_at))
        }
        setLoading(false)
      })

    const channel = supabase
      .channel(`tech-loc-${techId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'technician_locations', filter: `technician_id=eq.${techId}` },
        (payload) => {
          const row = payload.new as TechLocation
          setLocation(row)
          setLastSeen(timeSince(row.updated_at))
          mapRef.current?.animateToRegion({
            latitude: row.lat, longitude: row.lng,
            latitudeDelta: 0.01, longitudeDelta: 0.01,
          }, 600)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [techId])

  // Refresh "last seen" label every 30 s
  useEffect(() => {
    if (!location) return
    const t = setInterval(() => setLastSeen(timeSince(location.updated_at)), 30_000)
    return () => clearInterval(t)
  }, [location])

  const initialRegion = location
    ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 19.2403, longitude: 73.1305, latitudeDelta: 0.05, longitudeDelta: 0.05 } // Kalyan default

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={tm.container}>
        {/* Header */}
        <View style={tm.header}>
          <TouchableOpacity style={tm.closeBtn} onPress={onClose}>
            <Text style={tm.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={tm.headerTitle}>Live Tracking</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Map */}
        {loading ? (
          <View style={tm.mapPlaceholder}>
            <ActivityIndicator size="large" color="#0c64c0" />
            <Text style={tm.mapPlaceholderText}>Fetching location…</Text>
          </View>
        ) : !location ? (
          <View style={tm.mapPlaceholder}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
            <Text style={tm.mapPlaceholderText}>Location not available yet.</Text>
            <Text style={tm.mapPlaceholderSub}>The technician hasn't shared their location.</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={tm.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton
          >
            <Marker
              coordinate={{ latitude: location.lat, longitude: location.lng }}
              title={techName}
              description="En route to your location"
              pinColor="#0c64c0"
            />
          </MapView>
        )}

        {/* Bottom info card */}
        <View style={tm.infoCard}>
          <View style={tm.infoRow}>
            <Text style={tm.techIcon}>👷</Text>
            <View style={{ flex: 1 }}>
              <Text style={tm.techName}>{techName}</Text>
              {lastSeen ? <Text style={tm.lastSeen}>Last updated: {lastSeen}</Text> : null}
            </View>
            {techPhone ? (
              <TouchableOpacity
                style={tm.callBtn}
                onPress={() => Linking.openURL(`tel:${techPhone}`)}
              >
                <Text style={tm.callBtnText}>📞 Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={tm.statusRow}>
            <View style={tm.statusDot} />
            <Text style={tm.statusLabel}>
              {SVC_LABEL[booking.service_type]} · {booking.time_slot}
            </Text>
          </View>
          <Text style={tm.addressLine}>📍 {booking.address?.line}, {booking.address?.city}</Text>
        </View>
      </View>
    </Modal>
  )
}

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)} hr ago`
}

export default function MyBookingsScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuthStore()
  const [bookings, setBookings]       = useState<Booking[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [ratingBooking,  setRatingBooking]  = useState<Booking | null>(null)
  const [trackingBooking,setTrackingBooking]= useState<Booking | null>(null)
  const [ratedIds, setRatedIds]            = useState<Set<string>>(new Set())

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (!user) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const { data } = await supabase
      .from('service_bookings')
      .select('*, technician_id, technicians(name, phone)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBookings((data as Booking[]) || [])
    if (isRefresh) setRefreshing(false); else setLoading(false)
  }, [user])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  useEffect(() => {
    if (!user || bookings.length === 0) return
    const completedIds = bookings.filter(b => b.status === 'completed').map(b => b.id)
    if (completedIds.length === 0) return
    ;(async () => {
      try {
        const { data } = await supabase.from('service_reviews').select('booking_id').in('booking_id', completedIds)
        setRatedIds(new Set((data || []).map((r: any) => r.booking_id)))
      } catch {}
    })()
  }, [bookings, user])

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🔒</Text>
        <Text style={styles.emptyTitle}>Sign in to view bookings</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => <BookingCardSkeleton key={i} />)}
        </View>
      </View>
    )
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🛠️</Text>
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptySub}>Book an electrician, plumber or painter.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Services', {})}>
          <Text style={styles.btnText}>Book a Technician</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchBookings(true)} colors={['#0c64c0']} tintColor="#0c64c0" />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Bookings</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('Services', {})}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {bookings.map(b => {
        const sc = STATUS_COLOR[b.status] || STATUS_COLOR.pending
        const charge = (b.visiting_charge || 200) + (b.extra_charges || 0)
        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 28 }}>{SVC_ICON[b.service_type]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{SVC_LABEL[b.service_type]}</Text>
                  <Text style={styles.cardMeta}>📅 {b.scheduled_date} · {b.time_slot}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.color }]} numberOfLines={1}>{b.status}</Text>
              </View>
            </View>

            <Text style={styles.cardAddress}>📍 {b.address?.line}, {b.address?.city}</Text>
            {b.description ? <Text style={styles.cardDesc}>{b.description}</Text> : null}
            {b.technicians ? (
              <Text style={styles.techName}>👷 {b.technicians.name} · {b.technicians.phone}</Text>
            ) : null}
            <Text style={styles.cardCharge}>₹{charge} total</Text>

            {b.status === 'in_progress' && b.technician_id && (
              <TouchableOpacity style={styles.trackBtn} onPress={() => setTrackingBooking(b)}>
                <Text style={styles.trackBtnText}>📍 Track Technician</Text>
              </TouchableOpacity>
            )}
            {b.status === 'pending' && (
              <View style={styles.pendingNote}>
                <Text style={styles.pendingNoteText}>⏳ We'll call you soon to confirm your appointment.</Text>
              </View>
            )}
            {b.status === 'completed' && !ratedIds.has(b.id) && (
              <TouchableOpacity style={styles.rateBtn} onPress={() => setRatingBooking(b)}>
                <Text style={styles.rateBtnText}>⭐ Rate this service</Text>
              </TouchableOpacity>
            )}
            {b.status === 'completed' && ratedIds.has(b.id) && (
              <Text style={styles.ratedText}>✓ Reviewed</Text>
            )}
          </View>
        )
      })}

      {ratingBooking && user && (
        <RatingModal
          booking={ratingBooking}
          userId={user.id}
          onClose={() => setRatingBooking(null)}
          onDone={() => {
            setRatedIds(prev => new Set([...prev, ratingBooking.id]))
            setRatingBooking(null)
          }}
        />
      )}
      {trackingBooking && (
        <TrackingModal booking={trackingBooking} onClose={() => setTrackingBooking(null)} />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9ca3af', marginBottom: 20, textAlign: 'center' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#111827' },
  newBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    flexShrink: 0, marginLeft: 8, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardAddress: { fontSize: 13, color: '#374151', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  techName: { fontSize: 13, color: '#2e7d32', fontWeight: '600', marginBottom: 4 },
  cardCharge: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  pendingNote: { backgroundColor: '#fff8e1', borderRadius: 8, padding: 10, marginTop: 10 },
  pendingNoteText: { fontSize: 12, color: '#f39c12' },
  rateBtn: { backgroundColor: '#fffbeb', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#fde68a' },
  rateBtnText: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  ratedText: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginTop: 10, textAlign: 'center' },

  trackBtn: {
    marginTop: 10, backgroundColor: '#0c64c0', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 6,
  },
  trackBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})

const tm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    backgroundColor: '#0c2d5e',
  },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: '#fff' },
  closeBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  map:           { flex: 1 },
  mapPlaceholder:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f9fafb' },
  mapPlaceholderText: { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' },
  mapPlaceholderSub:  { fontSize: 13, color: '#9ca3af', marginTop: 6, textAlign: 'center' },

  infoCard: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  techIcon:   { fontSize: 30 },
  techName:   { fontSize: 16, fontWeight: '700', color: '#111827' },
  lastSeen:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  callBtn:    { backgroundColor: '#0c64c0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  callBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  statusLabel:{ fontSize: 13, fontWeight: '600', color: '#374151' },
  addressLine:{ fontSize: 13, color: '#6b7280' },
})
