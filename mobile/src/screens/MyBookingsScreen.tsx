import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import { RootStackParamList } from '../navigation'
import { BookingCardSkeleton } from '../components/Skeleton'

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
  technicians?: { name: string; phone: string } | null
}

export default function MyBookingsScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (!user) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const { data } = await supabase
      .from('service_bookings')
      .select('*, technicians(name, phone)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBookings((data as Booking[]) || [])
    if (isRefresh) setRefreshing(false); else setLoading(false)
  }, [user])

  useEffect(() => { fetchBookings() }, [fetchBookings])

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

            {b.status === 'pending' && (
              <View style={styles.pendingNote}>
                <Text style={styles.pendingNoteText}>⏳ We'll call you soon to confirm your appointment.</Text>
              </View>
            )}
          </View>
        )
      })}
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
})
