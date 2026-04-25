import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'

const WHATSAPP_NUMBER = '919082808482'

const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Standard delivery is same-day or next-day depending on your location. For orders placed before 2 PM, same-day delivery is usually available.',
  },
  {
    q: 'What is the return/exchange policy?',
    a: 'Most items can be exchanged within 7 days for manufacturing defects. Paints and electrical items cannot be returned once opened. Contact us within 24 hours of delivery for any supply issues.',
  },
  {
    q: 'How do I track my order?',
    a: 'Go to the Orders tab and tap "Track Order" on any active order to see real-time status updates.',
  },
  {
    q: 'Can I cancel my order?',
    a: 'Yes, orders can be cancelled before they are dispatched. Go to your order and tap "Cancel". Paid orders will be refunded within 5–7 business days.',
  },
  {
    q: 'How do I book a technician?',
    a: 'Go to any product page and tap "Book a Technician", or use the Services section from the home screen. Visiting charge is ₹200.',
  },
  {
    q: 'Is cash on delivery available?',
    a: 'Yes! We offer both Cash on Delivery (COD) and online payment options at checkout.',
  },
  {
    q: 'How do I apply a coupon?',
    a: 'On the checkout page, tap "Apply Coupon" and enter your code. You can also browse available coupons in the Coupon Discovery section.',
  },
  {
    q: 'What if I receive a wrong or damaged item?',
    a: 'Contact us immediately via WhatsApp or raise a support ticket. We will arrange a replacement or refund within 48 hours.',
  },
]

export default function HelpSupportScreen() {
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()
  const user       = useAuthStore(s => s.user)

  const [openFaq, setOpenFaq]       = useState<number | null>(null)
  const [subject, setSubject]       = useState('')
  const [message, setMessage]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openWhatsApp = () => {
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%2C%20I%20need%20help%20with%20my%201ShopStore%20order.`)
      .catch(() => Alert.alert('Could not open WhatsApp', 'Please contact us at +91 90828 08482'))
  }

  const submitTicket = async () => {
    if (!subject.trim()) { Alert.alert('Enter a subject'); return }
    if (!message.trim()) { Alert.alert('Describe your issue'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id:  user?.id ?? null,
        email:    user?.email ?? null,
        subject:  subject.trim(),
        message:  message.trim(),
        status:   'open',
      })
      if (error) throw error
      Alert.alert('Ticket Raised', "We'll get back to you within 24 hours.", [{ text: 'OK', onPress: () => (navigation as any).goBack() }])
      setSubject(''); setMessage('')
    } catch {
      Alert.alert('Error', 'Could not submit. Please try WhatsApp instead.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🛟</Text>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSub}>We're here 9 AM – 8 PM, Mon – Sat</Text>
        </View>

        {/* Quick action — WhatsApp */}
        <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp} activeOpacity={0.85}>
          <Text style={styles.whatsappIcon}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.whatsappTitle}>Chat on WhatsApp</Text>
            <Text style={styles.whatsappSub}>Fastest response — usually under 10 mins</Text>
          </View>
          <Text style={{ color: '#16a34a', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={styles.faqItem}
            onPress={() => setOpenFaq(openFaq === i ? null : i)}
            activeOpacity={0.8}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqChevron}>{openFaq === i ? '▲' : '▼'}</Text>
            </View>
            {openFaq === i && <Text style={styles.faqA}>{faq.a}</Text>}
          </TouchableOpacity>
        ))}

        {/* Raise ticket */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Raise a Support Ticket</Text>
        <View style={styles.ticketForm}>
          <Text style={styles.ticketLabel}>Subject</Text>
          <TextInput
            style={styles.ticketInput}
            placeholder="e.g. Wrong item received"
            placeholderTextColor="#9ca3af"
            value={subject}
            onChangeText={setSubject}
          />
          <Text style={styles.ticketLabel}>Describe your issue</Text>
          <TextInput
            style={[styles.ticketInput, styles.ticketTextarea]}
            placeholder="Please describe what happened and your order ID if applicable..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={5}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={submitTicket}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Ticket'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  hero: {
    backgroundColor: '#0c2d5e', alignItems: 'center',
    paddingTop: 40, paddingBottom: 32, paddingHorizontal: 24,
  },
  heroIcon:  { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', margin: 16, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#bbf7d0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  whatsappIcon:  { fontSize: 28 },
  whatsappTitle: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  whatsappSub:   { fontSize: 12, color: '#6b7280', marginTop: 2 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginHorizontal: 16, marginBottom: 10 },

  faqItem: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  faqHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  faqQ:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  faqChevron: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  faqA:       { fontSize: 13, color: '#6b7280', lineHeight: 20, marginTop: 10 },

  ticketForm: { backgroundColor: '#fff', margin: 16, borderRadius: 14, padding: 16 },
  ticketLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  ticketInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', marginBottom: 14,
  },
  ticketTextarea: { height: 110 },
  submitBtn: { backgroundColor: '#0c64c0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
