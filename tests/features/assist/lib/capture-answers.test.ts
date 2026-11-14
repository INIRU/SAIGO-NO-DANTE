import { describe, expect, it } from 'vitest'
import { floorReadVerdict, mergeOcrEngines, parseBlessingLevels, parseBonusCards, parseCursorSample, parseFormationIds, parseOcrBackend,
  parseOwnedGifts, parsePopupRead, parseThemeReads, type OcrEngine } from '@/features/assist/lib/capture-answers'

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(next: () => number, values: readonly T[]) => values[Math.floor(next() * values.length)]
/** Values a worker could send where a number, text, list or object is expected. */
const JUNK: unknown[] = [undefined, null, 0, 1, 2.5, -1, NaN, Infinity, '', 'x', true, false, [], {}, [null], ['a'], [1]]

describe('parseOcrBackend', () => {
  it('reads PP-OCR with its adapter and Tesseract with its loading flag', () => {
    expect(parseOcrBackend({ engine: 'paddle', adapter: 'a'.repeat(80), loading: true })).toEqual({ engine: 'paddle', adapter: 'a'.repeat(60), loading: false })
    expect(parseOcrBackend({ engine: 'tesseract', adapter: 'x', loading: true, reason: 'r'.repeat(50) }))
      .toEqual({ engine: 'tesseract', adapter: '', loading: true, reason: 'r'.repeat(40) })
    expect(parseOcrBackend({})).toEqual({ engine: 'tesseract', adapter: '', loading: false })
  })
  it('matches the old inline reading on random reports', () => {
    const next = random(1)
    for (let run = 0; run < 300; run++) {
      const result = { engine: pick(next, ['paddle', 'tesseract', 'other', undefined]), adapter: pick(next, ['gpu', 'x'.repeat(90), undefined, 5 as unknown as string]),
        loading: pick(next, [true, false, undefined]), reason: pick(next, ['no-gpu', 'y'.repeat(70), undefined, 3 as unknown as string]) }
      const legacy = { engine: result.engine === 'paddle' ? 'paddle' : 'tesseract',
        adapter: result.engine === 'paddle' && typeof result.adapter === 'string' ? result.adapter.slice(0, 60) : '',
        loading: result.engine !== 'paddle' && result.loading === true,
        ...(typeof result.reason === 'string' ? { reason: result.reason.slice(0, 40) } : {}) }
      expect(parseOcrBackend(result)).toEqual(legacy)
    }
  })
})

describe('mergeOcrEngines', () => {
  const paddle = (adapter = 'gpu', extra: Partial<OcrEngine> = {}): OcrEngine => ({ engine: 'paddle', adapter, loading: false, ...extra })
  const tesseract = (extra: Partial<OcrEngine> = {}): OcrEngine => ({ engine: 'tesseract', adapter: '', loading: false, ...extra })
  it('shows the first report while a worker has not reported, null when none has', () => {
    expect(mergeOcrEngines([null, null])).toBeNull()
    expect(mergeOcrEngines([null, tesseract()])).toEqual(tesseract())
  })
  it('is PP-OCR only when every worker runs it', () => {
    expect(mergeOcrEngines([paddle('a'), paddle('b')])).toEqual(paddle('a'))
    expect(mergeOcrEngines([paddle(), tesseract({ loading: true, reason: 'x' })])).toEqual({ engine: 'tesseract', adapter: '', loading: true, reason: 'x' })
  })
  it('matches the old publishEngine on random worker sets', () => {
    const next = random(2)
    const legacy = (engines: (OcrEngine | null)[]) => {
      if (engines.some(engine => !engine)) return engines.find(Boolean) ?? null
      const all = engines as OcrEngine[]
      const isPaddle = all.every(engine => engine.engine === 'paddle')
      return { engine: isPaddle ? 'paddle' : 'tesseract', adapter: isPaddle ? all[0].adapter : '', loading: all.some(engine => engine.loading),
        ...(all.find(engine => engine.reason)?.reason ? { reason: all.find(engine => engine.reason)!.reason } : {}) }
    }
    for (let run = 0; run < 300; run++) {
      const engines = Array.from({ length: 1 + Math.floor(next() * 2) }, () => next() < 0.2 ? null : ({ engine: pick(next, ['paddle', 'tesseract'] as const), adapter: pick(next, ['', 'g1', 'g2']),
        loading: next() < 0.3, ...(next() < 0.3 ? { reason: pick(next, ['', 'no-gpu', 'slow']) } : {}) }))
      expect(mergeOcrEngines(engines)).toEqual(legacy(engines))
    }
  })
})

