import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, TextInput, ActivityIndicator, Share,
} from 'react-native'
import { useNavigation, CommonActions } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
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

  // Wallet & referral
  const [walletBalance,  setWalletBalance]  = useState(0)
  const [referralCode,   setReferralCode]   = useState('')
  const [claimInput,     setClaimInput]     = useState('')
  const [claiming,       setClaiming]       = useState(false)

  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setOrderCount(count ?? 0))
    supabase.from('service_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setBookingCount(count ?? 0))

    supabase.from('profiles').select('full_name, phone, referral_code').eq('id', user.id).single()
      .then(async ({ data }) => {
        if (data) {
          setFullName(data.full_name ?? '')
          setPhone(data.phone ?? '')
          let code = (data as unknown as { referral_code?: string }).referral_code ?? ''
          if (!code) {
            code = user.id.replace(/-/g, '').slice(0, 8).toUpperCase()
            await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)
          }
          setReferralCode(code)
        }
      })

    supabase.from('user_wallets').select('balance').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setWalletBalance(Number(data?.balance ?? 0)))
  }, [user.id])

  const handleClaimReferral = async () => {
    const code = claimInput.trim().toUpperCase()
    if (code.length < 4) { Alert.alert('Enter a valid referral code'); return }
    setClaiming(true)
    try {
      const { data } = await supabase.rpc('claim_referral', { p_code: code })
      const res = data as { ok: boolean; error?: string }
      if (res.ok) {
        setWalletBalance(b => b + 50)
        setClaimInput('')
        Alert.alert('🎉 Bonus Added!', '₹50 has been added to your wallet.')
      } else {
        Alert.alert('Could not claim', res.error ?? 'Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Could not process referral. Try again.')
    } finally {
      setClaiming(false)
    }
  }

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

      {/* ── Wallet & Referral ──────────────────────────────────── */}
      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>Wallet & Referrals</Text>

        {/* Balance */}
        <View style={styles.walletRow}>
          <View>
            <Text style={styles.walletLabel}>💳 Wallet Balance</Text>
            <Text style={styles.walletBalance}>{formatCurrency(walletBalance)}</Text>
          </View>
          <View style={styles.walletBadge}>
            <Text style={styles.walletBadgeText}>Store Credit</Text>
          </View>
        </View>

        {/* Referral code */}
        <View style={styles.refCodeBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refCodeLabel}>🎁 Your referral code</Text>
            <Text style={styles.refCode}>{referralCode || '—'}</Text>
            <Text style={styles.refCodeHint}>Share it — both you & your friend get ₹50</Text>
          </View>
          <TouchableOpacity
            style={styles.refShareBtn}
            onPress={() => Share.share({
              message: `Use my referral code ${referralCode} on 1ShopStore to get ₹50 wallet credit! Download the app and shop hardware, electricals & plumbing delivered fast.`,
            })}
          >
            <Text style={styles.refShareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Claim a code */}
        <View style={styles.claimRow}>
          <TextInput
            style={styles.claimInput}
            placeholder="Enter friend's referral code"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            value={claimInput}
            onChangeText={setClaimInput}
          />
          <TouchableOpacity
            style={[styles.claimBtn, (!claimInput.trim() || claiming) && { opacity: 0.5 }]}
            onPress={handleClaimReferral}
            disabled={!claimInput.trim() || claiming}
          >
            {claiming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.claimBtnText}>Claim</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Support ────────────────────────────────────────────── */}
      <View style={styles.menuCard}>
        <Text style={styles.cardSection}>Support</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('HelpSupport')}>
          <Text style={styles.menuItemIcon}>🛟</Text>
          <Text style={styles.menuItemText}>Help & Support</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
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
  walletRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  walletLabel:   { fontSize: 13, color: '#6b7280', fontWeight: '500', marginBottom: 2 },
  walletBalance: { fontSize: 22, fontWeight: '800', color: '#0c64c0' },
  walletBadge:   { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  walletBadgeText: { fontSize: 11, fontWeight: '700', color: '#0c64c0' },

  refCodeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  refCodeLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 2 },
  refCode:      { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: 2 },
  refCodeHint:  { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  refShareBtn:  { backgroundColor: '#0c64c0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  refShareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  claimRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14,
  },
  claimInput: {
    flex: 1, height: 42, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 9,
    paddingHorizontal: 12, fontSize: 14, backgroundColor: '#f9fafb', color: '#111827',
  },
  claimBtn:     { backgroundColor: '#16a34a', borderRadius: 9, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', height: 42 },
  claimBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
