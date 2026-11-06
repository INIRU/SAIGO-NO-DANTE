import { describe, expect, it } from 'vitest'
import { BONUS_PLACES, bonusBandPlaces, bonusIconRegions, bonusLayout, bonusLineShare, bonusLineStrip, bonusPicks, cardOfTheme,
  offerKey, BONUS_STRIP_ROWS } from '@/features/assist/lib/clear-bonus'
import { createInitialRunState, normalizeRunState, runReducer } from '@/features/planner/lib/run-types'
import type { FusionSlotRead } from '@/features/assist/lib/fusion-evidence'

const strong = (id: string): FusionSlotRead => ({ id, score: 0.97, margin: 0.9 })
const weak = (id: string): FusionSlotRead => ({ id, score: 0.5, margin: 0.1 })

describe('clear bonus layout', () => {
  it('reads four, three, two or one icons by the parity that reads strongly', () => {
    // positions -3..3 half steps: four icons on 0 2 4 6, three on 1 3 5, two on 2 4, one on 3
    expect(bonusLayout([strong('a'), weak('x'), strong('b'), weak('y'), strong('c'), null, strong('d')])).toEqual(['a', 'b', 'c', 'd'])
    expect(bonusLayout([null, strong('a'), weak('x'), strong('b'), weak('y'), strong('c'), null])).toEqual(['a', 'b', 'c'])
    expect(bonusLayout([null, null, strong('a'), weak('x'), strong('b'), null, null])).toEqual(['a', 'b'])
    expect(bonusLayout([null, null, weak('x'), strong('a'), null, null, null])).toEqual(['a'])
  })

  it('reads nothing from an empty or doubtful band, and never a blank', () => {
    expect(bonusLayout([null, null, null, null, null, null, null])).toEqual([])
    expect(bonusLayout([null, weak('a'), null, weak('b'), null, weak('c'), null])).toEqual([])
    expect(bonusLayout([null, null, { blank: true }, null, { blank: true }, null, null])).toEqual([])
  })

  it('places the icons on the measured 1920x1080 layout, scaled by the width and centred', () => {
    // the labelled 1280x720 sample (theme en-1280x720-301-10-s-0): the card at 1280 UI holds four icons centred at x 787.5,
    // 831.5, 874.5, 918.5
    const regions = bonusIconRegions(1280, 720, BONUS_PLACES.odd[3])
    const icons = [0, 2, 4, 6].map(index => regions[index].x)
    icons.forEach((x, i) => expect(Math.abs(x - [787.5, 831.5, 874.5, 918.5][i])).toBeLessThan(2))
    expect(regions[3].y).toBeCloseTo(843.6 * 2 / 3, 1)
    // 4:3 (1440x1080): the UI is scaled by the width and centred vertically
    expect(bonusIconRegions(1440, 1080, 964)[3].y).toBeCloseTo((1080 - 810) / 2 + 843.6 * 0.75, 1)
  })
})

describe('clear bonus bands', () => {
  // a strip of `width` columns, a bright one-pixel line on the middle row of `lit` of them
  const strip = (width: number, lit: number, value = [74, 97, 199]) => {
    const height = BONUS_STRIP_ROWS * 2 + 1
    const data = new Uint8ClampedArray(width * height * 4).fill(4)
    for (let x = 0; x < lit; x++) {
      const at = (BONUS_STRIP_ROWS * width + x) * 4
      data[at] = value[0]; data[at + 1] = value[1]; data[at + 2] = value[2]
    }
    return { data, width, height }
  }

  it('sees the top line in any colour, and not plain dark rows', () => {
    const blue = strip(100, 80), red = strip(100, 100, [200, 40, 30]), washed = strip(100, 100, [60, 64, 84]), none = strip(100, 0)
    expect(bonusLineShare(blue.data, blue.width, blue.height)).toBeCloseTo(0.8)
    expect(bonusLineShare(red.data, red.width, red.height)).toBe(1)
    expect(bonusLineShare(washed.data, washed.width, washed.height)).toBe(1)
    expect(bonusLineShare(none.data, none.width, none.height)).toBe(0)
  })

  it('takes the odd places for three or five cards and the even ones for four', () => {
    expect(bonusBandPlaces([0, 0.9, 1, 0.95, 0], [0.4, 0.3, 0.3, 0.4])).toEqual(BONUS_PLACES.odd.slice(1, 4))
    expect(bonusBandPlaces([0.3, 0.3, 0.2, 0.3, 0.3], [0.9, 1, 1, 0.9])).toEqual(BONUS_PLACES.even)
  })

  it('samples the strip around the line under the card', () => {
    expect(bonusLineStrip(1920, 1080, 964)).toEqual({ x: 864, y: 807 - BONUS_STRIP_ROWS, width: 200, height: BONUS_STRIP_ROWS * 2 + 1 })
  })
})

describe('the floor pack\'s card', () => {
  const cards = [
    { place: 648, gifts: ['9001', '9002'] },
    { place: 964, gifts: ['9721', '9722', '9001'] },
    { place: 1280, gifts: ['9290', '9291'], themeIds: ['1028'] },
  ]

  it('is the card named as the pack', () => {
    expect(cardOfTheme(cards, '1028', null)).toBe(cards[2])
  })

  it('else the only unnamed card whose gifts all lie in the pack pool', () => {
    expect(cardOfTheme(cards, '1105', new Set(['9721', '9722', '9723', '9001']))).toBe(cards[1])
    // both unnamed cards fit: not settled
    expect(cardOfTheme(cards, '1105', new Set(['9721', '9722', '9001', '9002']))).toBeNull()
    expect(cardOfTheme(cards, '1105', null)).toBeNull()
  })

  it('keys an offer by places and gifts, and picks one bonus gift on normal floors, two on harder ones', () => {
    expect(offerKey(cards)).toBe('648:9001,9002|964:9721,9722,9001|1280:9290,9291')
    expect(bonusPicks('normal')).toBe(1)
    expect(bonusPicks('hard')).toBe(2)
  })
})

describe('floor log', () => {
  it('keeps a floor\'s clear bonus and restores it from a saved run', () => {
    const started = { ...createInitialRunState('normal'), phase: 'playing' as const }
    const next = runReducer(started, { type: 'SET_FLOOR_CLEAR_BONUS', floor: 2, giftIds: ['9721', '9721', '9722'] })
    expect(next.floorLogs[1].clearBonus).toEqual(['9721', '9722'])
    expect(next.floorLogs[0].clearBonus).toBeUndefined()
    expect(normalizeRunState(JSON.parse(JSON.stringify(next))).floorLogs[1].clearBonus).toEqual(['9721', '9722'])
  })
})
