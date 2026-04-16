import { thumbHashToDataURL } from 'thumbhash'

// The map is: { "limbus-assets/sinners/yi-sang/identities/...": "base64hash", ... }
// Keyed by the relative path after the bucket name (i.e. after "limbus-assets/")
import thumbhashMap from '@/lib/data/thumbhash-map.json'

// Keep in sync with lib/constants/game.ts — defined locally to avoid circular deps
const STORAGE_BASE =
  'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

// In-memory cache: base64 hash → decoded data URL
const cache = new Map<string, string>()

/**
 * Get a ThumbHash blur data URL for the given image URL.
 * Returns undefined if no thumbhash is available (falls back to caller's default).
 *
 * Accepts full Supabase Storage URLs or bare relative paths (e.g.
 * "sinners/yi-sang/..."). The lookup key in thumbhash-map.json is the
 * relative path without the storage base prefix.
 */
export function getBlurDataURL(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined

  // Extract relative path from full Supabase Storage URL
  const path = imageUrl.startsWith(STORAGE_BASE)
    ? imageUrl.slice(STORAGE_BASE.length + 1) // +1 for the trailing /
    : imageUrl

  const hash = (thumbhashMap as Record<string, string>)[path]
  if (!hash) return undefined

  // Check in-memory decode cache
  const cached = cache.get(hash)
  if (cached) return cached

  // Decode base64 → Uint8Array → ThumbHash data URL
  const binary = Uint8Array.from(atob(hash), c => c.charCodeAt(0))
  const dataURL = thumbHashToDataURL(binary)
  cache.set(hash, dataURL)
  return dataURL
}
