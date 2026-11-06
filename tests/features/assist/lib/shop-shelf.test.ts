import { describe, expect, it } from 'vitest'
import { gameUiTransform, shopShelfRegions, soldMark, SHOP_SOLD_MIN, titleBarRows } from '@/features/assist/lib/shop-shelf'

describe('gameUiTransform', () => {
  it('scales the 1920x1080 UI by the width and centres it vertically', () => {
    expect(gameUiTransform(1920, 1080)).toEqual({ scale: 1, left: 0, top: 0 })
    expect(gameUiTransform(1280, 720)).toMatchObject({ scale: 1280 / 1920, top: 0 })
    // 4:3: bars above and below
    expect(gameUiTransform(1440, 1080)).toEqual({ scale: 0.75, left: 0, top: (1080 - 810) / 2 })
    // 21:9: the UI is wider than the frame is tall, its top and bottom run out of the frame
    expect(gameUiTransform(1920, 823)).toEqual({ scale: 1, left: 0, top: (823 - 1080) / 2 })
  })
})

describe('shopShelfRegions', () => {
  it('the eight shelf slots at 1920x1080, two rows of four', () => {
    const regions = shopShelfRegions(1920, 1080)
    expect(regions).toHaveLength(8)
    expect(regions[0]).toMatchObject({ x: expect.closeTo(937, 0), y: expect.closeTo(395.6, 0), size: 66 })
    expect(regions[7]).toMatchObject({ x: expect.closeTo(1628.8, 0), y: expect.closeTo(625.6, 0) })
  })

  it('follows the width at 21:9 (measured 1920x823: first-row centres at y 267)', () => {
    const [first] = shopShelfRegions(1920, 823)
    expect(first.x).toBeCloseTo(937, 0)
    expect(first.y).toBeCloseTo(267, 0)
    expect(first.size).toBe(66)
  })
})

describe('titleBarRows', () => {
  it('counts the bright strip a window share starts with, and nothing else', () => {
    expect(titleBarRows([...Array(30).fill(240), ...Array(30).fill(20)], 720)).toBe(30)
    expect(titleBarRows(Array(60).fill(20), 720)).toBe(0)
    // a few bright rows are game art, not a title bar
    expect(titleBarRows([...Array(4).fill(240), ...Array(56).fill(20)], 720)).toBe(0)
  })
})

describe('soldMark', () => {
  const band = (orange: number, total = 100) => {
    const pixels = new Uint8ClampedArray(total * 4)
    for (let i = 0; i < total; i++) pixels.set(i < orange ? [230, 150, 40, 255] : [30, 28, 27, 255], i * 4)
    return pixels
  }
  it('a slot reads as sold when the band over it carries the orange 구매 완료 text', () => {
    expect(soldMark(band(20))).toBeGreaterThanOrEqual(SHOP_SOLD_MIN)
    expect(soldMark(band(0))).toBeLessThan(SHOP_SOLD_MIN)
  })
})
