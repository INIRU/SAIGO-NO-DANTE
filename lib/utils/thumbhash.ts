import { rgbaToDataURL, thumbHashToRGBA } from 'thumbhash'

// The map is: { "sinners/yi-sang/identities/...": "base64hash", ... }
// Keyed by the relative path after the bucket name (i.e. after "limbus-assets/")
import thumbhashMap from '@/lib/data/thumbhash-map.json'

// Keep in sync with lib/constants/game.ts — defined locally to avoid circular deps
const STORAGE_BASE =
  'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

/**
 * Longest side of the placeholder image. next/image draws the placeholder through a Gaussian blur, so 8 px keeps the
 * look of the 32 px ThumbHash while its PNG data URL drops from about 5 KB to about 0.4 KB per image; a grid of cards
 * inlines one per card into the page HTML and RSC payload.
 */
const PLACEHOLDER_SIDE = 8

// In-memory cache: base64 hash → decoded data URL
const cache = new Map<string, string>()

/** Box-filtered copy of an RGBA image, at most `side` px on its longer edge. */
function shrink(width: number, height: number, rgba: ArrayLike<number>, side: number) {
  const scale = Math.min(1, side / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w))
    const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h))
    const sum = [0, 0, 0, 0]
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      for (let channel = 0; channel < 4; channel++) sum[channel] += rgba[(sy * width + sx) * 4 + channel]
    }
    const count = (x1 - x0) * (y1 - y0)
    for (let channel = 0; channel < 4; channel++) out[(y * w + x) * 4 + channel] = Math.round(sum[channel] / count)
  }
  return { w, h, rgba: out }
}

/** Placeholder data URL for one base64 ThumbHash (see PLACEHOLDER_SIDE). */
export function thumbHashPlaceholder(hash: string): string {
  const cached = cache.get(hash)
  if (cached) return cached
  const binary = Uint8Array.from(atob(hash), c => c.charCodeAt(0))
  const image = thumbHashToRGBA(binary)
  const small = shrink(image.w, image.h, image.rgba, PLACEHOLDER_SIDE)
  const dataURL = rgbaToDataURL(small.w, small.h, small.rgba)
  cache.set(hash, dataURL)
  return dataURL
}

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
  return hash ? thumbHashPlaceholder(hash) : undefined
}
