const CACHE_NAME = 'saigo-v1'
const PRECACHE = [
  '/',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // API/auth 요청은 캐시하지 않음
  if (request.url.includes('/api/') || request.url.includes('/auth/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공 응답만 캐시
        if (response.ok && request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  )
})
