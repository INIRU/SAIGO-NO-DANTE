import { describe, expect, it } from 'vitest'
import { SCREEN_CHANGE, greyThumb, thumbDifference } from '../../../lib/vision/screen-change'

const frame = (fill: (i: number) => number) => greyThumb(Uint8ClampedArray.from({ length: 32 * 18 * 4 }, (_, i) => i % 4 === 3 ? 255 : fill(Math.floor(i / 4))))

describe('a screen change worth reading at once', () => {
  it('a dialog over a third of the screen passes the bar, a cursor-sized change does not', () => {
    const shop = frame(() => 40)
    const dialog = frame(i => (i % 32 >= 10 && i % 32 < 22 && Math.floor(i / 32) >= 4 && Math.floor(i / 32) < 14 ? 120 : 40))
    const cursor = frame(i => (i === 300 ? 230 : 40))
    expect(thumbDifference(shop, dialog)).toBeGreaterThan(SCREEN_CHANGE)
    expect(thumbDifference(shop, cursor)).toBeLessThan(SCREEN_CHANGE)
    expect(thumbDifference(shop, shop)).toBe(0)
  })

  it('thumbnails of different sizes never compare equal', () => {
    expect(thumbDifference(new Float32Array(4), new Float32Array(8))).toBe(Infinity)
  })
})
