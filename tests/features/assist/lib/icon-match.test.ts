import { expect, it } from 'vitest'
import { acceptedIcon, iconTemplate, plateShaped, popupArtworkRegion, rankIcons, rankIconsInRegion, templateScore } from '@/features/assist/lib/icon-match'

function icon(size: number, paint: (x: number, y: number) => [number, number, number] | null) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const color = paint(x, y)
    if (color) data.set([...color, 255], (y * size + x) * 4)
  }
  return data
}
const stripes = (size: number) => icon(size, (x, y) => (x + y) % 6 < 3 ? [220, 40, 40] : [30, 30, 200])
const rings = (size: number) => icon(size, (x, y) => Math.hypot(x - size / 2, y - size / 2) % 5 < 2 ? [240, 240, 60] : [20, 90, 20])

it('scores an identical icon near 1 and a different icon far lower, independent of brightness', () => {
  const template = iconTemplate('a', stripes(24), 24)
  expect(templateScore(template, stripes(24), 24, 0, 0)).toBeGreaterThan(0.99)
  const dimmed = stripes(24).map((value, index) => index % 4 === 3 ? value : value * 0.6)
  expect(templateScore(template, new Uint8ClampedArray(dimmed), 24, 0, 0)).toBeGreaterThan(0.99)
  expect(templateScore(template, rings(24), 24, 0, 0)).toBeLessThan(0.5)
})

it('finds the drawn icon above a plate and accepts it only with a clear lead', () => {
  const coarse = [iconTemplate('stripes', stripes(24), 24), iconTemplate('rings', rings(24), 24)]
  const fine = new Map([['stripes', iconTemplate('stripes', stripes(48), 48)], ['rings', iconTemplate('rings', rings(48), 48)]])
  const label = { x: 100, y: 300, width: 260, height: 120 }
  const art = popupArtworkRegion(label)
  // The sampler returns the stripes icon centred in a dark surround, as a popup crop would.
  const sample = (_x: number, _y: number, span: number, size: number) => {
    const inner = Math.round(size * art.size / span), offset = Math.floor((size - inner) / 2), drawn = stripes(inner)
    return icon(size, (x, y) => {
      const ix = x - offset, iy = y - offset
      if (ix < 0 || iy < 0 || ix >= inner || iy >= inner) return [10, 10, 10]
      const at = (iy * inner + ix) * 4
      return [drawn[at], drawn[at + 1], drawn[at + 2]]
    })
  }
  const ranked = rankIcons(sample, label, coarse, fine)
  expect(ranked[0].id).toBe('stripes')
  expect(acceptedIcon(ranked)?.id).toBe('stripes')
  expect(acceptedIcon([{ id: 'a', score: 0.95 }, { id: 'b', score: 0.8 }])).toBeNull()
  expect(acceptedIcon([{ id: 'a', score: 0.7 }])).toBeNull()
  expect(acceptedIcon([])).toBeNull()
})

it('REQ-ASSIST-046 tells plain white icons apart by their outline on the dark slot, and keeps dark icons by their colors', () => {
  // Like the white leaves 9750, which the inside-only correlation left out of the shortlist in a 2026-09-26 sample.
  const disc = (size: number) => icon(size, (x, y) => Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) < size * 0.35 ? [235, 235, 235] : null)
  const square = (size: number) => icon(size, (x, y) => Math.abs(x - size / 2 + 0.5) < size * 0.3 && Math.abs(y - size / 2 + 0.5) < size * 0.3 ? [235, 235, 235] : null)
  // The game draws the icon over its black slot.
  const onSlot = (drawn: Uint8ClampedArray) => drawn.map((value, index) => index % 4 === 3 ? 255 : value)
  const template = iconTemplate('disc', disc(24), 24)
  expect(templateScore(template, onSlot(disc(24)), 24, 0, 0)).toBeGreaterThan(0.95)
  expect(templateScore(template, onSlot(square(24)), 24, 0, 0)).toBeLessThan(0.8)
  // A dark icon whose outline barely stands out still matches on its colors, and not another dark icon.
  const darkStripes = stripes(24).map((value, index) => index % 4 === 3 ? value : value * 0.15)
  const darkRings = rings(24).map((value, index) => index % 4 === 3 ? value : value * 0.15)
  const dark = iconTemplate('dark', new Uint8ClampedArray(darkStripes), 24)
  expect(templateScore(dark, onSlot(new Uint8ClampedArray(darkStripes)), 24, 0, 0)).toBeGreaterThan(0.95)
  expect(templateScore(dark, onSlot(new Uint8ClampedArray(darkRings)), 24, 0, 0)).toBeLessThan(0.6)
})

