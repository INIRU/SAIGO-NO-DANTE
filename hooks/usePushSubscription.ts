'use client'
import { useCallback, useEffect, useState } from 'react'
import { PUSH_SCOPE, urlBase64ToUint8Array } from '@/lib/push/keys'

/** `unsupported`: no Push API in this browser or no keys on the server; `denied`: the browser blocks this site's notifications. */
export type PushState = 'loading' | 'unsupported' | 'denied' | 'off' | 'on' | 'busy'

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const registration = () => navigator.serviceWorker.getRegistration(PUSH_SCOPE)

/** Resolves once the push worker is active: a subscription needs an active worker. */
function activated(worker: ServiceWorkerRegistration) {
  const pending = worker.installing ?? worker.waiting
  if (worker.active || !pending) return Promise.resolve()
  return new Promise<void>(resolve => pending.addEventListener('statechange', () => { if (pending.state === 'activated') resolve() }))
}

/** Unsubscribes this browser and tells the server, e.g. before signing out; never throws. */
export async function forgetPushSubscription() {
  try {
    if (!supported()) return
    const subscription = await (await registration())?.pushManager.getSubscription()
    if (!subscription) return
    await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {})
    await subscription.unsubscribe()
  } catch { /* nothing to forget */ }
}

/**
 * This browser's push subscription for the signed-in account. `enable` asks for permission only then, registers the
 * push-only worker, subscribes with the server's key and saves it with the page language; it resolves to whether pushes are on.
 */
export function usePushSubscription(lang: 'ko' | 'en' | 'ja') {
  const [state, setState] = useState<PushState>('loading')
  useEffect(() => {
    if (!supported()) { setState('unsupported'); return }
    if (Notification.permission === 'denied') { setState('denied'); return }
    let alive = true
    Promise.all([
      fetch('/api/push/subscribe').then(response => response.json() as Promise<{ publicKey: string | null }>),
      registration().then(found => found?.pushManager.getSubscription() ?? null),
    ]).then(([{ publicKey }, subscription]) => {
      if (alive) setState(!publicKey ? 'unsupported' : subscription && Notification.permission === 'granted' ? 'on' : 'off')
    }).catch(() => { if (alive) setState('off') })
    return () => { alive = false }
  }, [])

  const enable = useCallback(async () => {
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return false }
      const { publicKey } = await (await fetch('/api/push/subscribe')).json() as { publicKey: string | null }
      if (!publicKey) { setState('unsupported'); return false }
      const worker = await navigator.serviceWorker.register('/push-sw.js', { scope: PUSH_SCOPE })
      await activated(worker)
      const subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...subscription.toJSON(), lang }) })
      if (!response.ok) { await subscription.unsubscribe(); throw Error() }
      setState('on')
      return true
    } catch {
      setState('off')
      return false
    }
  }, [lang])

  const disable = useCallback(async () => {
    setState('busy')
    await forgetPushSubscription()
    setState('off')
  }, [])

  return { state, enable, disable }
}
