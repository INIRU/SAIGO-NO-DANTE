import { describe, expect, it } from 'vitest'
import { fitGrid, floorLayout, giftBadges, pickPipMode, pipDensity, PIP_MODES, type PipModeContext } from '@/lib/planner/pip-view'
import { pipTips } from '@/lib/planner/pip-tips'
import { createInitialRunState, runReducer } from '@/lib/planner/run-types'

const none: PipModeContext = { event: false, selectingPack: false, skillExchange: false, formation: false, start: false, packChosen: true, fusion: false }

describe('which view the PiP shows', () => {
  it('follows the priority table, first rule first', () => {
    expect(pickPipMode(none)).toBe('floor')
    expect(pickPipMode({ ...none, fusion: true })).toBe('fusion')
    expect(pickPipMode({ ...none, packChosen: false, fusion: true })).toBe('pack-choice')
    expect(pickPipMode({ ...none, packChosen: false, start: true })).toBe('start')
    expect(pickPipMode({ ...none, start: true, formation: true })).toBe('formation')
    expect(pickPipMode({ ...none, formation: true, skillExchange: true })).toBe('skill-exchange')
    expect(pickPipMode({ ...none, skillExchange: true, event: true })).toBe('event')
  })

  it('lets a pack selection screen end a ? room still on record', () => {
    expect(pickPipMode({ ...none, event: true, selectingPack: true, packChosen: false })).toBe('pack-choice')
  })

  it('always has a view (the last rule holds for anything)', () => {
    expect(PIP_MODES.at(-1)!.when({ ...none, packChosen: true })).toBe(true)
  })
})

describe('layout by window size', () => {
  it('names the density: compact under 360 wide or 340 tall, wide at 560+ and 1.25 times as wide as tall', () => {
    expect(pipDensity(320, 280)).toBe('compact')
    expect(pipDensity(380, 420)).toBe('regular')
    expect(pipDensity(480, 640)).toBe('regular')
    expect(pipDensity(640, 420)).toBe('wide')
    expect(pipDensity(600, 520)).toBe('regular')
  })

  it('puts memo and tips beside the gifts only on wide windows that have them, and tightens small ones', () => {
    expect(floorLayout('wide', true).side).toBe(true)
    expect(floorLayout('wide', false).side).toBe(false)
    expect(floorLayout('regular', true).side).toBe(false)
    expect(floorLayout('compact', true)).toMatchObject({ side: false, compactTips: true, memoLines: 2 })
  })

  it('fills a scrolling row with as many icons as fit at the smallest size, then grows them', () => {
    // 344 wide, gap 6, min 56: five columns (5*56+4*6 = 304), each grows to (344-24)/5 = 64
    expect(fitGrid({ count: 20, width: 344, gap: 6, min: 56, max: 76 })).toEqual({ columns: 5, size: 64 })
    // fewer gifts than columns: one column per gift, capped at max
    expect(fitGrid({ count: 2, width: 344, gap: 6, min: 56, max: 76 })).toEqual({ columns: 2, size: 76 })
  })

  it('fits a set into a box at the largest size that holds all of it', () => {
    // 5 gifts in 180x220: two columns of 88 is capped at 56, so the tie goes to more columns (3 x 56, two rows)
    expect(fitGrid({ count: 5, width: 180, height: 220, min: 28, max: 56, maxColumns: 6 })).toEqual({ columns: 3, size: 56 })
    // 12 gifts in 120x80: nothing fits at 28, so the row fills at 28 and the box scrolls
    expect(fitGrid({ count: 12, width: 120, height: 80, min: 28, max: 56, maxColumns: 6 })).toEqual({ columns: 3, size: 28 })
  })

  it('lists a gift\'s marks in table order', () => {
    const rows = [
      { ids: new Set([1, 2]), badge: { key: 'plan', label: 'plan', tone: 'plan' as const } },
      { ids: new Set([2, 3]), badge: { key: 'bonus', label: 'bonus', tone: 'info' as const } },
    ]
    expect(giftBadges(2, rows).map(badge => badge.key)).toEqual(['plan', 'bonus'])
    expect(giftBadges(4, rows)).toEqual([])
  })
})

describe('tips', () => {
  const started = { ...createInitialRunState('normal'), phase: 'playing' as const }
  const withBonus = runReducer(started, { type: 'SET_FLOOR_CLEAR_BONUS', floor: 1, giftIds: ['9721', '9722'] })
  const context = { state: withBonus, viewFloor: 1, planned: new Set([9722]), owned: new Set<number>(), offer: null, offerFloor: null }

  it('shows the floor\'s clear bonus on the floor view only, with the floor\'s picks', () => {
    expect(pipTips({ ...context, mode: 'floor' })).toEqual([{ kind: 'clear-bonus', gifts: [9721, 9722], picks: 1 }])
    expect(pipTips({ ...context, mode: 'fusion' })).toEqual([])
    expect(pipTips({ ...context, mode: 'floor', viewFloor: 2 })).toEqual([])
  })

  it('lists on a selection screen the cards whose bonus holds a gift the plan still wants', () => {
    const offer = { floor: 1, observedAt: 0, cards: [
      { place: 648, gifts: ['9001'] },
      { place: 964, gifts: ['9722', '9001'], themeIds: ['1105'] },
    ] }
    expect(pipTips({ ...context, mode: 'pack-choice', offer })).toEqual([{ kind: 'clear-bonus-offer', picks: 1,
      cards: [{ place: 964, index: 1, gifts: [9722, 9001], themeId: '1105' }] }])
    // owned already, or the offer was for another floor: nothing to tell
    expect(pipTips({ ...context, mode: 'pack-choice', offer, owned: new Set([9722]) })).toEqual([])
    expect(pipTips({ ...context, mode: 'pack-choice', offer: { ...offer, floor: 2 } })).toEqual([])
    // floor not read on the screen: the floor being chosen stands in
    expect(pipTips({ ...context, mode: 'pack-choice', offer: { ...offer, floor: null }, offerFloor: 1 })).toHaveLength(1)
  })
})
