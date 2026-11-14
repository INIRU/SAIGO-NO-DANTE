import { describe, expect, it } from 'vitest'
import { isHiddenChapter, storyOrder } from '@/features/story/lib/story-order'

describe('story progress', () => {
  const index = [
    { id: 101, part: 1, number: '1', timeline: '984-01' },
    { id: 9103, part: 91, number: '3.5', timeline: '984-03' },
    { id: 100, part: 1, number: '0', timeline: '984-01' },
    { id: 103, part: 1, number: '3', timeline: '984-02' },
  ]
  const order = storyOrder(index).map(e => e.id)

  it('orders by chapter number, the .5 story after its chapter', () => {
    expect(order).toEqual([100, 101, 103, 9103])
  })

  it('hides only the chapters after the one read up to', () => {
    expect(order.map(id => isHiddenChapter(order, 101, id))).toEqual([false, false, true, true])
  })

  it('shows only the first chapter before anything is opened, or for an unknown chapter', () => {
    expect(order.map(id => isHiddenChapter(order, null, id))).toEqual([false, true, true, true])
    expect(order.map(id => isHiddenChapter(order, 999, id))).toEqual([false, true, true, true])
  })
})

describe('chapter parts', () => {
  // As the game's data has them: 9112 is subchapterFeatureList HARD of 9105 (mapIllustId); 9128 isSyncChapter of 110.
  const index = [
    { id: 110, hard: false, normal: null, sync: null },
    { id: 9128, hard: false, normal: null, sync: 110 },
    { id: 9105, hard: false, normal: null, sync: null },
    { id: 9112, hard: true, normal: 9105, sync: null },
  ]
  it('pairs a HARD version with its normal chapter, and leaves a sync chapter out without making it a part', async () => {
    const { chapterParts, isExtraPart } = await import('@/features/story/lib/story-order')
    expect(chapterParts(index, 9112).map(e => e.id)).toEqual([9105, 9112])
    expect(chapterParts(index, 110).map(e => e.id)).toEqual([110])
    expect(index.filter(e => isExtraPart(index, e)).map(e => e.id)).toEqual([9128, 9112])
  })
})