it('REQ-ASSIST-046 never lets the small first pass drop a held gift from the ranking', () => {
  const coarse = [iconTemplate('stripes', stripes(24), 24), iconTemplate('rings', rings(24), 24)]
  const fine = new Map([['stripes', iconTemplate('stripes', stripes(48), 48)], ['rings', iconTemplate('rings', rings(48), 48)]])
  // A small pass that prefers the wrong icon (as a 16 px copy can) and keeps only one.
  const tiny = [iconTemplate('stripes', rings(16), 16), iconTemplate('rings', stripes(16), 16)]
  const sample = (_x: number, _y: number, _span: number, size: number) => icon(size, (x, y) => (x + y) % 6 < 3 ? [220, 40, 40] : [30, 30, 200])
  const art = { x: 0, y: 0, size: 24 }
  expect(rankIconsInRegion(sample, art, coarse, fine, tiny, 1)[0].id).toBe('rings')
  expect(rankIconsInRegion(sample, art, coarse, fine, tiny, 1, new Set(['stripes']))[0].id).toBe('stripes')
})

it('matches only acquisition-plate proportions', () => {
  expect(plateShaped({ x: 0, y: 0, width: 260, height: 120 })).toBe(true)
  expect(plateShaped({ x: 0, y: 0, width: 260, height: 88 })).toBe(false)
  expect(plateShaped({ x: 0, y: 0, width: 150, height: 120 })).toBe(false)
})

it('scores exactly as the better plain masked correlation (outline or inner) at every query size (precomputed pixel offsets)', () => {
  let seed = 11
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const image = (size: number, transparent: number) => {
    const data = new Uint8ClampedArray(size * size * 4)
    for (let pixel = 0; pixel < size * size; pixel++) {
      data.set([random() * 255, random() * 255, random() * 255, random() < transparent ? 0 : 255], pixel * 4)
    }
    return data
  }
  const plain = (template: ReturnType<typeof iconTemplate>, query: Uint8ClampedArray, querySize: number, left: number, top: number) => {
    const correlation = (weights: Float32Array, count: number) => {
      let dot = 0, sum = 0, squares = 0
      for (let index = 0; index < count; index++) {
        const pixel = template.pixels[Math.floor(index / 3)], x = pixel % template.size, y = Math.floor(pixel / template.size)
        const value = query[((top + y) * querySize + left + x) * 4 + index % 3]
        dot += weights[index] * value
        sum += value
        squares += value * value
      }
      const variance = squares - sum * sum / count
      return variance > 1e-6 ? dot / Math.sqrt(variance) : 0
    }
    return Math.max(correlation(template.vector, template.count), correlation(template.inner, template.innerCount))
  }
  for (const [size, querySize] of [[24, 36], [48, 67]]) {
    const template = iconTemplate('t', image(size, 0.3), size)
    const query = image(querySize, 0)
    for (const [left, top] of [[0, 0], [5, 7], [querySize - size, querySize - size]]) {
      expect(templateScore(template, query, querySize, left, top)).toBeCloseTo(plain(template, query, querySize, left, top), 10)
    }
  }
})
