/**
 * Custom image loader for imgproxy integration.
 * Supabase Storage images → imgproxy (resize + AVIF)
 * Other images (Google avatar, etc.) → pass through unchanged
 *
 * Requires:
 *   NEXT_PUBLIC_IMGPROXY_URL env var (e.g. https://img.saigo-no-dante.com)
 *   imgproxy ALLOWED_SOURCES set to Supabase Storage URL
 *   imgproxy signing disabled (IMGPROXY_KEY/SALT empty) — ALLOWED_SOURCES handles security
 */

const IMGPROXY_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  // Skip imgproxy if not configured or not a Supabase Storage image
  if (!IMGPROXY_URL || !src.includes('supabase.co/storage')) {
    return src
  }

  const q = quality || 80

  // Base64url-encode the source URL for imgproxy
  const encoded = btoa(src)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // rs:fit:WIDTH:0 = fit within width, auto height
  // f:avif = AVIF format (~20% smaller than WebP at same quality)
  return `${IMGPROXY_URL}/insecure/rs:fit:${width}:0/q:${q}/f:avif/${encoded}`
}
