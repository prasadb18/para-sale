const CACHE_VERSION = 'v1'
const APP_CACHE = `1shopstore-app-${CACHE_VERSION}`
const IMAGE_CACHE = `1shopstore-images-${CACHE_VERSION}`
const API_CACHE = `1shopstore-api-${CACHE_VERSION}`

// App shell files to precache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
]

// ── Install: cache the app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![APP_CACHE, IMAGE_CACHE, API_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // 1. Supabase product images → CacheFirst (7 days)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 7 * 24 * 60 * 60))
    return
  }

  // 2. Supabase REST/Auth API → NetworkFirst (always try fresh)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // 3. Same-origin static assets (JS/CSS/icons) → CacheFirst
  if (url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp')
  )) {
    event.respondWith(cacheFirst(request, APP_CACHE))
    return
  }

  // 4. Navigation (HTML pages) → NetworkFirst, fall back to /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    )
    return
  }

  // 5. Everything else → NetworkFirst
  event.respondWith(networkFirst(request, APP_CACHE))
})

// ── Helpers ───────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    // If maxAge set, revalidate in background if stale
    if (maxAgeSeconds) {
      const cachedDate = cached.headers.get('date')
      if (cachedDate) {
        const age = (Date.now() - new Date(cachedDate).getTime()) / 1000
        if (age > maxAgeSeconds) {
          fetch(request).then(res => { if (res.ok) cache.put(request, res) }).catch(() => {})
        }
      }
    }
    return cached
  }

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || new Response('Offline', { status: 503 })
  }
}
