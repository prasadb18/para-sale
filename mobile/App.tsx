import 'react-native-url-polyfill/auto'
import React, { useEffect, useRef, useState } from 'react'
import { AppState, View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import AppNavigation, { navigationRef } from './src/navigation'
import useAuthStore from './src/store/authStore'
import useCartStore from './src/store/cartStore'
import useWishlistStore from './src/store/wishlistStore'
import useRecentlyViewedStore from './src/store/recentlyViewedStore'
import { registerForPushNotifications, clearBadge, NotificationData } from './src/lib/notifications'

// ── Offline detection (no native module needed) ───────────────────────────────
async function checkOnline(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch('https://connectivitycheck.gstatic.com/generate_204', {
      method: 'HEAD', signal: controller.signal,
    })
    return res.status === 204 || res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function OfflineBanner() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[banner.wrap, { paddingTop: insets.top + 6 }]}>
      <Text style={banner.text}>⚠️  No internet connection</Text>
    </View>
  )
}

const banner = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    backgroundColor: '#b91c1c', paddingBottom: 8, alignItems: 'center',
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
})

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const initAuth        = useAuthStore(s => s.initAuth)
  const loadCart        = useCartStore(s => s.loadCart)
  const loadWishlist    = useWishlistStore(s => s.loadWishlist)
  const loadViewed      = useRecentlyViewedStore(s => s.loadViewed)
  const notifListener    = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    initAuth()
    loadCart()
    loadWishlist()
    loadViewed()
  }, [])

  // Connectivity: check on launch and every time app becomes active
  useEffect(() => {
    checkOnline().then(setIsOnline)
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') checkOnline().then(setIsOnline)
    })
    return () => sub.remove()
  }, [])

  // Register push token once a user is signed in
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(state => {
      if (state.user) registerForPushNotifications(state.user.id)
    })
    const { user } = useAuthStore.getState()
    if (user) registerForPushNotifications(user.id)
    return unsubscribe
  }, [])

  // Clear badge counter whenever the app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') clearBadge()
    })
    return () => sub.remove()
  }, [])

  // Log foreground notifications (handler in notifications.ts shows the banner)
  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(_notif => {
      // no-op — setNotificationHandler already shows the alert banner
    })
    return () => notifListener.current?.remove()
  }, [])

  // Navigate when user taps a notification
  useEffect(() => {
    const navigate = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData
      if (!navigationRef.isReady()) return
      if (data?.screen === 'MyBookings') {
        navigationRef.navigate('MyBookings')
      } else {
        navigationRef.navigate('Main')
      }
    }
    responseListener.current = Notifications.addNotificationResponseReceivedListener(navigate)
    return () => responseListener.current?.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigation />
      {!isOnline && <OfflineBanner />}
    </SafeAreaProvider>
  )
}
