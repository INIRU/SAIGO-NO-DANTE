import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existingGiftLookup, fixedRewardGiftIds, markLiveValues, richestEntry, sameStoredIds, themeExclusiveGifts, themeFixedRewards, themeGiftRefs, unreadThemeKeys } from './mirror-dungeon-rules'

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
    expect(themeExclusiveGifts(1122, [])).toEqual([9831, 9832, 9833, 9834, 9835])
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

it('marks the live values the game fills in during a run instead of a fixed 0 (봉이 인형 9242)', () => {
  // The source texts carry {0} and {1}; the sync used to write "현재 0%".
  expect(markLiveValues('- 보유한 기프트 개수 1개당, 피해량 0.5% 증가 (현재 {0}%. 최대 100%)\n- 보유한 기프트 개수 20개당, 턴 시작 시 위력 증가 1 얻음 (현재 {1} 얻음. 최대 10)', 'kr'))
    .toBe('- 보유한 기프트 개수 1개당, 피해량 0.5% 증가 (게임 중 표시. 최대 100%)\n- 보유한 기프트 개수 20개당, 턴 시작 시 위력 증가 1 얻음 (게임 중 표시. 최대 10)')
  expect(markLiveValues('Deal +0.5% damage for every E.G.O Gift owned (Current: +{0}%; max 100%)\n- Turn Start: Gain 1 Potency Up (Current Stack: {1}; max 10)', 'en'))
    .toBe('Deal +0.5% damage for every E.G.O Gift owned (shown in game; max 100%)\n- Turn Start: Gain 1 Potency Up (shown in game; max 10)')
  expect(markLiveValues('ダメージ量が0.5%増加 (現在{0}%, 最大100%)\n威力増加1を得る (現在{1}獲得、最大10)', 'jp'))
    .toBe('ダメージ量が0.5%増加 (ゲーム中に表示, 最大100%)\n威力増加1を得る (ゲーム中に表示、最大10)')
  // A decimal point is not a clause break, and a value outside parentheses is marked where it stands.
  expect(markLiveValues('(피해량 0.5 x {0}%)', 'kr')).toBe('(게임 중 표시)')
  expect(markLiveValues('피해량 +{0}% 증가', 'kr')).toBe('피해량 +(게임 중 표시)% 증가')
  expect(markLiveValues('변화 없음 (최대 100%)', 'kr')).toBe('변화 없음 (최대 100%)')
  const sync = readFileSync(join(__dirname, 'mirror-dungeon-data.ts'), 'utf8')
  expect(sync).toContain('last[field] = markLiveValues(text, lang)')
  expect(sync).not.toContain(".replace(/\\{(\\d+)\\}/g, '0')")
})
