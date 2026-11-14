import { z } from 'zod'

// Server side only (the subscribe route): kept apart from keys.ts, whose PUSH_SCOPE the layout's service worker register
// imports, so zod stays out of the code every page downloads.
const base64url = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+=*$/)

/** A browser's PushSubscription (as `toJSON()` gives it) with the page language the pushes are written in. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith('https://'),
  keys: z.object({ p256dh: base64url, auth: base64url }),
  lang: z.enum(['ko', 'en', 'ja']),
})
