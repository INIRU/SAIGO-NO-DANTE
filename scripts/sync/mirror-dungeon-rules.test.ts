import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existingGiftLookup, fixedRewardGiftIds, richestEntry, sameStoredIds, themeExclusiveGifts, themeFixedRewards, themeGiftRefs, unreadThemeKeys } from './mirror-dungeon-rules'

// Cases from the extraction audit of 2026-09-30 (complete-data of 2026-09-24).
describe('theme rewards and exclusive gifts', () => {
  const giftIds = new Set([9242, 9083, 9082, 9081, 9241, 9400])

  it('reads 뽕.황 fixed rewards from fixedRewardEgoGifts, which the schema used to drop', () => {
    expect(themeFixedRewards({ fixedRewardEgoGifts: [9242, 9083, 9082, 9081] }, new Map(), giftIds)).toEqual([9242, 9083, 9082, 9081])
    // Entries holding an id read the same; counts and chances are not ids.
    expect(fixedRewardGiftIds([{ egoGiftId: 9242, count: 1 }, { egoGiftID: 9083, prob: 1 }, { rewardId: 9082 }])).toEqual([9242, 9083, 9082])
  })

  it('adds guaranteed boss-stage rewards and keeps only gifts that exist', () => {
    const stages = new Map([[1, 9400], [2, 993005]])
    expect(themeFixedRewards({ fixedRewardEgoGifts: [9242, 9999], mapGenOption: { bossPool: [1, 2, 3] } }, stages, giftIds)).toEqual([9242, 9400])
    expect(themeFixedRewards({}, stages, giftIds)).toEqual([])
  })

  it('links the exclusive gifts no pack pool names: 뽕.황, 선의의 순례 and 호박색 어스름의 시련', () => {
    expect(themeExclusiveGifts(3001, undefined)).toEqual([9242])
    expect(themeExclusiveGifts(1122, [])).toEqual([9831, 9832, 9833, 9834, 9835, 9836, 9837, 9838, 9839])
    // 1122's pools are empty in current data, so its unique gifts are pulled out of ego-gift-story-pilgrimage through it.
    expect(themeGiftRefs({ id: 1122, egoGiftPool: [], specificEgoGiftPool: [] })).toEqual([9831, 9832, 9833, 9834, 9835, 9836, 9837, 9838, 9839])
    expect(themeExclusiveGifts(1124, [9233, 9234, 9236, 9237, 9238, 9240])).toEqual([9233, 9234, 9236, 9237, 9238, 9240, 9241])
    expect(themeExclusiveGifts(1001, [9101])).toEqual([9101])
  })
})

it('writes a NULL id column even when the source list is empty (106 packs kept NULL fixed rewards)', () => {
  expect(sameStoredIds(null, [])).toBe(false)
  expect(sameStoredIds(undefined, [])).toBe(false)
  expect(sameStoredIds([], [])).toBe(true)
  expect(sameStoredIds([9083, 9242], [9242, 9083])).toBe(true)
  expect(sameStoredIds([9242], [9242, 9083])).toBe(false)
})

it('recovers a story gift from its complete entry, not a bare stub in an earlier file (원목 술잔 9781)', () => {
  const stub = { id: 9781 }
  const full = { id: 9781, keyword: 'None', tag: ['TIER_3'], price: 250, upgradeDataList: [{ upgradeLevel: 0, localizeID: 9781 }] }
  expect(richestEntry([stub, full])).toBe(full)
  expect(richestEntry([full, stub])).toBe(full)
  // Equal content keeps file order; empty lists do not count as content.
  const first = { id: 1, price: 10 }, second = { id: 1, tag: [] as string[], keyword: 'None' }
  expect(richestEntry([first, { id: 1, price: 20 }])).toBe(first)
  expect(richestEntry([first, second])).toBe(first)
  expect(richestEntry([])).toBeUndefined()
})

