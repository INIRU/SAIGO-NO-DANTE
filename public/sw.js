// ============================================================
// SAIGO NO DANTE — Service Worker
// Cache version: bump CACHE_VERSION on each deploy to bust stale caches.
// ============================================================

const CACHE_VERSION = 'v4'
const CACHE_STATIC   = `saigo-static-${CACHE_VERSION}`   // Next.js chunks, fonts
const CACHE_IMAGES   = `saigo-images-${CACHE_VERSION}`   // Supabase Storage + /images/*
const CACHE_PAGES    = `saigo-pages-${CACHE_VERSION}`    // HTML pages (offline fallback)

// Assets to precache on install (shell only — no game images)
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/icons/icon-192x192.webp',
  '/icons/icon-512x512.webp',
]

// Cache size limits
const MAX_IMAGE_ENTRIES = 500
const MAX_PAGE_ENTRIES  = 50
const MAX_STATIC_ENTRIES = 300

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
  const keepCaches = new Set([CACHE_STATIC, CACHE_IMAGES, CACHE_PAGES])
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('saigo-') && !keepCaches.has(k))
          .map((k) => caches.delete(k))
      )
    )
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

/**
 * Classify a request into a caching strategy.
 * Returns: 'skip' | 'network-first' | 'cache-first-static' | 'cache-first-image' | 'stale-while-revalidate'
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

  // Mutable image URLs: refresh in the background so normal revisits see updates.
  if (origin === SUPABASE_ORIGIN) return 'stale-while-revalidate'

  // Only handle same-origin requests from here on
  if (origin !== self.location.origin) return 'skip'

  // Next.js build chunks — long-lived hashed filenames, cache-first
  if (pathname.startsWith('/_next/static/')) return 'cache-first-static'

  // Image optimization URLs can keep the same source path across data updates.
  if (pathname.startsWith('/_next/image')) return 'stale-while-revalidate'

  // Font files under /fonts/
  if (pathname.startsWith('/fonts/')) return 'cache-first-static'

  // Static icon/image assets in public/
  if (pathname.startsWith('/icons/') || pathname.startsWith('/images/')) return 'stale-while-revalidate'

  // HTML pages — network-first with page cache fallback
  const acceptsHtml = request.headers.get('accept')?.includes('text/html')
  if (acceptsHtml || pathname === '/') return 'network-first'

  return 'skip'
}

// ============================================================
// Strategy implementations
// ============================================================

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_PAGES)
      cache.put(request, response.clone())
      trimCache(CACHE_PAGES, MAX_PAGE_ENTRIES)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Return offline page for HTML navigation requests
    const offlinePage = await caches.match('/offline')
    return offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC)
      cache.put(request, response.clone())
      trimCache(CACHE_STATIC, MAX_STATIC_ENTRIES)
    }
    return response
  } catch {
    return new Response('Asset unavailable offline', { status: 503 })
  }
}

async function staleWhileRevalidateImage(request, event) {
  const cache = await caches.open(CACHE_IMAGES)
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone())
      await trimCache(CACHE_IMAGES, MAX_IMAGE_ENTRIES)
    }
    return response
  }).catch(() => null)
  event.waitUntil(refresh)
  const cached = await cache.match(request)
  if (cached) return cached
  return (await refresh) || new Response('Image unavailable offline', { status: 503 })
}

// ============================================================
// FETCH — route each request to the right strategy
// ============================================================
self.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request)

  if (strategy === 'skip') return

  if (strategy === 'network-first') {
    event.respondWith(networkFirst(event.request))
  } else if (strategy === 'cache-first-static') {
    event.respondWith(cacheFirstStatic(event.request))
  } else if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidateImage(event.request, event))
  }
})