describe('parsePopupRead', () => {
  it('uses the effect panel labels when they are well formed, else the plate read alone', () => {
    const labels = [{ text: 'a', words: [] }, { text: 'b', words: [] }]
    expect(parsePopupRead({ label: 'plate', labelWords: [], labels, body: 'body', lexicon: { id: '7' } })).toEqual({ labels, body: 'body', lexiconId: '7' })
    expect(parsePopupRead({ label: 'plate', labelWords: [], labels: [{ text: 5 }] as never })).toEqual({ labels: [{ text: 'plate', words: [] }], body: '', lexiconId: null })
    expect(parsePopupRead({ label: 'plate', labelWords: [], lexicon: null })).toEqual({ labels: [{ text: 'plate', words: [] }], body: '', lexiconId: null })
  })
  it('matches the old inline reading on random answers', () => {
    const next = random(4)
    for (let run = 0; run < 400; run++) {
      const result = { label: 'plate', labelWords: [] as never[], labels: pick(next, [undefined, [], [{ text: 'a', words: [] }], [{ text: 1, words: [] }], [{ text: 'a' }], [null], 'x'] as unknown[]) as never,
        body: pick(next, JUNK) as string, lexicon: pick(next, [undefined, null, {}, { id: 4 }, { id: 'k' }] as ({ id?: unknown } | null | undefined)[]) }
      const raw = result.labels as unknown
      const legacyLabels = Array.isArray(raw) && raw.every((read: { text?: unknown; words?: unknown }) => typeof read?.text === 'string' &&
        Array.isArray(read.words)) ? raw : [{ text: result.label, words: result.labelWords }]
      expect(parsePopupRead(result)).toEqual({ labels: legacyLabels, body: typeof result.body === 'string' ? result.body : '',
        lexiconId: typeof result.lexicon?.id === 'string' ? result.lexicon.id : null })
    }
  })
})

describe('parseThemeReads', () => {
  it('keeps arrays of words that have text', () => {
    expect(parseThemeReads([[{ text: 'a' }, { text: 1 }, null], 'x', [], [{ text: 'b' }]])).toEqual([[{ text: 'a' }], [], [{ text: 'b' }]])
    expect(parseThemeReads(undefined)).toEqual([])
    expect(parseThemeReads('x')).toEqual([])
  })
  it('matches the old inline reading on random answers', () => {
    const next = random(6)
    for (let run = 0; run < 300; run++) {
      const raw = pick(next, [undefined, null, 'x', [], Array.from({ length: 1 + Math.floor(next() * 3) }, () =>
        pick(next, [[], null, 'a', [{ text: 'a' }, null, { text: 2 }, undefined, {}], [{ text: '' }]] as unknown[]))] as unknown[])
      const legacy = Array.isArray(raw) ? raw.filter(Array.isArray).map(read => read.filter((word: { text?: unknown }) => typeof word?.text === 'string')) : []
      expect(parseThemeReads(raw)).toEqual(legacy)
    }
  })
})

