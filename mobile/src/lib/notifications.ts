import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// ── Foreground notification behaviour ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// ── Register device and save Expo Push Token to profiles ─────────────────────
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Push tokens only work on physical devices (not simulators)
  if (!Constants.isDevice) return null

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '1ShopStore',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0c64c0',
    })
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  // Get Expo Push Token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) {
    console.warn('[Notifications] Missing EAS project ID — push token skipped.')
    return null
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

    // Persist to Supabase so the backend can send targeted notifications
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)

    return token
  } catch (err) {
    console.warn('[Notifications] Token registration failed:', err)
    return null
  }
}

// ── Badge management ──────────────────────────────────────────────────────────
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0)
}

// ── Notification data shape expected from backend ─────────────────────────────
export interface NotificationData {
  screen?: 'Orders' | 'MyBookings'
  orderId?: string
}
