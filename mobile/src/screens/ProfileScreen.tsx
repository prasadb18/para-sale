import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import { useNavigation, CommonActions } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { RootStackParamList } from '../navigation'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface Props {
  user: User
  signOut: () => Promise<void>
}

export default function ProfileScreen({ user, signOut }: Props) {
  const navigation = useNavigation<Nav>()
  const [orderCount,   setOrderCount]   = useState<number | null>(null)
  const [bookingCount, setBookingCount] = useState<number | null>(null)

  // Profile fields
  const [fullName,  setFullName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editName,  setEditName]  = useState('')
  const [editPhone, setEditPhone] = useState('')

  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setOrderCount(count ?? 0))
    supabase.from('service_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setBookingCount(count ?? 0))

    supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? '')
          setPhone(data.phone ?? '')
        }
      })
  }, [user.id])

  const startEditing = () => {
    setEditName(fullName)
    setEditPhone(phone)
    setEditing(true)
  }

  const cancelEditing = () => setEditing(false)

  const saveProfile = async () => {
    if (!editName.trim()) { Alert.alert('Name is required'); return }
    if (editPhone.trim() && !/^\d{10}$/.test(editPhone.trim())) {
      Alert.alert('Enter a valid 10-digit mobile number')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id:        user.id,
      full_name: editName.trim(),
      phone:     editPhone.trim() || null,
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setFullName(editName.trim())
    setPhone(editPhone.trim())
    setEditing(false)
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data — orders, bookings, and addresses. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              `You are deleting the account for ${user.email}. All data will be erased permanently.`,
              [
                { text: 'Go back', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.rpc('delete_own_account')
                      if (error) throw error
                      await signOut()
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : 'Failed to delete account.'
                      Alert.alert('Error', msg)
                    }
                  },
                },
              ]
            )
          },
        },
      ]
    )
  }

  const displayName = fullName || user.email?.split('@')[0] || 'User'
  const initial = displayName[0].toUpperCase()

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Profile header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
        {phone ? <Text style={styles.phoneText}>📞 {phone}</Text> : null}
        <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
          <Text style={styles.editProfileBtnText}>✏️ Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── Inline edit panel ──────────────────────────────────── */}
      {editing && (
        <View style={styles.editCard}>
          <Text style={styles.cardSection}>Edit Profile</Text>
          <Text style={styles.editLabel}>Full Name *</Text>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your full name"
            autoFocus
          />
          <Text style={styles.editLabel}>Mobile Number</Text>
          <TextInput
            style={styles.editInput}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="10-digit number (optional)"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditing}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Quick stats ────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statTile} onPress={() => navigation.dispatch(CommonActions.navigate('Orders'))}>
          <Text style={styles.statNum}>{orderCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statTile} onPress={() => navigation.navigate('MyBookings')}>
          <Text style={styles.statNum}>{bookingCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </TouchableOpacity>
      </View>

      {/* ── Account info card ──────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardSection}>Account</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Email</Text>
          <Text style={styles.cardValue}>{user.email}</Text>
        </View>
        <View style={[styles.cardRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.cardLabel}>Member since</Text>
          <Text style={styles.cardValue}>
            {new Date(user.created_at ?? Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* ── Navigation menu ────────────────────────────────────── */}
      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>My Activity</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.dispatch(CommonActions.navigate('Orders'))}>
          <Text style={styles.menuItemIcon}>📋</Text>
          <Text style={styles.menuItemText}>My Orders</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyBookings')}>
          <Text style={styles.menuItemIcon}>🛠️</Text>
          <Text style={styles.menuItemText}>My Bookings</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Wishlist')}>
          <Text style={styles.menuItemIcon}>❤️</Text>
          <Text style={styles.menuItemText}>Saved Items</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>Services</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Services', { type: 'electrical' })}>
          <Text style={styles.menuItemIcon}>⚡</Text>
          <Text style={styles.menuItemText}>Book Electrician</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Services', { type: 'plumbing' })}>
          <Text style={styles.menuItemIcon}>🔧</Text>
          <Text style={styles.menuItemText}>Book Plumber</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Services', { type: 'painting' })}>
          <Text style={styles.menuItemIcon}>🎨</Text>
          <Text style={styles.menuItemText}>Book Painter</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Notifications ──────────────────────────────────────── */}
      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>Preferences</Text>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('NotificationPreferences')}>
          <Text style={styles.menuItemIcon}>🔔</Text>
          <Text style={styles.menuItemText}>Notification Preferences</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Legal ──────────────────────────────────────────────── */}
      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>Legal</Text>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.menuItemIcon}>🔒</Text>
          <Text style={styles.menuItemText}>Privacy Policy</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sign out ───────────────────────────────────────────── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      {/* ── Delete account ─────────────────────────────────────── */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
        <Text style={styles.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    backgroundColor: '#0c2d5e',
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 28,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#0c64c0',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText:      { color: '#fff', fontSize: 32, fontWeight: '800' },
  displayName:     { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  emailText:       { fontSize: 13, color: '#93c5fd', marginBottom: 4 },
  phoneText:       { fontSize: 13, color: '#bfdbfe', marginBottom: 8 },
  editProfileBtn:  {
    marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  editProfileBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Inline edit card
  editCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0,
    borderRadius: 14, padding: 16, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 1.5, borderColor: '#bfdbfe',
  },
  editLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500', marginBottom: 6 },
  editInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    marginBottom: 14, backgroundColor: '#f9fafb',
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 1, backgroundColor: '#0c64c0', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  statTile:    { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statNum:     { fontSize: 24, fontWeight: '800', color: '#0c64c0', marginBottom: 2 },
  statLabel:   { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 14, margin: 16, marginBottom: 0,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 14, margin: 16, marginBottom: 0,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  cardSection: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  cardLabel: { fontSize: 14, color: '#6b7280' },
  cardValue: { fontSize: 14, color: '#111827', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  // Menu items
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  menuItemIcon: { fontSize: 18, marginRight: 14 },
  menuItemText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  menuArrow:    { fontSize: 20, color: '#9ca3af', lineHeight: 24 },

  // Sign out
  signOutBtn: {
    margin: 16, marginTop: 24, marginBottom: 0,
    backgroundColor: '#fee2e2', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  signOutBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },

  // Delete account
  deleteBtn: {
    margin: 16, marginTop: 10, marginBottom: 0,
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
})
