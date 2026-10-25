import { z } from 'zod'

/** Scope of the push-only worker (public/push-sw.js): it controls no page. */
export const PUSH_SCOPE = '/push/'

const base64url = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+=*$/)

/** A browser's PushSubscription (as `toJSON()` gives it) with the page language the pushes are written in. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith('https://'),
  keys: z.object({ p256dh: base64url, auth: base64url }),
  lang: z.enum(['ko', 'en', 'ja']),
})
export type PushSubscriptionBody = z.infer<typeof pushSubscriptionSchema>

/** The server's VAPID public key (base64url) as the bytes `pushManager.subscribe` wants. */
export function urlBase64ToUint8Array(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}
