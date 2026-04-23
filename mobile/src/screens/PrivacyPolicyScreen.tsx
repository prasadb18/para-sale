import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const LAST_UPDATED = 'April 18, 2026'
const CONTACT_EMAIL = 'prasadbadhan7@gmail.com'
const APP_NAME = '1ShopStore'
const COMPANY = 'Parasale'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.para}>{children}</Text>
)

const Li = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.li}>• {children}</Text>
)

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.appName}>{APP_NAME}</Text>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.updated}>Last updated: {LAST_UPDATED}</Text>
      </View>

      <View style={s.body}>
        <P>
          {COMPANY} ("we", "us", or "our") built the {APP_NAME} app. This page informs you of
          our policies regarding the collection, use, and disclosure of personal data when you
          use our app and the choices you have associated with that data.
        </P>

        <Section title="1. Information We Collect">
          <P>We collect the following information when you use {APP_NAME}:</P>
          <Li>Email address (for account creation and login)</Li>
          <Li>Full name and mobile number (for order and service booking delivery)</Li>
          <Li>Delivery address (flat, building, city, pincode)</Li>
          <Li>Order history (products purchased, quantities, amounts)</Li>
          <Li>Service booking details (type, date, time slot, description)</Li>
          <Li>Device location (GPS) — only when you use the location picker, to show your delivery area. We do not store or track your location continuously.</Li>
        </Section>

        <Section title="2. How We Use Your Information">
          <Li>To process and deliver your orders</Li>
          <Li>To confirm and assign technician service bookings</Li>
          <Li>To contact you regarding your orders or bookings</Li>
          <Li>To show your order and booking history within the app</Li>
          <Li>To improve the app and fix issues</Li>
          <P>
            We do not sell, trade, or rent your personal information to third parties.
          </P>
        </Section>

        <Section title="3. Data Storage and Security">
          <P>
            Your data is stored securely on Supabase (supabase.com), a trusted cloud database
            provider. All data is transmitted over HTTPS. We use Row Level Security (RLS) to
            ensure each user can only access their own data.
          </P>
          <P>
            Passwords are never stored in plain text — Supabase uses industry-standard
            bcrypt hashing.
          </P>
        </Section>

        <Section title="4. Third-Party Services">
          <P>We use the following third-party services that may process your data:</P>
          <Li>Supabase — database and authentication (supabase.com/privacy)</Li>
          <Li>Google Maps — location display and reverse geocoding (policies.google.com/privacy)</Li>
          <Li>Expo / EAS — app delivery and updates (expo.dev/privacy)</Li>
          <Li>Railway — backend API hosting (railway.app/legal/privacy)</Li>
        </Section>

        <Section title="5. Location Data">
          <P>
            {APP_NAME} requests access to your device location only when you tap the location
            selector on the home screen. We use this to display your approximate delivery area.
            Location data is processed in real time and is not stored on our servers.
          </P>
          <P>
            You can deny location permission at any time in your device settings. The app
            will continue to work — you can manually enter your delivery location instead.
          </P>
        </Section>

        <Section title="6. Guest Orders">
          <P>
            You can place orders and book services without creating an account. In this case,
            we collect only your name, phone number, and delivery address to fulfil the order.
            Guest data is not linked to any user account.
          </P>
        </Section>

        <Section title="7. Data Retention">
          <P>
            We retain your personal data for as long as your account is active. Order and
            booking records are kept for accounting and legal compliance purposes.
          </P>
          <P>
            If you delete your account (via Settings → Delete Account), all your personal
            data including orders, bookings, addresses, and your account credentials are
            permanently deleted within 24 hours.
          </P>
        </Section>

        <Section title="8. Your Rights">
          <P>You have the right to:</P>
          <Li>Access the personal data we hold about you</Li>
          <Li>Correct inaccurate personal data</Li>
          <Li>Request deletion of your account and all associated data</Li>
          <Li>Withdraw consent to location access at any time</Li>
          <P>
            To delete your account, go to Account → Delete Account inside the app.
            To make any other request, contact us at {CONTACT_EMAIL}.
          </P>
        </Section>

        <Section title="9. Children's Privacy">
          <P>
            {APP_NAME} is not directed at children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you become aware that a
            child has provided us with personal data, please contact us immediately.
          </P>
        </Section>

        <Section title="10. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new policy on this screen with an updated date. You are
            advised to review this policy periodically.
          </P>
        </Section>

        <Section title="11. Contact Us">
          <P>
            If you have any questions about this Privacy Policy, please contact us:
          </P>
          <Li>Email: {CONTACT_EMAIL}</Li>
          <Li>App: {APP_NAME} by {COMPANY}</Li>
        </Section>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#0c2d5e',
    paddingTop: 32, paddingBottom: 28, paddingHorizontal: 20,
  },
  appName: { fontSize: 12, color: '#93c5fd', fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  updated: { fontSize: 12, color: '#93c5fd' },
  body: { padding: 20 },
  section: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#0c2d5e',
    marginBottom: 10, letterSpacing: 0.2,
  },
  para: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  li: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 4, paddingLeft: 4 },
})
