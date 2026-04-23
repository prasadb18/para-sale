import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Switch, ScrollView, StyleSheet,
  ActivityIndicator, Alert, TouchableOpacity, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

interface Prefs {
  order_updates:   boolean
  service_updates: boolean
  promotional:     boolean
  back_in_stock:   boolean
  price_drops:     boolean
  new_arrivals:    boolean
}

const DEFAULT_PREFS: Prefs = {
  order_updates:   true,
  service_updates: true,
  promotional:     true,
  back_in_stock:   true,
  price_drops:     true,
  new_arrivals:    false,
}

const PREF_META: { key: keyof Prefs; icon: string; title: string; desc: string }[] = [
  { key: 'order_updates',   icon: '📦', title: 'Order Updates',        desc: 'Confirmed, dispatched, delivered and cancellation alerts' },
  { key: 'service_updates', icon: '🛠️', title: 'Booking Updates',      desc: 'Technician assigned, reminder and completion alerts' },
  { key: 'promotional',     icon: '🎉', title: 'Offers & Deals',        desc: 'Exclusive discounts, seasonal sales and coupons' },
  { key: 'back_in_stock',   icon: '🔔', title: 'Back in Stock',         desc: 'When a wishlist or recently viewed item is restocked' },
  { key: 'price_drops',     icon: '📉', title: 'Price Drops',           desc: 'When a wishlisted item drops in price' },
  { key: 'new_arrivals',    icon: '✨', title: 'New Arrivals',           desc: 'New products in categories you\'ve browsed' },
]

async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

async function savePushToken(userId: string) {
  try {
    const granted = await requestPushPermission()
    if (!granted) return
    const token = await Notifications.getExpoPushTokenAsync()
    await supabase.from('profiles').update({ push_token: token.data }).eq('id', userId)
  } catch {}
}

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()
  const user       = useAuthStore(s => s.user)

  const [prefs,      setPrefs]      = useState<Prefs>(DEFAULT_PREFS)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [permStatus, setPermStatus] = useState<string>('unknown')

  const loadPrefs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setPrefs({
        order_updates:   data.order_updates,
        service_updates: data.service_updates,
        promotional:     data.promotional,
        back_in_stock:   data.back_in_stock,
        price_drops:     data.price_drops,
        new_arrivals:    data.new_arrivals,
      })
    }

    const { status } = await Notifications.getPermissionsAsync()
    setPermStatus(status)
    setLoading(false)
  }, [user])

  useEffect(() => { loadPrefs() }, [loadPrefs])

  const handleToggle = (key: keyof Prefs, value: boolean) => {
    setPrefs(p => ({ ...p, [key]: value }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) {
      Alert.alert('Error', 'Could not save preferences. Please try again.')
    } else {
      await savePushToken(user.id)
      Alert.alert('Saved', 'Your notification preferences have been updated.')
    }
  }

  const handleEnableSystem = async () => {
    const granted = await requestPushPermission()
    const { status } = await Notifications.getPermissionsAsync()
    setPermStatus(status)
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please enable notifications for 1ShopStore in your device Settings to receive alerts.',
      )
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0c64c0" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* System permission banner */}
        {permStatus !== 'granted' && (
          <TouchableOpacity style={styles.permBanner} onPress={handleEnableSystem}>
            <Text style={styles.permBannerIcon}>🔕</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.permBannerTitle}>Notifications are off</Text>
              <Text style={styles.permBannerDesc}>Tap to enable system notifications so we can send you alerts.</Text>
            </View>
            <Text style={styles.permBannerAction}>Enable →</Text>
          </TouchableOpacity>
        )}

        {/* Preference rows */}
        <View style={styles.card}>
          {PREF_META.map((item, index) => (
            <View
              key={item.key}
              style={[styles.row, index < PREF_META.length - 1 && styles.rowBorder]}
            >
              <Text style={styles.rowIcon}>{item.icon}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={v => handleToggle(item.key, v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={prefs[item.key] ? '#0c64c0' : '#9ca3af'}
                disabled={permStatus !== 'granted'}
              />
            </View>
          ))}
        </View>

        {permStatus !== 'granted' && (
          <Text style={styles.disabledNote}>
            Enable system notifications above to activate individual toggles.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (saving || permStatus !== 'granted') && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || permStatus !== 'granted'}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Preferences</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText:    { fontSize: 32, color: '#0c64c0', lineHeight: 38 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff7ed', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 16,
  },
  permBannerIcon:   { fontSize: 24 },
  permBannerTitle:  { fontSize: 14, fontWeight: '700', color: '#9a3412', marginBottom: 2 },
  permBannerDesc:   { fontSize: 12, color: '#c2410c', lineHeight: 16 },
  permBannerAction: { fontSize: 13, fontWeight: '700', color: '#ea580c' },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    overflow: 'hidden', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowIcon:   { fontSize: 22, width: 28, textAlign: 'center' },
  rowBody:   { flex: 1 },
  rowTitle:  { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowDesc:   { fontSize: 12, color: '#6b7280', lineHeight: 16 },

  disabledNote: {
    fontSize: 12, color: '#9ca3af', textAlign: 'center',
    marginBottom: 16, paddingHorizontal: 24,
  },
  saveBtn: {
    backgroundColor: '#0c64c0', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
