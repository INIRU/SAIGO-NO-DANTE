// Push-only service worker (REQ-SHARED-059), registered with the scope /push/ so it controls no page: the caching worker
// (sw.js) keeps its own lifecycle, and development builds can keep this one while clearing the other.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(data.title || '최애의 관리자', {
    body: data.body || '',
    icon: '/icons/icon-192x192.webp',
    tag: data.tag,
    data: { url: data.url || '/' },
  }))
})

// Pressing a notification brings an open tab of that page forward, else turns another tab of the site there, else opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
    const same = tabs.find((tab) => tab.url === url)
    if (same) return same.focus()
    const site = tabs.find((tab) => new URL(tab.url).origin === self.location.origin)
    if (site && 'navigate' in site) return site.focus().then(() => site.navigate(url))
    return self.clients.openWindow(url)
  }))
})