it('collects every gift a theme points at, so story-file gifts are recovered by any of them', () => {
  expect(themeGiftRefs({ egoGiftPool: [9001, 9003], specificEgoGiftPool: [9233], fixedRewardEgoGifts: [9242, 9001] })).toEqual([9001, 9003, 9233, 9242])
  expect(themeGiftRefs(null)).toEqual([])
})

it('reports theme source fields the sync does not read instead of dropping them unseen', () => {
  const item = {
    id: 3001, egoGiftPool: [], fixedRewardEgoGifts: [9242], uiConfigs: { packSpriteId: 'a', bossSpriteId: 'b', showBossIds: [1] },
    specificEgoGiftForUpegsProbs: [], excludeSpecificEgoGiftFromUpEgs: [], isUnrecordable: true, type: 'EXTREME',
  }
  expect(unreadThemeKeys(item).sort()).toEqual(['excludeSpecificEgoGiftFromUpEgs', 'isUnrecordable', 'specificEgoGiftForUpegsProbs', 'type', 'uiConfigs.showBossIds'])
  expect(unreadThemeKeys({ id: 1, desc: 'x', mapGenOption: { bossPool: [] } })).toEqual([])
  expect(unreadThemeKeys([1])).toEqual([])
})

it('uses these rules in the sync itself', () => {
  const sync = readFileSync(join(__dirname, 'mirror-dungeon-data.ts'), 'utf8')
  expect(sync).toContain('fixedRewardEgoGifts: z.unknown().optional()')
  expect(sync).toContain('fixed_reward_gift_ids: themeFixedRewards(t, stageRewards, giftIds)')
  expect(sync).toContain('specific_ego_gift_ids: themeExclusiveGifts(t.id, t.specificEgoGiftPool)')
  expect(sync).toContain('!sameStoredIds(existing.fixed_reward_gift_ids, theme.fixed_reward_gift_ids)')
  expect(sync).toContain('giftMap.set(id, richestEntry(entries)!)')
  expect(sync).not.toContain('sortedNumberArrayJson')
})

it('never matches a source gift to another gift of the same name (story 20xx and Mirror Dungeon 97xx share 29 names)', () => {
  const rows = [{ id: 'a', game_id: 9701, name: '같은 이름' }, { id: 'b', game_id: null, name: '옛 행' }]
  const lookup = existingGiftLookup(rows)
  expect(lookup.find(9701, '같은 이름')?.id).toBe('a')
  // A new story gift with the same name is a new row, not an update of 9701.
  expect(lookup.find(2001, '같은 이름')).toBeUndefined()
  // A legacy row without a game_id is still found by name once.
  expect(lookup.find(2002, '옛 행')?.id).toBe('b')
  expect(lookup.missingFrom([{ game_id: 2001, name: '같은 이름' }])).toBe(2)
  expect(lookup.missingFrom([{ game_id: 9701, name: 'x' }, { game_id: 5, name: '옛 행' }])).toBe(0)
  const sync = readFileSync(join(__dirname, 'mirror-dungeon-data.ts'), 'utf8')
  expect(sync).toContain('const existing = existingLookup.find(gift.game_id, gift.name)')
  expect(sync).not.toContain('existingByName')
})

it('stores gift slots through placeholder-rules instead of a fixed 0 or a copied name (봉이 인형 9242, 귀기 서린 환도 9227)', () => {
  // The texts themselves are covered in placeholder-rules.test.ts; here only that every effect column goes through it.
  const sync = readFileSync(join(__dirname, 'mirror-dungeon-data.ts'), 'utf8')
  expect(sync).toContain('giftPlaceholders(text, placeholderSource, placeholderReport)')
  expect(sync.match(/tokens\(cleanDesc\(/g)?.length).toBe(9)
  expect(sync).not.toContain('→ [${convertName}]')
  expect(sync).not.toContain(".replace(/\\{(\\d+)\\}/g, '0')")
})