describe('floorReadVerdict', () => {
  it('agrees under the current or next floor, or a floor an earlier capture read within 3 minutes', () => {
    expect(floorReadVerdict({ floor: 5, at: 1000, previous: null, runFloor: 5 }).agreed).toBe(true)
    expect(floorReadVerdict({ floor: 6, at: 1000, previous: null, runFloor: 5 }).agreed).toBe(true)
    expect(floorReadVerdict({ floor: 7, at: 1000, previous: null, runFloor: 5 }).agreed).toBe(false)
    expect(floorReadVerdict({ floor: 7, at: 1000, previous: null, runFloor: null }).agreed).toBe(false)
    expect(floorReadVerdict({ floor: 7, at: 181_000, previous: { floor: 7, at: 1000 }, runFloor: null }).agreed).toBe(true)
    expect(floorReadVerdict({ floor: 7, at: 181_001, previous: { floor: 7, at: 1000 }, runFloor: null }).agreed).toBe(false)
  })
  it('counts the floor as observed when read again between 1 s and 60 s later, and keeps only a newer read', () => {
    expect(floorReadVerdict({ floor: 7, at: 1999, previous: { floor: 7, at: 1000 }, runFloor: null }).observed).toBe(false)
    expect(floorReadVerdict({ floor: 7, at: 2000, previous: { floor: 7, at: 1000 }, runFloor: null }).observed).toBe(true)
    expect(floorReadVerdict({ floor: 7, at: 61_000, previous: { floor: 7, at: 1000 }, runFloor: null }).observed).toBe(true)
    expect(floorReadVerdict({ floor: 7, at: 61_001, previous: { floor: 7, at: 1000 }, runFloor: null }).observed).toBe(false)
    expect(floorReadVerdict({ floor: 7, at: 1000, previous: { floor: 7, at: 1000 }, runFloor: null }).keep).toBe(false)
    expect(floorReadVerdict({ floor: 7, at: 1001, previous: { floor: 7, at: 1000 }, runFloor: null }).keep).toBe(true)
    expect(floorReadVerdict({ floor: 7, at: 5, previous: null, runFloor: null }).keep).toBe(true)
  })
  it('matches the old inline decisions on random reads, edges included', () => {
    const next = random(9)
    for (let run = 0; run < 1000; run++) {
      const floor = 1 + Math.floor(next() * 15)
      const previous = next() < 0.2 ? null : { floor: next() < 0.6 ? floor : 1 + Math.floor(next() * 15), at: 10_000 }
      const at = pick(next, [10_000, 10_001, 10_999, 11_000, 70_000, 70_001, 190_000, 190_001, 9_000, Math.floor(next() * 300_000)])
      const runFloor = next() < 0.2 ? null : 1 + Math.floor(next() * 15)
      const elapsed = previous ? at - previous.at : -1
      const agreed = (runFloor !== null && (floor === runFloor || floor === runFloor + 1)) || (previous?.floor === floor && elapsed > 0 && elapsed <= 180000)
      const observed = previous?.floor === floor && elapsed >= 1000 && elapsed <= 60000
      expect(floorReadVerdict({ floor, at, previous, runFloor })).toEqual({ agreed, observed, keep: !previous || at > previous.at })
    }
  })
})

