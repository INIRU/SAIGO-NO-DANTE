/** Scope of the push-only worker (public/push-sw.js): it controls no page. */
export const PUSH_SCOPE = '/push/'

/** The server's VAPID public key (base64url) as the bytes `pushManager.subscribe` wants. */
export function urlBase64ToUint8Array(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}
