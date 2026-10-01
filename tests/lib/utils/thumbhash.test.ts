import { expect, it } from 'vitest'
import map from '../../../lib/data/thumbhash-map.json'
import { blurPlaceholder, getBlurDataURL, thumbHashPlaceholder } from '../../../lib/utils/thumbhash'

const png = (url: string) => {
  const bytes = Uint8Array.from(atob(url.slice('data:image/png;base64,'.length)), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

it('inlines a small blur placeholder instead of the 32 px ThumbHash PNG (about 5 KB each in grid HTML)', () => {
  const hashes = Object.values(map as Record<string, string>)
  for (const hash of hashes.slice(0, 50)) {
    const url = thumbHashPlaceholder(hash)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(url.length).toBeLessThan(700)
    const { width, height } = png(url)
    expect(Math.max(width, height)).toBe(8)
    expect(Math.min(width, height)).toBeGreaterThan(0)
  }
})

it('finds placeholders by Supabase URL or storage path and skips unknown images', () => {
  const [path] = Object.keys(map)
  const url = `https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/${path}`
  expect(getBlurDataURL(url)).toBe(getBlurDataURL(path))
  expect(getBlurDataURL(url)).toMatch(/^data:image\/png;base64,/)
  expect(getBlurDataURL('https://example.com/unknown.webp')).toBeUndefined()
})

it('REQ-SHARED-030 gives next/image a blur placeholder only for images that have one', () => {
  const [path] = Object.keys(map)
  expect(blurPlaceholder(path)).toEqual({ placeholder: 'blur', blurDataURL: getBlurDataURL(path) })
  // No entry (gift icons, skill icons) or no image at all: next/image keeps its plain loading.
  expect(blurPlaceholder('https://example.com/unknown.webp')).toEqual({})
  expect(blurPlaceholder(null)).toEqual({})
})
