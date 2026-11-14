import { describe, expect, it } from 'vitest'
import { addAcquisition, addFusion, addSales, bonusWithNames, nextBlessings, nextClearBonus, nextSkillExchange, nextWorkCounts, patchFusion,
  type Blessings } from '@/features/assist/lib/capture-lists'
import { named } from '@/features/assist/lib/capture-evidence'
import { blessingSpent } from '@/features/assist/lib/blessing-screen'
import { offerKey, type ClearBonusCard, type ClearBonusOffer } from '@/features/assist/lib/clear-bonus'

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(next: () => number, values: readonly T[]) => values[Math.floor(next() * values.length)]

describe('addAcquisition, addFusion and patchFusion', () => {
  const entry = (token: string, extra: { n?: number; closedAt?: number } = {}) => ({ token, ...extra })
  it('keeps a known acquisition as it is and caps the list at sixteen', () => {
    const items = Array.from({ length: 16 }, (_, index) => entry(`t${index}`))
    expect(addAcquisition(items, entry('t3'))).toBe(items)
    const grown = addAcquisition(items, entry('new'))
    expect(grown).toHaveLength(16)
    expect(grown.at(-1)).toEqual(entry('new'))
    expect(grown[0]).toEqual(entry('t1'))
    expect(addAcquisition([], entry('a'))).toEqual([entry('a')])
  })
  it('replaces a known dialog by its token and caps the list at eight', () => {
    const items = Array.from({ length: 8 }, (_, index) => entry(`t${index}`, { n: index }))
    const replaced = addFusion(items, entry('t2', { n: 99 }))
    expect(replaced.map(item => item.token)).toEqual(['t0', 't1', 't3', 't4', 't5', 't6', 't7', 't2'])
    expect(addFusion(items, entry('new')).map(item => item.token)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 'new'])
  })
  it('patches only the dialog with that token, and keeps the list when there is none', () => {
    const items = [entry('a', { closedAt: 0 }), entry('b', { closedAt: 0 })]
    expect(patchFusion(items, 'b', { closedAt: 5 })).toEqual([entry('a', { closedAt: 0 }), entry('b', { closedAt: 5 })])
    expect(patchFusion(items, 'zz', { closedAt: 5 })).toBe(items)
  })
  it('match the old setters on random sequences', () => {
    const next = random(13)
    let mine: { token: string; n: number }[] = [], old: { token: string; n: number }[] = []
    let mineFusion = mine, oldFusion = old
    for (let step = 0; step < 300; step++) {
      const item = { token: `t${Math.floor(next() * 25)}`, n: step }
      mine = addAcquisition(mine, item)
      old = old.some(other => other.token === item.token) ? old : [...old.slice(-15), item]
      mineFusion = addFusion(mineFusion, item)
      oldFusion = [...oldFusion.filter(other => other.token !== item.token).slice(-7), item]
      const token = `t${Math.floor(next() * 25)}`
      mineFusion = patchFusion(mineFusion, token, { n: -step })
      oldFusion = oldFusion.some(other => other.token === token) ? oldFusion.map(other => other.token === token ? { ...other, n: -step } : other) : oldFusion
      expect(mine).toEqual(old)
      expect(mineFusion).toEqual(oldFusion)
    }
  })
})

describe('addSales', () => {
  it('tokens each sale by its time and gift and keeps the last eight', () => {
    expect(addSales([], [{ giftId: '1', at: 5 }])).toEqual([{ giftId: '1', token: 'sell:5:1', capturedAt: 5 }])
    const items = Array.from({ length: 8 }, (_, index) => ({ giftId: `${index}`, token: `sell:${index}:${index}`, capturedAt: index }))
    const grown = addSales(items, [{ giftId: 'x', at: 50 }, { giftId: 'y', at: 51 }])
    expect(grown).toHaveLength(8)
    expect(grown.map(item => item.giftId)).toEqual(['2', '3', '4', '5', '6', '7', 'x', 'y'])
    expect(addSales(items, [])).toEqual(items)
  })
})

describe('nextSkillExchange', () => {
  const counts = (n: number) => ({ a: n }) as never
  it('shows a read, and holds the last one for 1.5 s of misses', () => {
    const shown = nextSkillExchange(null, { sinner: 3, current: counts(1) }, 1000)
    expect(shown).toEqual({ sinner: 3, current: counts(1), seenAt: 1000 })
    expect(nextSkillExchange(shown, null, 2500)).toBe(shown)
    expect(nextSkillExchange(shown, null, 2501)).toBeNull()
    expect(nextSkillExchange(null, null, 5)).toBeNull()
  })
  it('keeps the last counts of the same sinner when a read lost them', () => {
    const shown = nextSkillExchange(null, { sinner: 3, current: counts(1) }, 1000)
    expect(nextSkillExchange(shown, { sinner: 3, current: null }, 1200)?.current).toEqual(counts(1))
    expect(nextSkillExchange(shown, { sinner: 4, current: null }, 1200)?.current).toBeNull()
  })
  it('matches the old updater on random reads', () => {
    const next = random(14)
    const legacy = (previous: { sinner: number; current: unknown; seenAt: number } | null, read: { sinner: number; current: unknown } | null, at: number) => {
      if (!read) return previous && at - previous.seenAt > 1500 ? null : previous
      return { sinner: read.sinner, current: read.current ?? (previous?.sinner === read.sinner ? previous.current : null), seenAt: at }
    }
    let mine: ReturnType<typeof nextSkillExchange> = null, old = mine as ReturnType<typeof legacy>
    for (let step = 0, at = 0; step < 400; step++) {
      at += Math.floor(next() * 900)
      const read = next() < 0.35 ? null : { sinner: 1 + Math.floor(next() * 3), current: next() < 0.4 ? null : counts(step) }
      mine = nextSkillExchange(mine, read as never, at)
      old = legacy(old, read, at)
      expect(mine).toEqual(old)
    }
  })
})

