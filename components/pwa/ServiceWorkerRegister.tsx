'use client'

import { useEffect } from 'react'

function isLocalHost(hostname: string) {
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
}

async function clearDevServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('saigo-'))
        .map((key) => caches.delete(key))
    )
  }
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const shouldDisableServiceWorker =
      process.env.NODE_ENV !== 'production' ||
      isLocalHost(window.location.hostname)

    if (shouldDisableServiceWorker) {
      clearDevServiceWorkers().catch(() => {})
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
