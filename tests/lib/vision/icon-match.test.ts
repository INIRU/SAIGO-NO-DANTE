import { expect, it } from 'vitest'
import { acceptedIcon, iconTemplate, plateShaped, popupArtworkRegion, rankIcons, templateScore } from '../../../lib/vision/icon-match'

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

it('matches only acquisition-plate proportions', () => {
  expect(plateShaped({ x: 0, y: 0, width: 260, height: 120 })).toBe(true)
  expect(plateShaped({ x: 0, y: 0, width: 260, height: 88 })).toBe(false)
  expect(plateShaped({ x: 0, y: 0, width: 150, height: 120 })).toBe(false)
})

it('scores exactly as the plain masked correlation at every query size (precomputed pixel offsets)', () => {
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
    let dot = 0, sum = 0, squares = 0, index = 0
    for (let y = 0; y < template.size; y++) for (let x = 0; x < template.size; x++) {
      if (!template.mask[y * template.size + x]) continue
      for (let channel = 0; channel < 3; channel++) {
        const value = query[((top + y) * querySize + left + x) * 4 + channel]
        dot += template.vector[index++] * value
        sum += value
        squares += value * value
      }
    }
    const variance = squares - sum * sum / template.count
    return variance > 1e-6 ? dot / Math.sqrt(variance) : 0
  }
  for (const [size, querySize] of [[24, 36], [48, 67]]) {
    const template = iconTemplate('t', image(size, 0.3), size)
    const query = image(querySize, 0)
    for (const [left, top] of [[0, 0], [5, 7], [querySize - size, querySize - size]]) {
      expect(templateScore(template, query, querySize, left, top)).toBeCloseTo(plain(template, query, querySize, left, top), 10)
    }
  }
})
