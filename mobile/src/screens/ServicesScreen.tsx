import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, ActivityIndicator, Platform, Modal,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { RootStackParamList } from '../navigation'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Services'>

const SERVICE_TYPES = [
  {
    id: 'electrical' as const,
    icon: '⚡', label: 'Electrician', color: '#1565c0', bg: '#e8f1fb',
    desc: 'Wiring, switchboard fitting, MCB, fan & light fixing',
  },
  {
    id: 'plumbing' as const,
    icon: '🔧', label: 'Plumber', color: '#00695c', bg: '#e0f5f5',
    desc: 'Tap fitting, pipe repair, bathroom fittings, leakage fixing',
  },
  {
    id: 'painting' as const,
    icon: '🎨', label: 'Painter', color: '#e65100', bg: '#fff8e1',
    desc: 'Wall painting, primer application, texture & polish work',
  },
]

const TIME_SLOTS = [
  'Morning (9 AM – 12 PM)',
  'Afternoon (12 PM – 4 PM)',
  'Evening (4 PM – 7 PM)',
]

export default function ServicesScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { user } = useAuthStore()
  const { addServiceBooking } = useCartStore()
  const insets = useSafeAreaInsets()

  const fromCart = route.params?.fromCart === true
  const [selected, setSelected] = useState<string>(route.params?.type || '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [selectedDate, setSelectedDate] = useState<Date>(tomorrow)
  const [showPicker, setShowPicker] = useState(false)
  const [slot, setSlot] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const formatDateForDB = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (date) setSelectedDate(date)
  }

  const selectedSvc = SERVICE_TYPES.find(s => s.id === selected)

  const validate = () => {
    if (!selected) { Alert.alert('Select a service type'); return false }
    if (!name.trim()) { Alert.alert('Enter your name'); return false }
    if (!/^\d{10}$/.test(phone.trim())) { Alert.alert('Enter valid 10-digit phone'); return false }
    if (!addressLine.trim()) { Alert.alert('Enter your address'); return false }
    if (!city.trim()) { Alert.alert('Enter your city'); return false }
    if (!slot) { Alert.alert('Select a time slot'); return false }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)

    const payload = {
      service_type: selected,
      user_id: user?.id || null,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      guest_name: user ? null : name.trim(),
      guest_phone: user ? null : phone.trim(),
      address: { line: addressLine.trim(), city: city.trim() },
      scheduled_date: formatDateForDB(selectedDate),
      time_slot: slot,
      description: description || null,
      visiting_charge: 200,
      extra_charges: 0,
      status: 'pending',
    }

    const { data, error } = await supabase.from('service_bookings').insert(payload).select().single()
    setSubmitting(false)

    if (error) {
      Alert.alert('Booking failed', error.message)
      return
    }

    addServiceBooking({
      id: data.id,
      service_type: data.service_type,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      scheduled_date: data.scheduled_date,
      time_slot: data.time_slot,
      visiting_charge: data.visiting_charge,
      extra_charges: data.extra_charges || 0,
    })

    if (fromCart) {
      navigation.goBack()
      return
    }

    Alert.alert(
      'Booking Confirmed! ✅',
      `We'll call you on ${phone.trim()} to confirm.\n\nService: ${selectedSvc?.label}\nDate: ${formatDate(selectedDate)}\nSlot: ${slot}\n\nVisiting charge: ₹200`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {fromCart && (
        <View style={styles.fromCartBanner}>
          <Text style={styles.fromCartText}>
            🛒 Booking for your cart order — you'll be taken back after booking.
          </Text>
        </View>
      )}

      {/* Service type selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Service</Text>
        {SERVICE_TYPES.map(svc => (
          <TouchableOpacity
            key={svc.id}
            style={[styles.svcCard, { backgroundColor: svc.bg, borderColor: selected === svc.id ? svc.color : 'transparent' }]}
            onPress={() => setSelected(svc.id)}
          >
            <Text style={styles.svcIcon}>{svc.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.svcLabel, { color: svc.color }]}>{svc.label}</Text>
              <Text style={styles.svcDesc}>{svc.desc}</Text>
            </View>
            {selected === svc.id && (
              <View style={[styles.checkBadge, { backgroundColor: svc.color }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Details form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Details</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />

        <Text style={styles.label}>Mobile Number *</Text>
        <TextInput style={styles.input} placeholder="10-digit number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />

        <Text style={styles.label}>Address / Flat / Building *</Text>
        <TextInput style={styles.input} placeholder="e.g. Flat 4B, Lodha Palava Phase 2" value={addressLine} onChangeText={setAddressLine} />

        <Text style={styles.label}>City / Area *</Text>
        <TextInput style={styles.input} placeholder="e.g. Dombivli East" value={city} onChangeText={setCity} />

        <Text style={styles.label}>Preferred Date *</Text>
        <TouchableOpacity style={styles.datePicker} onPress={() => setShowPicker(true)}>
          <Text style={styles.datePickerIcon}>📅</Text>
          <Text style={styles.datePickerText}>{formatDate(selectedDate)}</Text>
          <Text style={styles.datePickerChevron}>›</Text>
        </TouchableOpacity>

        {/* Android: inline picker shown as overlay */}
        {showPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            minimumDate={tomorrow}
            onChange={onDateChange}
          />
        )}

        {/* iOS: show inside a modal with Done button */}
        {Platform.OS === 'ios' && (
          <Modal visible={showPicker} transparent animationType="slide">
            <View style={styles.iosModalOverlay}>
              <View style={styles.iosModalCard}>
                <View style={styles.iosModalHeader}>
                  <Text style={styles.iosModalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={styles.iosModalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  minimumDate={tomorrow}
                  onChange={onDateChange}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </Modal>
        )}

        <Text style={styles.label}>Preferred Time Slot *</Text>
        {TIME_SLOTS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.slotBtn, slot === t && styles.slotBtnActive]}
            onPress={() => setSlot(t)}
          >
            <Text style={[styles.slotBtnText, slot === t && styles.slotBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: 14 }]}>Describe the work (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="e.g. Install a fan and replace socket in bedroom"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      <View style={styles.pricingNote}>
        <Text style={styles.pricingNoteText}>
          💚 ₹200 visiting charge includes 1 fitting or small work. Any extra work quoted on-site. No hidden charges.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 32) }]}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>
                📅 Book {selectedSvc?.label || 'Technician'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  fromCartBanner: {
    backgroundColor: '#e3f2fd', padding: 12, margin: 16,
    borderRadius: 10, borderWidth: 1, borderColor: '#90caf9',
  },
  fromCartText: { fontSize: 13, color: '#1565c0', fontWeight: '500' },
  section: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0,
    borderRadius: 14, padding: 16, shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  svcCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2,
  },
  svcIcon: { fontSize: 28 },
  svcLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  svcDesc: { fontSize: 12, color: '#555' },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, color: '#6b7280', fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    marginBottom: 14, backgroundColor: '#f9fafb',
  },
  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 14, backgroundColor: '#f9fafb',
  },
  datePickerIcon: { fontSize: 18 },
  datePickerText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  datePickerChevron: { fontSize: 20, color: '#9ca3af' },
  iosModalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosModalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, paddingBottom: 32,
  },
  iosModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  iosModalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iosModalDone: { fontSize: 16, color: '#0c64c0', fontWeight: '700' },
  slotBtn: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  slotBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  slotBtnText: { fontSize: 14, color: '#374151' },
  slotBtnTextActive: { color: '#2563eb', fontWeight: '700' },
  pricingNote: {
    margin: 16, marginTop: 12, backgroundColor: '#f0fdf4',
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#a5d6a7',
  },
  pricingNoteText: { fontSize: 13, color: '#2e7d32' },
  footer: { padding: 20, paddingBottom: 20 },
  submitBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
