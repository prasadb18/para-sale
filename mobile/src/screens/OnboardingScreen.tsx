import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, Image,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CommonActions } from '@react-navigation/native'
import { RootStackParamList } from '../navigation'

export const ONBOARDING_KEY = '@onboarding_done'
const { width: W } = Dimensions.get('window')

type Nav = NativeStackNavigationProp<RootStackParamList>

const SLIDES = [
  {
    icon: '⚡',
    bg: '#0c2d5e',
    accent: '#3b82f6',
    title: 'Hardware, Fast',
    body: 'Wires, pipes, paints & tools — everything for your project delivered to your door.',
  },
  {
    icon: '🛠️',
    bg: '#065f46',
    accent: '#10b981',
    title: 'Book a Technician',
    body: 'Need help installing? Book a certified electrician, plumber or painter in minutes.',
  },
  {
    icon: '📦',
    bg: '#92400e',
    accent: '#f59e0b',
    title: 'Track Every Order',
    body: 'Real-time status updates — from dispatch to delivery, always in the loop.',
  },
  {
    icon: '🎉',
    bg: '#4c1d95',
    accent: '#8b5cf6',
    title: 'You\'re All Set',
    body: 'Browse 500+ products, compare prices, and order with one tap.',
  },
]

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>()
  const scrollRef  = useRef<ScrollView>(null)
  const [current, setCurrent] = useState(0)

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1
      scrollRef.current?.scrollTo({ x: next * W, animated: true })
      setCurrent(next)
    } else {
      finish()
    }
  }

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {})
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }))
  }

  const slide = SLIDES[current]

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { backgroundColor: s.bg, width: W }]}>
            <View style={[styles.iconCircle, { backgroundColor: s.accent + '30' }]}>
              <Text style={styles.icon}>{s.icon}</Text>
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && { backgroundColor: slide.accent, width: 24 }]} />
        ))}
      </View>

      {/* CTA */}
      <View style={[styles.footer, { backgroundColor: slide.bg }]}>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: slide.accent }]} onPress={goNext}>
          <Text style={styles.nextBtnText}>
            {current < SLIDES.length - 1 ? 'Next →' : 'Get Started →'}
          </Text>
        </TouchableOpacity>
        {current < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} style={{ marginTop: 16 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
    paddingBottom: 120,
  },
  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center', marginBottom: 36,
  },
  icon:  { fontSize: 72 },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 16, lineHeight: 38 },
  body:  { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 24 },
  dotsRow: {
    position: 'absolute', bottom: 110, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 32, paddingBottom: 48, paddingTop: 16, alignItems: 'center',
  },
  nextBtn: { width: '100%', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '500' },
})
