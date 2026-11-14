/** Guest key: kept in the browser, sent as a header; the server stores only its HMAC. */
export const GUEST_KEY_HEADER = 'x-guest-key'
export const GUEST_KEY_STORAGE = 'snd-guest-key'
const GUEST_KEY_RE = /^snd_[A-Za-z0-9_-]{43}$/

export const isGuestKey = (value: string) => GUEST_KEY_RE.test(value.trim())

/** A guest post's password: four to six digits the author picks, asked for when the key is gone. */
export const isGuestPin = (value: string) => /^[0-9]{4,6}$/.test(value)
/**
 * Passwords anyone would try first, refused on a new post: one digit repeated, a run up or down (1234, 9876, 7890),
 * a pair or triple repeated (1212, 123123) and a few keypad classics. Five tries a day go far against these.
 */
export const isWeakGuestPin = (pin: string) =>
  /^(\d)\1+$/.test(pin) || /^(\d{2,3})\1+$/.test(pin) || ['1004', '2580', '0852'].includes(pin)
  || [1, 9].some(step => [...pin].every((digit, at) => at === 0 || (Number(pin[at - 1]) + step) % 10 === Number(digit)))
/** What a password field keeps of what was typed. */
export const cleanGuestPin = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 6)

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

function getOrCreateGuestKey(): string {
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
