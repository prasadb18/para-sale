import * as SecureStore from 'expo-secure-store'

// expo-secure-store caps individual values at ~2 KB on iOS.
// Supabase session JSON often exceeds this, so we chunk large values.
const CHUNK = 1800

async function getItem(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(`${key}__meta`)
  if (!meta) {
    // single-value (short) or legacy AsyncStorage migration fallback
    return SecureStore.getItemAsync(key)
  }
  const { n } = JSON.parse(meta) as { n: number }
  const parts = await Promise.all(
    Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
  )
  if (parts.some(p => p === null)) return null
  return (parts as string[]).join('')
}

async function setItem(key: string, value: string): Promise<void> {
  const n = Math.ceil(value.length / CHUNK)
  await SecureStore.setItemAsync(`${key}__meta`, JSON.stringify({ n }))
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    )
  )
}

async function removeItem(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(`${key}__meta`)
  if (meta) {
    const { n } = JSON.parse(meta) as { n: number }
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}__meta`),
      ...Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
    ])
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

const secureStorage = { getItem, setItem, removeItem }
export default secureStorage