describe('nextWorkCounts', () => {
  it('keeps the object when no count changed', () => {
    const current = { analyzing: 1, frames: 2, text: 3, image: 4 }
    expect(nextWorkCounts(current, { analyzing: 1, frames: 2, text: 3, image: 4 })).toBe(current)
    const next = { analyzing: 1, frames: 2, text: 3, image: 5 }
    expect(nextWorkCounts(current, next)).toBe(next)
  })
})

describe('nextBlessings', () => {
  const read: Blessings = { levels: [1, 2, 3, 0, 0, 1, 2, 3, 0, 1], spent: 5, observedAt: 100 }
  it('keeps the current read when its levels are the same, else takes the new ones with their starlight', () => {
    expect(nextBlessings(read, [1, 2, 3, 0, 0, 1, 2, 3, 0, 1], '1230012301', 200)).toBe(read)
    const levels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3]
    expect(nextBlessings(read, levels, levels.join(''), 200)).toEqual({ levels, spent: blessingSpent(levels), observedAt: 200 })
    expect(nextBlessings(null, levels, levels.join(''), 7)).toEqual({ levels, spent: blessingSpent(levels), observedAt: 7 })
  })
})

describe('bonusWithNames and nextClearBonus', () => {
  const cards = (names: string[] | undefined): ClearBonusCard[] => [{ place: 1, gifts: ['a'], ...(names ? { themeIds: names } : {}) }, { place: 2, gifts: ['b', 'c'] }]
  const offer = (floor: number | null, list = cards(undefined)): ClearBonusOffer => ({ floor, cards: list, observedAt: 1 })
  it('names the cards by place, and keeps the offer when the names are already there or no offer is up', () => {
    const current = offer(3)
    const names = new Map([[1, ['t1']]])
    const withNames = bonusWithNames(current, names)
    expect(withNames).toEqual({ ...current, cards: named(current.cards, names) })
    expect(withNames?.cards[0].themeIds).toEqual(['t1'])
    expect(bonusWithNames(withNames, names)).toBe(withNames)
    expect(bonusWithNames(null, names)).toBeNull()
    expect(bonusWithNames(current, new Map())).toBe(current)
  })
  it('takes a new offer unless the same cards are up under the same floor header', () => {
    const current = offer(3)
    const key = offerKey(current.cards)
    expect(nextClearBonus(current, key, cards(undefined), 3, 9)).toBe(current)
    expect(nextClearBonus(current, key, cards(undefined), 4, 9)).toEqual({ floor: 4, cards: cards(undefined), observedAt: 9 })
    expect(nextClearBonus(current, 'other', cards(['x']), 3, 9)).toEqual({ floor: 3, cards: cards(['x']), observedAt: 9 })
    expect(nextClearBonus(null, key, cards(undefined), null, 9)).toEqual({ floor: null, cards: cards(undefined), observedAt: 9 })
    expect(nextClearBonus(offer(null), key, cards(undefined), null, 9)).toEqual(offer(null))
  })
  it('match the old updaters on random offers', () => {
    const next = random(15)
    for (let run = 0; run < 300; run++) {
      const list = (): ClearBonusCard[] => Array.from({ length: 1 + Math.floor(next() * 3) }, (_, index) => ({ place: index + 1, gifts: Array.from({ length: Math.floor(next() * 3) }, () => pick(next, ['a', 'b', 'c'])),
        ...(next() < 0.4 ? { themeIds: [pick(next, ['t1', 't2'])] } : {}) }))
      const current: ClearBonusOffer | null = next() < 0.2 ? null : { floor: pick(next, [null, 1, 2]), cards: list(), observedAt: 1 }
      const names = new Map(Array.from({ length: Math.floor(next() * 3) }, () => [1 + Math.floor(next() * 3), [pick(next, ['t1', 't2'])]] as [number, string[]]))
      expect(bonusWithNames(current, names)).toEqual(current && named(current.cards, names) !== current.cards ? { ...current, cards: named(current.cards, names) } : current)
      const cardsRead = list(), floor = pick(next, [null, 1, 2]), key = next() < 0.5 ? offerKey(cardsRead) : offerKey(current?.cards ?? [])
      expect(nextClearBonus(current, key, cardsRead, floor, 5)).toEqual(current && offerKey(current.cards) === key && current.floor === floor ? current : { floor, cards: cardsRead, observedAt: 5 })
    }
  })
})
