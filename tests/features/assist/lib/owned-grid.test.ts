import { describe, expect, it } from 'vitest'
import { ownedGridGifts, ownedGridOffset, ownedGridRegions, yellowRows } from '@/features/assist/lib/owned-grid'

describe('the sell window owned list', () => {
  it('finds the scroll where the slot rims and price coins are yellow', () => {
    const profile = new Array(418).fill(0)
    for (let top = 47 - 160; top < 418; top += 160)
      for (const [from, to] of [[0, 28], [105, 132]]) for (let y = Math.max(0, top + from); y < Math.min(418, top + to); y++) profile[y] = 30
    expect(ownedGridOffset(profile)).toBe(50) // the 3 pixels it lands above the truth on real screens are added back
  })

  it('takes only the slots wholly inside the view, five a row', () => {
    expect(ownedGridRegions(1920, 1080, 0)).toHaveLength(15) // rows at 326, 486 and 646
    expect(ownedGridRegions(1920, 1080, 100)).toHaveLength(10) // the top row cut off
    const [first] = ownedGridRegions(1280, 720, 0)
    expect(first).toEqual({ x: (980 + 44) * 1280 / 1920, y: (326 + 44) * 1280 / 1920, size: 88 * 1280 / 1920 })
  })

  it('counts the hazard yellow of a row', () => {
    const pixels = new Uint8ClampedArray([230, 170, 30, 255, 40, 40, 40, 255, 230, 170, 30, 255, 200, 200, 200, 255])
    expect(yellowRows(pixels, 2)).toEqual([1, 1])
  })

  it('names only strong reads', () => {
    expect(ownedGridGifts([{ id: '9001', score: 0.95, margin: 0.9 }, { id: '9002', score: 0.7, margin: 0.5 }, { blank: true }, null] as never)).toEqual(['9001'])
  })
})
