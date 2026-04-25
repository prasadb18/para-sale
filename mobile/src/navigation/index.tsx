import React from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import HomeScreen from '../screens/HomeScreen'
import ProductsScreen from '../screens/ProductsScreen'
import ProductDetailScreen from '../screens/ProductDetailScreen'
import CartScreen from '../screens/CartScreen'
import OrdersScreen from '../screens/OrdersScreen'
import LoginScreen from '../screens/LoginScreen'
import CheckoutScreen from '../screens/CheckoutScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ServicesScreen from '../screens/ServicesScreen'
import MyBookingsScreen from '../screens/MyBookingsScreen'
import SearchScreen from '../screens/SearchScreen'
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen'
import WishlistScreen from '../screens/WishlistScreen'
import OrderTrackingScreen from '../screens/OrderTrackingScreen'
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen'
import OnboardingScreen from '../screens/OnboardingScreen'
import HelpSupportScreen from '../screens/HelpSupportScreen'
import CouponDiscoveryScreen from '../screens/CouponDiscoveryScreen'
import CompareScreen from '../screens/CompareScreen'

import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'

export type RootStackParamList = {
  Main: undefined
  Search: { voice?: boolean } | undefined
  ProductDetail: { id: string | number }
  Checkout: undefined
  Login: undefined
  Services: { type?: string; fromCart?: boolean }
  MyBookings: undefined
  PrivacyPolicy: undefined
  Wishlist: undefined
  OrderTracking: { orderId: string }
  NotificationPreferences: undefined
  Onboarding: undefined
  HelpSupport: undefined
  Coupons: { cartTotal?: number; onApply?: (code: string) => void } | undefined
  Compare: undefined
}

export type TabParamList = {
  Home: undefined
  Products: { categorySlug?: string; categoryName?: string; search?: string } | undefined
  Cart: undefined
  Orders: undefined
  Account: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<TabParamList>()

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:     { active: 'home',          inactive: 'home-outline' },
  Products: { active: 'grid',          inactive: 'grid-outline' },
  Cart:     { active: 'cart',          inactive: 'cart-outline' },
  Orders:   { active: 'receipt',       inactive: 'receipt-outline' },
  Account:  { active: 'person',        inactive: 'person-outline' },
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons = TAB_ICONS[name] ?? { active: 'ellipse', inactive: 'ellipse-outline' }
  return (
    <Ionicons
      name={focused ? icons.active : icons.inactive}
      size={24}
      color={focused ? '#0c64c0' : '#9ca3af'}
    />
  )
}


function MainTabs() {
  const count = useCartStore(s => s.count)
  const insets = useSafeAreaInsets()
  const tabBarHeight = 56
  const bottomPad = Math.max(insets.bottom, 8)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0c64c0',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: tabBarHeight + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ tabBarBadge: count > 0 ? count : undefined }}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  )
}

function AccountScreen() {
  const { user, signOut } = useAuthStore()
  if (!user) return <LoginScreen />
  return <ProfileScreen user={user} signOut={signOut} />
}

export const navigationRef = createNavigationContainerRef<RootStackParamList>()

export default function AppNavigation() {
  const [initialRoute, setInitialRoute] = React.useState<'Main' | 'Onboarding' | null>(null)

  React.useEffect(() => {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('@onboarding_done').then(val => {
        setInitialRoute(val ? 'Main' : 'Onboarding')
      }).catch(() => setInitialRoute('Main'))
    })
  }, [])

  if (!initialRoute) return null

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: '#0c2d5e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ headerShown: true, title: 'Product Details' }}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ headerShown: true, title: 'Checkout' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: true, title: 'Sign In / Sign Up' }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="Services"
          component={ServicesScreen}
          options={{ headerShown: true, title: 'Book a Technician' }}
        />
        <Stack.Screen
          name="MyBookings"
          component={MyBookingsScreen}
          options={{ headerShown: true, title: 'My Bookings' }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ headerShown: true, title: 'Privacy Policy' }}
        />
        <Stack.Screen
          name="Wishlist"
          component={WishlistScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OrderTracking"
          component={OrderTrackingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NotificationPreferences"
          component={NotificationPreferencesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HelpSupport"
          component={HelpSupportScreen}
          options={{ headerShown: true, title: 'Help & Support' }}
        />
        <Stack.Screen
          name="Coupons"
          component={CouponDiscoveryScreen}
          options={{ headerShown: true, title: 'Coupons & Offers' }}
        />
        <Stack.Screen
          name="Compare"
          component={CompareScreen}
          options={{ headerShown: true, title: 'Compare Products' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
