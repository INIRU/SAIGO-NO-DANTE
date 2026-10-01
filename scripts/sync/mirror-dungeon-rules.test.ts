import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { giftPlaceholders } from './placeholder-rules'
import { extractActivationCondition, existingGiftLookup, fixedRewardGiftIds, rawGiftEffect, translateGiftDescForCondition, richestEntry, sameStoredIds, themeExclusiveGifts, themeFixedRewards, themeGiftRefs, unreadThemeKeys, themeNameColor, themeNameSegments, themeBossUnitIds, recipeCommonFiles } from './mirror-dungeon-rules'

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
  // isUnrecordable and uiConfigs.showBossIds are read since the pack UI config columns (2026-10-01).
  expect(unreadThemeKeys(item).sort()).toEqual(['excludeSpecificEgoGiftFromUpEgs', 'specificEgoGiftForUpegsProbs', 'type'])
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
  expect(sync.match(/tokens\(rawGiftEffect\(/g)?.length).toBe(9)
  expect(sync).not.toContain('tokens(cleanDesc(')
  expect(sync).not.toContain('→ [${convertName}]')
  expect(sync).not.toContain(".replace(/\\{(\\d+)\\}/g, '0')")
})

describe('theme pack UI config', () => {
  it('reads the title colour, multi-colour names and boss units the pack art uses', () => {
    expect(themeNameColor('af241c')).toBe('#AF241C')
    expect(themeNameColor(undefined)).toBeNull()
    expect(themeNameColor('nope')).toBeNull()
    // 1119 증오와 절망 (KR/EN/JP_MirrorDungeonTheme-1 specialName).
    expect(themeNameSegments(1119, {
      ko: '<color=#ee4893>증오와</color> <color=#0060c5>절망</color>',
      en: '<color=#ee4893>Hatred</color> and <color=#0060c5>Despair</color>',
    })).toEqual({
      ko: [{ text: '증오와', color: '#ee4893' }, { text: ' ' }, { text: '절망', color: '#0060c5' }],
      en: [{ text: 'Hatred', color: '#ee4893' }, { text: ' and ' }, { text: 'Despair', color: '#0060c5' }],
      ja: [{ text: '증오와', color: '#ee4893' }, { text: ' ' }, { text: '절망', color: '#0060c5' }],
    })
    expect(themeNameSegments(1001, { ko: '잊혀진 자들' })).toBeNull()
    expect(themeNameSegments(1126, {})?.ko[2]).toEqual({ text: '엮기', color: '#c65348' })
    expect(themeBossUnitIds([8141, 8096, 'x'])).toEqual([8141, 8096])
    expect(unreadThemeKeys({ id: 1, isUnrecordable: true, uiConfigs: { textColor: 'ffffff', showBossIds: [1], attackType: 'HIT' } })).toEqual([])
  })
})

