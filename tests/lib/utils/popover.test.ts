import { describe, expect, it } from 'vitest'
import { placePopover } from '@/lib/utils/popover'

const anchor = (left: number, top: number, width = 80, height = 24) => ({ left, top, right: left + width, bottom: top + height, width, height })
const view = { width: 1000, height: 800 }
const widths = [336, 448, 576]
/** Text of a fixed area: the wider the card, the shorter it gets. */
const text = (area: number) => (width: number) => Math.ceil(area / width)

describe('REQ-COMMUNITY-061 a hover card widens before it grows tall', () => {
  it('REQ-COMMUNITY-061 uses the narrowest width when its height fits', () => {
    expect(placePopover({ anchor: anchor(100, 100), view, widths, measureHeight: text(336 * 100) }))
      .toEqual({ left: 100, top: 132, above: false, width: 336, maxHeight: undefined })
  })
  it('REQ-COMMUNITY-061 widens step by step while the card is taller than 60% of the screen', () => {
    // 60% of 800 = 480: 500 tall at 336, 375 at 448
    expect(placePopover({ anchor: anchor(100, 100), view, widths, measureHeight: text(336 * 500) }).width).toBe(448)
    // 700 at 336, 525 at 448, 408 at 576
    expect(placePopover({ anchor: anchor(100, 100), view, widths, measureHeight: text(336 * 700) }).width).toBe(576)
  })
  it('REQ-COMMUNITY-061 widens when the free side is shorter than the card', () => {
    // room below the name: 800 - 624 - 16 = 160; above: 600 - 16 = 584
    const result = placePopover({ anchor: anchor(100, 600), view, widths, measureHeight: text(336 * 200) })
    expect(result.width).toBe(336)
    expect(result.above).toBe(true)
  })
  it('REQ-COMMUNITY-061 goes above the name when it fits there and not below', () => {
    expect(placePopover({ anchor: anchor(100, 700), view, widths, measureHeight: () => 150 }))
      .toMatchObject({ left: 100, top: 692, above: true, width: 336 })
  })
  it('REQ-COMMUNITY-061 stays below while it fits below', () => {
    expect(placePopover({ anchor: anchor(100, 300), view, widths, measureHeight: () => 150 }).above).toBe(false)
  })
  it('REQ-COMMUNITY-061 takes the widest width and caps the height to the roomier side when nothing fits', () => {
    const tall = placePopover({ anchor: anchor(100, 700), view, widths, measureHeight: text(336 * 2000) })
    expect(tall).toMatchObject({ width: 576, above: true, maxHeight: 480 })
    // a screen too short for 60% of it: the free side (190 - 8 - 8 above the name) is the cap
    const short = placePopover({ anchor: anchor(100, 190), view: { width: 1000, height: 300 }, widths, measureHeight: text(336 * 2000) })
    expect(short).toMatchObject({ width: 576, above: true, maxHeight: 174 })
  })
  it('REQ-COMMUNITY-061 never goes wider than the screen minus the gutters', () => {
    const measured: number[] = []
    const result = placePopover({ anchor: anchor(20, 100), view: { width: 300, height: 800 }, widths, measureHeight: width => { measured.push(width); return 100 } })
    expect(result).toMatchObject({ width: 284, left: 8 })
    expect(measured).toEqual([284])
  })
  it('REQ-COMMUNITY-061 stays inside the screen sideways', () => {
    expect(placePopover({ anchor: anchor(900, 100), view, widths, measureHeight: () => 100 }).left).toBe(1000 - 8 - 336)
    expect(placePopover({ anchor: anchor(-20, 100), view, widths, measureHeight: () => 100 }).left).toBe(8)
  })
  it('REQ-COMMUNITY-061 can centre the card on the name', () => {
    expect(placePopover({ anchor: anchor(460, 100), view, widths, measureHeight: () => 100, align: 'center' }).left).toBe(500 - 336 / 2)
  })
})

describe('REQ-KEYWORDS-013 a tooltip widens before it scrolls', () => {
  it('REQ-KEYWORDS-013 tries the widths narrowest first and stops at the first that fits', () => {
    const measured: number[] = []
    const result = placePopover({ anchor: anchor(100, 100), view, widths: [352, 528, 704], gap: 8, margin: 12, align: 'center',
      measureHeight: width => { measured.push(width); return width < 500 ? 600 : 300 } })
    expect(result.width).toBe(528)
    expect(measured).toEqual([352, 528])
  })
})
