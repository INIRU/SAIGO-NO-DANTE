import { describe, expect, it } from 'vitest'
import { giftTiers, type GiftTierSources } from '@/scripts/sync/mirror-dungeon-rules'

// Shapes taken from the 2026-09-24 extraction: droppool-7 (dungeonIdx 0 exclusions), packs 1014 (노말·하드),
// 1511 (익스트림 only), 3001 (하드·평행중첩), 1124's event 971092 and the hidden-boss list.
const base: GiftTierSources = {
  dropPool: [9001, 9156, 9427, 9227],
  normalExclude: [9156],
  globalExclude: [9227, 9250, 9241],
  themes: [
    { dungeonIdxs: [0, 1], exclusive: [9427], pool: [9001, 9156], eventIds: [] },
    { dungeonIdxs: [3], exclusive: [9250, 9829], pool: [9156], eventIds: [] },
    { dungeonIdxs: [1, 2], exclusive: [9242], pool: [], eventIds: [] },
    { dungeonIdxs: [0, 1, 2], exclusive: [], pool: [], eventIds: [971092] },
  ],
  eventGifts: new Map([[971092, [9241]]]),
  recipes: [{ result: 9158, materials: [9001, 9156] }, { result: 9161, materials: [9001, 9427] }],
  conversions: new Map([[9227, 9228]]),
  hiddenBoss: new Set([9256, 9829]),
}

describe('REQ-MIRROR-DUNGEON-011 gift first-appearance difficulty', () => {
  const tiers = giftTiers([9001, 9156, 9427, 9227, 9228, 9250, 9829, 9242, 9241, 9158, 9161, 9256, 9999], base)

  it('REQ-MIRROR-DUNGEON-011 extreme-pack exclusives and boss rewards are 익스트림, not 하드', () => {
    expect(tiers.get(9250)).toBe('익스트림')
    expect(tiers.get(9829)).toBe('익스트림')
  })

  it('REQ-MIRROR-DUNGEON-011 drop pool: normal-mode exclusions start at 하드, the rest at 노말', () => {
    expect(tiers.get(9001)).toBe('노말')
    expect(tiers.get(9156)).toBe('하드')
  })

  it('REQ-MIRROR-DUNGEON-011 pack exclusives and pack events take the easiest difficulty the pack is offered in', () => {
    expect(tiers.get(9427)).toBe('노말')
    expect(tiers.get(9242)).toBe('하드') // 평행중첩 counts as 하드
    expect(tiers.get(9241)).toBe('노말')
  })

  it('REQ-MIRROR-DUNGEON-011 recipes take their hardest material, conversions their source, and the old rule is the fallback', () => {
    expect(tiers.get(9158)).toBe('하드')
    expect(tiers.get(9161)).toBe('노말')
    expect(tiers.get(9227)).toBe('하드') // global exclusion, no pack or event places it
    expect(tiers.get(9228)).toBe('하드')
    expect(tiers.get(9256)).toBe('익스트림')
    expect(tiers.get(9999)).toBe('노말')
  })
})
