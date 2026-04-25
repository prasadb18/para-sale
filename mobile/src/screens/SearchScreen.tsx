import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, FlatList, Animated, Easing,
  TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getProducts, Product } from '../api'
import { formatCurrency } from '../lib/currency'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/cartStore'
import { RootStackParamList } from '../navigation'
import useVoiceSearch from '../lib/useVoiceSearch'
import useRecentlyViewedStore from '../store/recentlyViewedStore'

const HISTORY_KEY = '@search_history'
const MAX_HISTORY = 10

async function loadHistory(): Promise<string[]> {
  try { return JSON.parse(await AsyncStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
async function saveHistory(term: string, current: string[]): Promise<string[]> {
  const next = [term, ...current.filter(h => h !== term)].slice(0, MAX_HISTORY)
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {})
  return next
}
async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY).catch(() => {})
}

type Nav   = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Search'>

// Animated pulsing ring for "listening" state
function PulseRing() {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.6, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale,   { toValue: 1,   duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,   duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        ]),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [scale, opacity])

  return (
    <Animated.View
      style={[vs.pulseRing, { transform: [{ scale }], opacity }]}
      pointerEvents="none"
    />
  )
}

export default function SearchScreen() {
  const navigation  = useNavigation<Nav>()
  const route       = useRoute<Route>()
  const inputRef    = useRef<TextInput>(null)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Product[]>([])
  const [loading, setLoading]     = useState(false)
  const [searched, setSearched]   = useState(false)
  const [history, setHistory]     = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const addItem       = useCartStore(s => s.addItem)
  const recentItems   = useRecentlyViewedStore(s => s.items)

  useEffect(() => { loadHistory().then(setHistory) }, [])

  const onVoiceResult = useCallback((text: string) => {
    setQuery(text)
  }, [])

  const voice = useVoiceSearch(onVoiceResult)

  // Auto-focus & optionally start voice on open
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus()
      if (route.params?.voice) voice.start()
    }, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search + typeahead suggestions
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); setSuggestions([]); return }
    // Typeahead: filter history by current query
    setSuggestions(history.filter(h => h.toLowerCase().includes(query.toLowerCase()) && h !== query).slice(0, 4))
    const t = setTimeout(async () => {
      setLoading(true)
      setSearched(true)
      const res = await getProducts(undefined, query.trim()).catch(() => ({ data: [] as Product[] }))
      setResults(res.data || [])
      setLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [query, history])

  const handleSearch = async (term: string) => {
    setQuery(term)
    setSuggestions([])
    const next = await saveHistory(term, history)
    setHistory(next)
  }

  const isListening  = voice.state === 'listening'
  const isProcessing = voice.state === 'processing'

  const handleMicPress = () => {
    if (isListening) {
      voice.stop()
    } else {
      setQuery('')
      voice.start()
    }
  }

  return (
    <View style={styles.container}>
      {/* Search input row */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { voice.cancel(); navigation.goBack() }} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={[styles.inputWrap, isListening && styles.inputWrapActive]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={isListening ? 'Listening...' : 'Search "wires, paint, pipes..."'}
            placeholderTextColor={isListening ? '#60a5fa' : '#9ca3af'}
            value={isListening ? voice.partialText : query}
            onChangeText={text => { if (!isListening) setQuery(text) }}
            onSubmitEditing={() => { if (query.trim()) handleSearch(query.trim()) }}
            returnKeyType="search"
            clearButtonMode="never"
            autoCapitalize="none"
            editable={!isListening}
          />
          {(query.length > 0 && !isListening) && (
            <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
              <Text style={{ color: '#9ca3af', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
          {/* Mic button */}
          <TouchableOpacity onPress={handleMicPress} style={[vs.micBtn, isListening && vs.micBtnActive]}>
            {isListening && <PulseRing />}
            <Text style={vs.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Listening overlay */}
      {(isListening || isProcessing) && (
        <View style={vs.overlay}>
          <View style={vs.listeningCard}>
            {isListening ? (
              <>
                <View style={vs.waveRow}>
                  {[1, 2, 3, 4, 5].map(i => <WaveBar key={i} delay={i * 80} />)}
                </View>
                <Text style={vs.listeningTitle}>Listening...</Text>
                <Text style={vs.listeningHint}>
                  {voice.partialText || 'Speak now — try "copper wire" or "LED bulb"'}
                </Text>
                <TouchableOpacity style={vs.stopBtn} onPress={voice.stop}>
                  <Text style={vs.stopBtnText}>Tap to stop</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#0c64c0" />
                <Text style={[vs.listeningTitle, { marginTop: 16 }]}>Processing...</Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* Typeahead suggestions dropdown */}
      {suggestions.length > 0 && !isListening && (
        <View style={sh.suggestBox}>
          {suggestions.map(s => (
            <TouchableOpacity key={s} style={sh.suggestRow} onPress={() => handleSearch(s)}>
              <Text style={sh.suggestIcon}>🕐</Text>
              <Text style={sh.suggestText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#0c64c0" />
      ) : !searched ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {/* Voice search CTA */}
          {voice.available && (
            <TouchableOpacity style={vs.hintMicBtn} onPress={voice.start}>
              <Text style={vs.hintMicText}>🎤  Try voice search</Text>
            </TouchableOpacity>
          )}

          {/* Search history */}
          {history.length > 0 && (
            <View style={sh.section}>
              <View style={sh.sectionHeader}>
                <Text style={sh.heading}>Recent Searches</Text>
                <TouchableOpacity onPress={async () => { await clearHistory(); setHistory([]) }}>
                  <Text style={sh.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={sh.historyWrap}>
                {history.map(term => (
                  <TouchableOpacity key={term} style={sh.historyChip} onPress={() => handleSearch(term)}>
                    <Text style={sh.historyText}>🕐 {term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recently viewed */}
          {recentItems.length > 0 ? (
            <View style={rv.section}>
              <Text style={rv.heading}>Recently Viewed</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingRight: 16 }}
              >
                {recentItems.slice(0, 10).map(p => (
                  <TouchableOpacity
                    key={String(p.id)}
                    style={rv.card}
                    onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                  >
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={rv.image} resizeMode="cover" />
                    ) : (
                      <View style={rv.placeholder}><Text style={{ fontSize: 20 }}>📦</Text></View>
                    )}
                    <Text style={rv.name} numberOfLines={2}>{p.name}</Text>
                    <Text style={rv.price}>{formatCurrency(p.price)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.hint}>
              <Text style={styles.hintIcon}>🔍</Text>
              <Text style={styles.hintText}>Search by name, brand or category</Text>
            </View>
          )}
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.hint}>
          <Text style={styles.hintIcon}>📦</Text>
          <Text style={styles.hintText}>No results for "{query}"</Text>
          <Text style={styles.hintSub}>Try a shorter or different keyword</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              compact
              onSelect={() => navigation.navigate('ProductDetail', { id: item.id })}
              onAdd={addItem}
            />
          )}
        />
      )}
    </View>
  )
}

// Animated wave bar used in listening overlay
function WaveBar({ delay }: { delay: number }) {
  const height = useRef(new Animated.Value(8)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(height, { toValue: 32, duration: 300, useNativeDriver: false }),
        Animated.timing(height, { toValue: 8,  duration: 300, useNativeDriver: false }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [height, delay])

  return <Animated.View style={[vs.waveBar, { height }]} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0c2d5e',
    paddingHorizontal: 12, paddingTop: 52, paddingBottom: 14, gap: 10,
  },
  backBtn:  { padding: 4 },
  backIcon: { fontSize: 22, color: '#fff', fontWeight: '600' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, gap: 8,
  },
  inputWrapActive: { borderWidth: 2, borderColor: '#60a5fa', backgroundColor: '#eff6ff' },
  searchIcon: { fontSize: 15 },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#111827' },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hintIcon: { fontSize: 48, marginBottom: 14 },
  hintText: { fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  hintSub:  { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  grid:    { padding: 12, paddingBottom: 32 },
  gridRow: { gap: 12, marginBottom: 12 },
})

const vs = StyleSheet.create({
  micBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  micBtnActive: { backgroundColor: '#dbeafe' },
  micIcon: { fontSize: 16 },

  pulseRing: {
    position: 'absolute', width: 34, height: 34,
    borderRadius: 17, backgroundColor: '#3b82f6', opacity: 0.4,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  listeningCard: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: 32, alignItems: 'center', width: 280,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  listeningTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 20 },
  listeningHint:  { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  waveRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 },
  waveBar:  { width: 6, borderRadius: 3, backgroundColor: '#0c64c0' },

  stopBtn:     { marginTop: 20, backgroundColor: '#fef2f2', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: '#fecaca' },
  stopBtnText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },

  hintMicBtn:  { margin: 20, backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  hintMicText: { fontSize: 14, color: '#1d4ed8', fontWeight: '600' },
})

const sh = StyleSheet.create({
  section:       { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heading:       { fontSize: 15, fontWeight: '700', color: '#111827' },
  clearText:     { fontSize: 13, color: '#9ca3af' },
  historyWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip:   { backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#e5e7eb' },
  historyText:   { fontSize: 13, color: '#374151' },
  suggestBox: {
    position: 'absolute', top: 80, left: 12, right: 12, zIndex: 20,
    backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  suggestRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  suggestIcon:   { fontSize: 14 },
  suggestText:   { fontSize: 14, color: '#374151' },
})

const rv = StyleSheet.create({
  section:  { paddingHorizontal: 16, paddingTop: 8 },
  heading:  { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  card: {
    width: 120, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  image:       { width: 120, height: 85, backgroundColor: '#f3f4f6' },
  placeholder: { width: 120, height: 85, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  name:  { fontSize: 11, color: '#374151', fontWeight: '500', padding: 6, paddingBottom: 2, lineHeight: 15 },
  price: { fontSize: 12, fontWeight: '700', color: '#111827', paddingHorizontal: 6, paddingBottom: 8 },
})
