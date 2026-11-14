import { describe, expect, it } from 'vitest'
import { locateInSeries, moveSeriesItem, orderSeriesItems, seriesPostHref } from '@/features/community/lib/series-order'
import { seriesChoiceSchema, seriesCreateSchema, seriesPatchSchema } from '@/features/community/server/series-schema'

const items = [
  { kind: 'plan' as const, id: 'c', title: 'C', position: 2 },
  { kind: 'deck' as const, id: 'a', title: 'A', position: 0 },
  { kind: 'deck' as const, id: 'b', title: 'B', position: 1 },
]

describe('series order', () => {
  it('sorts by position', () => {
    expect(orderSeriesItems(items).map(item => item.id)).toEqual(['a', 'b', 'c'])
  })
  it('gives position, total, previous and next', () => {
    const at = locateInSeries(items, 'deck', 'b')!
    expect([at.index, at.total, at.prev?.id, at.next?.id]).toEqual([2, 3, 'a', 'c'])
    const first = locateInSeries(items, 'deck', 'a')!
    expect([first.prev, first.next?.id]).toEqual([null, 'b'])
    expect(locateInSeries(items, 'plan', 'c')!.next).toBeNull()
  })
  it('tells a deck and a plan with the same id apart, and misses unknown posts', () => {
    expect(locateInSeries(items, 'plan', 'a')).toBeNull()
  })
  it('moves an item one step and stops at the ends', () => {
    expect(moveSeriesItem(orderSeriesItems(items), 1, -1).map(item => item.id)).toEqual(['b', 'a', 'c'])
    expect(moveSeriesItem(orderSeriesItems(items), 0, -1).map(item => item.id)).toEqual(['a', 'b', 'c'])
    expect(moveSeriesItem(orderSeriesItems(items), 2, 1).map(item => item.id)).toEqual(['a', 'b', 'c'])
  })
  it('links decks and plans to their pages', () => {
    expect(seriesPostHref('deck', 'x')).toBe('/decks/x')
    expect(seriesPostHref('plan', 'x')).toBe('/planner/community/x')
  })
})

describe('series request shapes', () => {
  it('requires a trimmed title of 1 to 60 characters', () => {
    expect(seriesCreateSchema.safeParse({ title: '  ' }).success).toBe(false)
    expect(seriesCreateSchema.safeParse({ title: 'x'.repeat(61) }).success).toBe(false)
    expect(seriesCreateSchema.parse({ title: ' 화상 ' }).title).toBe('화상')
  })
  it('accepts an order of unique posts only', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(seriesPatchSchema.safeParse({ order: [{ kind: 'deck', id }] }).success).toBe(true)
    expect(seriesPatchSchema.safeParse({ order: [{ kind: 'deck', id }, { kind: 'deck', id }] }).success).toBe(false)
    expect(seriesPatchSchema.safeParse({ order: [{ kind: 'x', id }] }).success).toBe(false)
    expect(seriesPatchSchema.safeParse({}).success).toBe(false)
  })
  it('a post choice is a series id or null', () => {
    expect(seriesChoiceSchema.safeParse(null).success).toBe(true)
    expect(seriesChoiceSchema.safeParse('nope').success).toBe(false)
  })
})