describe('answer checks', () => {
  it('parseCursorSample needs two finite numbers', () => {
    expect(parseCursorSample({ x: 1, y: 2, pressed: true }, 7)).toEqual({ at: 7, x: 1, y: 2, pressed: true })
    expect(parseCursorSample({ x: 1, y: 2, pressed: 'yes' }, 7)).toEqual({ at: 7, x: 1, y: 2, pressed: false })
    expect(parseCursorSample({ x: NaN, y: 2 }, 7)).toBeNull()
    expect(parseCursorSample({ x: 1, y: '2' }, 7)).toBeNull()
    expect(parseCursorSample(null, 7)).toBeNull()
    expect(parseCursorSample(undefined, 7)).toBeNull()
  })
  it('parseCursorSample matches the old condition on random answers', () => {
    const next = random(10)
    for (let run = 0; run < 400; run++) {
      const cursor = pick(next, [undefined, null, { x: pick(next, JUNK), y: pick(next, JUNK), pressed: pick(next, JUNK) }]) as { x?: unknown; y?: unknown; pressed?: unknown } | null | undefined
      const legacy = cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number' && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)
        ? { at: 3, x: cursor.x, y: cursor.y, pressed: cursor.pressed === true } : null
      expect(parseCursorSample(cursor, 3)).toEqual(legacy)
    }
  })
  it('parseFormationIds needs twelve ids or nulls', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => index % 3 ? `1010${index}` : null)
    expect(parseFormationIds(twelve)).toBe(twelve)
    expect(parseFormationIds(twelve.slice(1))).toBeNull()
    expect(parseFormationIds([...twelve.slice(1), 5])).toBeNull()
    expect(parseFormationIds(undefined)).toBeNull()
  })
  it('parseBlessingLevels needs ten levels from 0 to 3', () => {
    const ten = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1]
    expect(parseBlessingLevels(ten)).toBe(ten)
    expect(parseBlessingLevels([...ten.slice(1)])).toBeNull()
    expect(parseBlessingLevels([...ten.slice(1), 4])).toBeNull()
    expect(parseBlessingLevels([...ten.slice(1), 1.5])).toBeNull()
    expect(parseBlessingLevels([...ten.slice(1), -1])).toBeNull()
    expect(parseBlessingLevels('0123456789')).toBeNull()
  })
  it('parseBonusCards needs a place and gift ids on every card; an empty list is valid', () => {
    const cards = [{ place: 1, gifts: ['a', 'b'] }, { place: 2, gifts: [] }]
    expect(parseBonusCards(cards)).toBe(cards)
    expect(parseBonusCards([])).toEqual([])
    expect(parseBonusCards([{ place: '1', gifts: [] }])).toBeNull()
    expect(parseBonusCards([{ place: 1, gifts: [1] }])).toBeNull()
    expect(parseBonusCards([null])).toBeNull()
    expect(parseBonusCards(undefined)).toBeNull()
  })
  it('parseOwnedGifts needs text ids', () => {
    expect(parseOwnedGifts(['a', 'b'])).toEqual(['a', 'b'])
    expect(parseOwnedGifts([])).toEqual([])
    expect(parseOwnedGifts(['a', 1])).toBeNull()
    expect(parseOwnedGifts({})).toBeNull()
  })
  it('match the old inline checks on random answers', () => {
    const next = random(12)
    const any = () => pick(next, [...JUNK, Array.from({ length: 12 }, () => pick(next, [null, 'a', 1])), Array.from({ length: 10 }, () => Math.floor(next() * 5) - 1),
      [{ place: 1, gifts: ['a'] }], [{ place: 1, gifts: [2] }], [{ place: 'x', gifts: [] }], ['a', 'b'], [{ place: 3 }]])
    for (let run = 0; run < 600; run++) {
      const value = any() as unknown
      const ids = value as (string | null)[] | null
      expect(parseFormationIds(value) !== null).toBe(Array.isArray(ids) && ids.length === 12 && ids.every(id => id === null || typeof id === 'string'))
      const levels = value as number[] | null
      expect(parseBlessingLevels(value) !== null).toBe(Array.isArray(levels) && levels.length === 10 && levels.every(level => Number.isInteger(level) && level >= 0 && level <= 3))
      const cards = value as { place?: unknown; gifts?: unknown }[] | null
      expect(parseBonusCards(value) !== null).toBe(Array.isArray(cards) && cards.every(card => card && typeof card.place === 'number' && Array.isArray(card.gifts) &&
        card.gifts.every((gift: unknown) => typeof gift === 'string')))
      const gifts = value as unknown[] | null
      expect(parseOwnedGifts(value) !== null).toBe(Array.isArray(gifts) && gifts.every(gift => typeof gift === 'string'))
    }
  })
})
