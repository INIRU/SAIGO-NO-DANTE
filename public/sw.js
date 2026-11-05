// ============================================================
// SAIGO NO DANTE — Service Worker
// Cache version: bump CACHE_VERSION on each deploy to bust stale caches.
// ============================================================

// v7 (2026-11-05): pages and Next.js chunks are no longer stored (the browser cache keeps the chunks), drop their copies
const CACHE_VERSION = 'v7'
const CACHE_STATIC   = `saigo-static-${CACHE_VERSION}`   // the offline page and app icons
const CACHE_IMAGES   = `saigo-images-${CACHE_VERSION}`   // Supabase Storage + /images/*

// Assets to precache on install (the offline page only — no game images)
const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192x192.webp',
  '/icons/icon-512x512.webp',
]

// Cache size limit (a grid page alone shows a few hundred images; 500 entries thrashed between pages)
const MAX_IMAGE_ENTRIES = 1500
// Caches are trimmed once per this many writes instead of listing every key on every response.
const TRIM_EVERY = 40

// A cached image is served at once and revalidated with the server in the background at most this often.
// Refreshing on every hit re-downloaded and re-wrote every image of every page view, competing with the images still loading.
const IMAGE_REFRESH_MS = 6 * 60 * 60 * 1000
const CACHED_AT_HEADER = 'x-sw-cached-at'

// Supabase Storage origin for image cache
const SUPABASE_ORIGIN = 'https://lpgqcleszdlldneiwgep.supabase.co'

// ============================================================
// INSTALL — precache shell assets
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      // addAll throws if any URL fails; use individual puts to be resilient
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) cache.put(url, res)
          })
        )
      )
    )
  )
  // Activate immediately without waiting for old SW clients to close
  self.skipWaiting()
})

// ============================================================
// ACTIVATE — delete caches from previous versions
// ============================================================
self.addEventListener('activate', (event) => {
  const keepCaches = new Set([CACHE_STATIC, CACHE_IMAGES])
  event.waitUntil(
    // A page request then starts while the worker boots instead of after it (see answerPage).
    Promise.resolve(self.registration?.navigationPreload?.enable()).catch(() => {}).then(() => caches.keys()).then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('saigo-') && !keepCaches.has(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => trimCache(CACHE_IMAGES, MAX_IMAGE_ENTRIES))
  )
  // Take control of all existing clients immediately
  self.clients.claim()
})

// ============================================================
// Helpers
// ============================================================

/**
 * Trim a cache to at most `maxEntries` entries (FIFO — oldest deleted first).
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map((k) => cache.delete(k)))
  }
}

const writesSinceTrim = {}
/** Trims `cacheName` after every TRIM_EVERY writes (the count restarts with the worker, so activation also trims). */
function trimSoon(cacheName, maxEntries) {
  writesSinceTrim[cacheName] = (writesSinceTrim[cacheName] || 0) + 1
  if (writesSinceTrim[cacheName] < TRIM_EVERY) return Promise.resolve()
  writesSinceTrim[cacheName] = 0
  return trimCache(cacheName, maxEntries)
}

/**
 * Classify a request into a caching strategy.
 * Returns: 'skip' | 'page' | 'stale-while-revalidate'
 */
function classifyRequest(request) {
  const url = new URL(request.url)
  const { pathname, origin } = url

  // Only handle GET — never cache mutations
  if (request.method !== 'GET') return 'skip'

  // Never cache API or auth routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) return 'skip'

  // Never cache admin routes
  if (pathname.startsWith('/admin')) return 'skip'

  // Never cache monitoring/sentry tunnel
  if (pathname.startsWith('/monitoring')) return 'skip'

  // Mutable image URLs: served from cache, revalidated in the background so later visits see updates. A plain <img>
  // loads them without CORS; such opaque responses cannot be cached here, so the browser fetches them directly.
  if (origin === SUPABASE_ORIGIN) return request.mode === 'no-cors' ? 'skip' : 'stale-while-revalidate'

  // Only handle same-origin requests from here on
  if (origin !== self.location.origin) return 'skip'

  // Next.js build chunks and fonts are hashed and served immutable for a year: the browser cache answers them without
  // waking this worker (going through it held a reload's scripts up to 18s behind its other work).

  // Image optimization URLs can keep the same source path across data updates.
  if (pathname.startsWith('/_next/image')) return 'stale-while-revalidate'

  // Static icon/image assets in public/
  if (pathname.startsWith('/icons/') || pathname.startsWith('/images/')) return 'stale-while-revalidate'

  // HTML pages — straight from the network, the offline page when it fails
  const acceptsHtml = request.headers.get('accept')?.includes('text/html')
  if (request.mode === 'navigate' || acceptsHtml) return 'page'

  return 'skip'
}

// ============================================================
// Strategy implementations
// ============================================================

/**
 * A page streams straight from the network: the navigation preload response when the browser started one while the
 * worker booted, a fetch otherwise. Nothing is stored (a copy only ever served offline); the offline page answers a
 * failed network.
 */
async function answerPage(event) {
  try {
    return (await event.preloadResponse) || await fetch(event.request)
  } catch {
    const offlinePage = await caches.match('/offline')
    return offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

/** Stores an image response with the time it was fetched (read by isFreshImage). */
async function storeImage(cache, request, response) {
  const headers = new Headers(response.headers)
  headers.set(CACHED_AT_HEADER, String(Date.now()))
  const body = await response.blob()
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }))
  await trimSoon(CACHE_IMAGES, MAX_IMAGE_ENTRIES)
}

function isFreshImage(cached, now) {
  const at = Number(cached.headers.get(CACHED_AT_HEADER))
  return at > 0 && now - at < IMAGE_REFRESH_MS
}

/**
 * Cached images are answered at once; ones older than IMAGE_REFRESH_MS are revalidated with the server in the background
 * (a conditional request, usually 304) so an updated image shows on a later visit. A miss is answered straight from the
 * network and stored in the background: the page never waits for the cache write.
 */
async function staleWhileRevalidateImage(request, event) {
  const cache = await caches.open(CACHE_IMAGES)
  const cached = await cache.match(request)
  if (cached) {
    if (!isFreshImage(cached, Date.now())) {
      event.waitUntil(
        fetch(request, { cache: 'no-cache' })
          .then((response) => (response.ok ? storeImage(cache, request, response) : undefined))
          .catch(() => {})
      )
    }
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) event.waitUntil(storeImage(cache, request, response.clone()).catch(() => {}))
    return response
  } catch {
    return new Response('Image unavailable offline', { status: 503 })
  }
}

// ============================================================
// FETCH — route each request to the right strategy
// ============================================================
self.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request)

  if (strategy === 'skip') return

  if (strategy === 'page') {
    event.respondWith(answerPage(event))
  } else if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidateImage(event.request, event))
  }
})