// REQ-DATA-SYNC-036: gift effects are stored as the game's own text; only the activation condition reads a translated copy.
// The strings are real KR_EGOgift* descs of the 2026-09-24 extraction.
describe('REQ-DATA-SYNC-036 gift effects stored raw', () => {
  const ORDER_MADE = '[편성 3번 인격 전용 효과]\n\n스테이지 시작 시, [Vibration] 횟수 3을 획득.\n\n턴 시작 시, [Protection] 1, [AttackDmgUp] 1, [ResultEnhancement] 1 얻음.'
  const SWORD = '전투를 6회 승리할 시 해당 E.G.O 기프트가 변경됨\n{0}\n\n모든 아군이 받는 피해 20% 증가, 합위력 -1'
  const BONGY = '층 클리어 시 보유한 코스트가 1.5배씩 늘어남\n\n- 보유한 기프트 개수 1개당, 피해량 0.5% 증가 (현재 {0}%. 최대 100%)\n- 보유한 기프트 개수 20개당, 턴 시작 시 [Enhancement] 1 얻음 (현재 {1} 얻음. 최대 10)'
  const SNAKE_PLUS = '턴 시작시, 모든 아군이 [DefenseUp] <style="upgradeHighlight">4</style> 얻음.\n각 아군이 (자신의 [DefenseUp]/<style="upgradeHighlight">3</style>)만큼 공격 레벨이 증가함. (최대 10)'
  const EN_CAP = 'After using a Skill that gains [Charge] Count or <noparse>Unique Charge</noparse>, gain [EmergencyChargeForceField] equal to the Count gained (max 7 per Identity)'
  const BLOOD_FOG = '턴 시작 시, [Laceration] 위력, [Laceration] 횟수 또는 특수 출혈을 부여하는 공격 스킬을 보유한 인격이 5인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)\n\n아군이 스킬 효과로 적에게 부여하는 [Laceration] 위력과 [Laceration] 횟수'
  const SWORDSMEN = '턴 시작 시, 검계 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함).\n\n아군이 가하는 참격 피해량 +50%'
  const names = new Map([['Vibration', '진동'], ['Laceration', '출혈'], ['Enhancement', '위력 증가'], ['DefenseUp', '방어 레벨 증가']])

  it('REQ-DATA-SYNC-036 keeps [Id] references and the 편성 라벨 line as the game wrote them (오더메이드 9407)', () => {
    expect(rawGiftEffect(ORDER_MADE)).toBe(ORDER_MADE)
    expect(rawGiftEffect(ORDER_MADE)).toContain('[Vibration] 횟수 3')
    expect(rawGiftEffect(ORDER_MADE)).toContain('[편성 3번 인격 전용 효과]')
  })

  it('REQ-DATA-SYNC-036 keeps style, noparse and size tags instead of stripping them', () => {
    expect(rawGiftEffect(SNAKE_PLUS)).toBe(SNAKE_PLUS)
    expect(rawGiftEffect(EN_CAP)).toContain('<noparse>Unique Charge</noparse>')
    expect(rawGiftEffect('<size=80%>작게</size> <color=#ff0000>빨강</color>')).toBe('<size=80%>작게</size> <color=#ff0000>빨강</color>')
  })

  it('REQ-DATA-SYNC-036 only trims surrounding whitespace, and an empty source stays NULL', () => {
    expect(rawGiftEffect(' 홀수 턴이면, [AttackDmgUp] 1 얻음. \n')).toBe('홀수 턴이면, [AttackDmgUp] 1 얻음.')
    expect(rawGiftEffect(undefined)).toBeNull()
    expect(rawGiftEffect('')).toBeNull()
  })

  it('REQ-DATA-SYNC-036 still turns slots into tokens after the raw text: convert gift 9227 and descType gift 9242', () => {
    const report = { add() {}, size: 0 } as never
    expect(giftPlaceholders(rawGiftEffect(SWORD), { id: 9227, convertTo: 9228, descType: 'ReportUseNumber' }, report)).toBe(SWORD.replace('{0}', '{{gift:9228}}'))
    expect(giftPlaceholders(rawGiftEffect(BONGY), { id: 9242, descType: 'ReportBongy' }, report)).toBe(BONGY.replace('{0}', '{{live}}').replace('{1}', '{{live}}'))
    // The [Enhancement] reference of 9242 survives next to the tokens.
    expect(giftPlaceholders(rawGiftEffect(BONGY), { id: 9242, descType: 'ReportBongy' }, report)).toContain('[Enhancement] 1 얻음')
  })

  it('REQ-DATA-SYNC-036 computes the activation condition from the translated copy, as before', () => {
    // A bleed gift: the condition names the keyword only after [Laceration] became 출혈.
    const translated = translateGiftDescForCondition(BLOOD_FOG, names)
    expect(translated).toContain('출혈 위력, 출혈 횟수 또는 특수 출혈을 부여하는 공격 스킬을 보유한 인격이 5인 이상')
    expect(extractActivationCondition(translated, '출혈')).toEqual({ type: 'keyword', keyword: '출혈', count: 5 })
    // 복주머니 9098 names its keyword only as [Breath]: the raw text is not matched, which is why the translated copy exists.
    const POUCH = '턴 시작 시, [Breath] 위력 또는 [Breath] 횟수를 부여하거나 획득하는 공격 스킬을 보유한 인격이 5인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)'
    expect(extractActivationCondition(rawGiftEffect(POUCH), '호흡')).toBeUndefined()
    expect(extractActivationCondition(translateGiftDescForCondition(POUCH, new Map([['Breath', '호흡']])), '호흡')).toEqual({ type: 'keyword', keyword: '호흡', count: 5 })
    // Affiliation conditions read the same either way.
    expect(extractActivationCondition(translateGiftDescForCondition(SWORDSMEN, names), '참격')).toEqual({ type: 'affiliation', affiliation: '검계', count: 3 })
    expect(extractActivationCondition(rawGiftEffect(SWORDSMEN), '참격')).toEqual({ type: 'affiliation', affiliation: '검계', count: 3 })
  })

  it('REQ-DATA-SYNC-036 translates tags and unknown ids the way the old cleanDesc did, for the internal copy only', () => {
    expect(translateGiftDescForCondition('<style="upgradeHighlight">[Enhancement] 1</style> <color=#fff>얻음</color><noparse>x</noparse> [Unknown]', names))
      .toBe('위력 증가 1 얻음x [Unknown]')
  })

  it('REQ-DATA-SYNC-036 stores the raw effect and feeds only the condition from the translated copy in the sync', () => {
    const sync = readFileSync(join(__dirname, 'mirror-dungeon-data.ts'), 'utf8')
    expect(sync).toContain('const effectBase = tokens(rawGiftEffect(baseLoc.desc))')
    expect(sync).toContain('extractActivationCondition(tokens(translateGiftDescForCondition(baseLoc.desc, getKrKeywordMap())), keyword)')
    expect(sync).not.toMatch(/effect_\w+(?:_en|_jp)?: .*cleanDesc/)
  })
})

describe('REQ-DATA-SYNC-045 recipe common data of the newest season', () => {
  it('REQ-DATA-SYNC-045 orders common data files by season number, a next-update file after its season, base last', () => {
    expect(recipeCommonFiles([
      'mirror-dungeon-common-data.txt', 'mirror-dungeon-common-data-md6.txt', 'mirror-dungeon-common-data-md7-nextupdate.txt',
      'mirror-dungeon-common-data-md10.txt', 'mirror-dungeon-common-data-md7.txt', 'mirror-dungeon-common-data-md8.txt', 'unrelated.txt',
    ])).toEqual([
      'mirror-dungeon-common-data-md10.txt', 'mirror-dungeon-common-data-md8.txt', 'mirror-dungeon-common-data-md7.txt',
      'mirror-dungeon-common-data-md7-nextupdate.txt', 'mirror-dungeon-common-data-md6.txt', 'mirror-dungeon-common-data.txt',
    ])
  })
})
