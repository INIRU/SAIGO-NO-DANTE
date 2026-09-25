/** Guest key: kept in the browser, sent as a header; the server stores only its HMAC. */
export const GUEST_KEY_HEADER = 'x-guest-key'
export const GUEST_KEY_STORAGE = 'snd-guest-key'
const GUEST_KEY_RE = /^snd_[A-Za-z0-9_-]{43}$/

export const isGuestKey = (value: string) => GUEST_KEY_RE.test(value.trim())

function newGuestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return 'snd_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function readGuestKey(): string | null {
  try {
    const key = localStorage.getItem(GUEST_KEY_STORAGE)
    return key && isGuestKey(key) ? key : null
  } catch { return null }
}

export function getOrCreateGuestKey(): string {
  const existing = readGuestKey()
  if (existing) return existing
  const key = newGuestKey()
  try { localStorage.setItem(GUEST_KEY_STORAGE, key) } catch { /* private mode: key lives for this page only */ }
  return key
}

export function setGuestKey(key: string) {
  localStorage.setItem(GUEST_KEY_STORAGE, key.trim())
}

/** Headers for a write request; guests send their key (created on first use). */
export const guestHeaders = (signedIn: boolean): Record<string, string> => signedIn ? {} : { [GUEST_KEY_HEADER]: getOrCreateGuestKey() }
