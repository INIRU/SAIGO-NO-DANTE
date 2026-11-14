import { describe, expect, it } from 'vitest'
import { choiceListBoxes, cursorRegion, readableOptionCount } from '@/features/assist/lib/event-list-read'
import { distinctBoxes, type ChoiceBand } from '@/features/assist/lib/event-pick'
import { gameTextPieces } from '@/features/assist/lib/text-normalize'
import type { ChoiceBox } from '@/features/assist/lib/ocr-match'

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Choice = { id: string; eventId: string; texts: string[] }
// the hook's old inline code (the replay and the live read had the same lines), copied as it was
const legacyBoxes = (boxes: ChoiceBox[], width: number) => distinctBoxes(boxes.filter(box => box.left >= 0.45 * width && box.left <= 0.75 * width))
const legacyOptions = (choices: Choice[], boxes: ChoiceBox[]) => {
  const first = boxes.length ? choices.find(item => item.id === boxes[0].choiceId) : undefined
  return first ? new Set(choices.filter(item => item.eventId === first.eventId)
    .map(item => gameTextPieces(item.texts[0] ?? '').join('')).filter(text => [...text].length >= 4)).size : 0
}
const legacyRegion = (bands: ChoiceBand[], width: number, height: number) => {
  const margin = 60 * Math.min(width / 1920, height / 1080)
  const left = Math.min(...bands.map(band => band.left)) - margin, top = Math.min(...bands.map(band => band.top)) - margin
  return { x: left, y: top, width: Math.max(...bands.map(band => band.right)) + margin - left, height: Math.max(...bands.map(band => band.bottom)) + margin - top }
}

const NAMES = ['도망친다', '싸운다', '기도한다', '가', '문을 연다', '무시', '조용히 지나간다', 'Run', 'Fight away', 'ab']
function catalog(next: () => number): Choice[] {
  return Array.from({ length: 1 + Math.floor(next() * 12) }, (_, index) => ({ id: `c${index}`, eventId: `e${Math.floor(next() * 3)}`,
    texts: next() < 0.1 ? [] : [NAMES[Math.floor(next() * NAMES.length)]] }))
}
function boxesFor(next: () => number, choices: Choice[], width: number): ChoiceBox[] {
  return Array.from({ length: Math.floor(next() * 6) }, () => ({ choiceId: choices[Math.floor(next() * choices.length)].id,
    left: Math.round(next() * width), top: Math.round(next() * 1000), width: 200 + Math.round(next() * 300), height: 40 + Math.round(next() * 40) }))
}

describe('choiceListBoxes', () => {
  it('keeps only lines right of the middle, up to three quarters of the width', () => {
    const box = (left: number): ChoiceBox => ({ choiceId: `c${left}`, left, top: left, width: 100, height: 50 })
    const kept = choiceListBoxes([box(0.44 * 1000), box(0.45 * 1000), box(0.75 * 1000), box(0.76 * 1000)], 1000).map(item => item.left)
    expect(kept).toEqual([450, 750])
    expect(choiceListBoxes([], 1920)).toEqual([])
  })
  it('matches the old filter on random boxes and widths', () => {
    const next = random(5)
    for (let run = 0; run < 300; run++) {
      const choices = catalog(next)
      const width = [640, 1280, 1920, 2560, 3840][Math.floor(next() * 5)]
      const boxes = boxesFor(next, choices, width)
      expect(choiceListBoxes(boxes, width)).toEqual(legacyBoxes(boxes, width))
    }
  })
})

describe('readableOptionCount', () => {
  it('is 0 without a choice or for an unknown one, and counts distinct readable names of its event', () => {
    const choices: Choice[] = [{ id: 'a', eventId: '1', texts: ['도망친다'] }, { id: 'b', eventId: '1', texts: ['조용히 지나간다'] },
      { id: 'c', eventId: '1', texts: ['가'] }, { id: 'd', eventId: '2', texts: ['기도한다'] }]
    expect(readableOptionCount(choices, undefined)).toBe(0)
    expect(readableOptionCount(choices, 'zz')).toBe(0)
    expect(readableOptionCount([], 'a')).toBe(0)
    expect(readableOptionCount(choices, 'a')).toBe(2)
    expect(readableOptionCount(choices, 'd')).toBe(1)
  })
  it('matches the old count on random catalogs, first boxes included', () => {
    const next = random(77)
    for (let run = 0; run < 400; run++) {
      const choices = catalog(next)
      const boxes = boxesFor(next, choices, 1920)
      expect(readableOptionCount(choices, boxes.length ? boxes[0].choiceId : undefined)).toBe(legacyOptions(choices, boxes))
    }
  })
})

describe('cursorRegion', () => {
  it('wraps all the bands with a margin scaled to the frame', () => {
    const bands: ChoiceBand[] = [{ choiceId: 'a', left: 1000, top: 300, right: 1500, bottom: 380 }, { choiceId: 'b', left: 980, top: 400, right: 1600, bottom: 480 }]
    expect(cursorRegion(bands, 1920, 1080)).toEqual({ x: 920, y: 240, width: 740, height: 300 })
    expect(cursorRegion(bands, 960, 540)).toEqual({ x: 950, y: 270, width: 680, height: 240 })
  })
  it('matches the old region on random bands and frame sizes', () => {
    const next = random(91)
    for (let run = 0; run < 300; run++) {
      const bands: ChoiceBand[] = Array.from({ length: 1 + Math.floor(next() * 5) }, (_, index) => {
        const left = next() * 1500, top = next() * 800
        return { choiceId: `c${index}`, left, top, right: left + 100 + next() * 400, bottom: top + 40 + next() * 60 }
      })
      const width = [1280, 1366, 1920, 2560, 3840][Math.floor(next() * 5)], height = Math.round(width * 9 / 16 * (next() < 0.3 ? 1.1 : 1))
      expect(cursorRegion(bands, width, height)).toEqual(legacyRegion(bands, width, height))
    }
  })
})
