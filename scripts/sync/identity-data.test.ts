import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildSkillRows,
  bracketKeywordsForSyncTest,
  areSkillRowsDifferent,
  withStableSkillIds,
  cleanLocaleContent,
  findStaleRichTextKeywordMetaNames,
  hasLocalizedSkillContent,
  normalizeKrPersonalityDisplayName,
  resolveKeywordEffectTypeForSyncTest,
  resolveKeywordMetaSourceForSyncTest,
  composeRawSkillDescription,
  rawGameText,
  joinPassiveGameTexts,
  deriveIdentityAcquisition,
} from './identity-data'
import { buffPlaceholders } from './placeholder-rules'

describe('identity-data sync helpers', () => {
  it('stores keyword descriptions through placeholder-rules in every language', () => {
    // The slot rules and real source strings are tested in placeholder-rules.test.ts.
    const sync = readFileSync(join(__dirname, 'identity-data.ts'), 'utf8')
    for (const source of ['KR_Bufs', 'EN_Bufs', 'JP_Bufs']) expect(sync).toContain(`placeholderReport, '${source}')`)
    expect(sync).not.toContain('fillValuePlaceholders')
  })
  it('does not count KR_SkillTag names such as sin colours as identity keywords', () => {
    // [CRIMSON] → 빨간색 translates skill text; it became a keyword once SkillTag joined the tag map.
    expect(bracketKeywordsForSyncTest(['[CRIMSON] 공명 시 [Combustion] 부여'], { CRIMSON: '빨간색', Combustion: '화상' }, ['CRIMSON'])).toEqual(['화상'])
  })
  it('keeps the historical launch season of a permanent identity without seasonal restrictions', () => {
    const identity = { id: 'test', game_id: '10305', sinner_id: 'don-quixote', name_kr: 'test', rarity: 3,
      acquisition: '추출(상시)', acquisition_info: { type: 'standard' as const, release_season: 2, fragment_cost: 400, gacha: 'always' as const } }
    const result = deriveIdentityAcquisition(identity, { id: 10305, characterId: 3, rank: 3, season: 0 }, new Map(), new Map(), true)
    expect(result.acquisition_info).toEqual(identity.acquisition_info)
    expect(result.acquisition).toContain('상시')
  })
  it('preserves original event and attendance routes when their shop is absent from the current source', () => {
    for (const type of ['event', 'attendance'] as const) {
      const identity = { id: 'test', game_id: '10409', sinner_id: 'ryoshu', name_kr: 'test', rarity: 2,
        acquisition: '시간살인시간 회중시계 500개 교환', acquisition_info: { type, release_season: 4, fragment_cost: 150, gacha: 'none' as const, event_cost: 500, event_currency: '회중시계', exchange_from_season: 6 } }
      const result = deriveIdentityAcquisition(identity, { id: 10409, characterId: 4, rank: 2, season: 4, additionalAttachment: 'EVENT' }, new Map(), new Map(), true)
      expect(result.acquisition_info).toEqual(identity.acquisition_info)
      expect(result.acquisition).toBe(identity.acquisition)
    }
  })
  it('uses source season zero for standard identities and decodes the Walpurgis edition', () => {
    const identity = { id: 'test', game_id: '11216', sinner_id: 'gregor', name_kr: 'test', rarity: 3,
      acquisition: '', acquisition_info: { type: 'standard' as const, release_season: 1, fragment_cost: 400, gacha: 'seasonal' as const } }
    const source = { id: 11216, characterId: 12, rank: 3, season: 0 }
    expect(deriveIdentityAcquisition(identity, source, new Map(), new Map(), true).acquisition_info)
      .toMatchObject({ type: 'standard', release_season: 0, gacha: 'always', fragment_cost: 400 })
    expect(deriveIdentityAcquisition(identity, { ...source, season: 9109, walpurgisType: 'LOR' }, new Map(), new Map(), true).acquisition_info)
      .toMatchObject({ type: 'walpurgis', release_season: 0, gacha: 'walpurgis', walpurgis_edition: 9 })
  })
  it('REQ-DATA-SYNC-018 keeps the launch banner an identity already has when the source drops that pickup or lists it in a later banner', () => {
    const identity = { id: 'test', game_id: '10816', sinner_id: 'ryoshu', name_kr: 'test', rarity: 3,
      acquisition: '신규 인격 특정 추출', acquisition_info: { type: 'standard' as const, release_season: 7, fragment_cost: 400, gacha: 'seasonal' as const, gacha_from_season: 7,
        gacha_id: 280, gacha_name: '신규 인격 특정 추출', gacha_name_en: 'New Identity Target Extraction', gacha_name_jp: '新規人格特定抽出' } }
    const result = deriveIdentityAcquisition(identity, { id: 10816, characterId: 8, rank: 3, season: 7 }, new Map(), new Map(), true)
    expect(result.acquisition_info).toMatchObject({ gacha_id: 280, gacha_name: '신규 인격 특정 추출', gacha_name_en: 'New Identity Target Extraction', gacha_name_jp: '新規人格特定抽出' })
    const rerun = { file: 'gacha-293.txt', gachaId: 293, bannerType: 'TEMPORARY_MAIN', walpurgisType: null, category: null, festival: false, startDate: null, endDate: null,
      gachaName: '특정 추출 료슈', gachaNameEn: 'Target Extraction: Ryōshū', gachaNameJp: '特定抽出良秀' }
    const later = deriveIdentityAcquisition(identity, { id: 10816, characterId: 8, rank: 3, season: 7 }, new Map(), new Map([['10816', [rerun]]]), true)
    expect(later.acquisition_info).toMatchObject({ gacha_id: 280, gacha_name: '신규 인격 특정 추출' })
    const fresh = deriveIdentityAcquisition({ ...identity, acquisition_info: null }, { id: 10816, characterId: 8, rank: 3, season: 7 }, new Map(), new Map([['10816', [rerun]]]), true)
    expect(fresh.acquisition_info).toMatchObject({ gacha_id: 293, gacha_name: '특정 추출 료슈' })
  })
  it('Unity rich text tags are still stripped from names (titles), which are not rendered as rich text', () => {
    const source = '자신에게 <style="highlight"><b><i><u><s>중지</s></u></i></b></style> - 원한 문신 [<s>큰 누님</s>] <color=#ff00ff><link="x"><size=80%><mark=#fff>강화</mark></size></link></color><sprite name="x" />'

    expect(cleanLocaleContent(source)).toBe('자신에게 중지 - 원한 문신 [큰 누님] 강화')
  })

  it('finds stale keyword_meta names that still contain raw rich text tags', () => {
    expect(findStaleRichTextKeywordMetaNames([
      '중지 - 원한 문신 [<s>큰 누님</s>]',
      '중지 - 원한 문신 [큰 누님]',
      '<sprite name="x" />충전',
      '<unknown>보존</unknown>',
      '   <b>진동</b>   ',
    ])).toEqual([
      '중지 - 원한 문신 [<s>큰 누님</s>]',
      '<sprite name="x" />충전',
      '   <b>진동</b>   ',
    ])
  })

  it('resolves duplicate keyword_meta candidates by source identity tag before same-name enemy tags', () => {
    const cases = [
      {
        name: '지령[쪽지] III',
        krCandidates: [
          { id: 'IndexPrescriptEnemy_2', description: 'enemy row' },
          { id: 'IndexPrescriptFaust_2', description: 'faust row' },
          { id: 'IndexPrescriptYi_2', description: 'identity row' },
        ],
        krNameToTags: ['IndexPrescriptEnemy_2', 'IndexPrescriptFaust_2', 'IndexPrescriptYi_2'],
        sourceTag: 'IndexPrescriptYi_2',
        gameId: '10115',
      },
      {
        name: '생체 재료',
        krCandidates: [
          { id: 'CorpusIngredient', description: 'base row' },
          { id: 'ChargeBodyArt', description: 'identity row' },
        ],
        krNameToTags: ['CorpusIngredient', 'ChargeBodyArt'],
        sourceTag: 'ChargeBodyArt',
        gameId: '10116',
      },
      {
        name: '조망',
        krCandidates: [
          { id: 'ObservationTheRings', description: 'enemy row' },
          { id: 'GoldenOpportunity', description: 'identity row' },
        ],
        krNameToTags: ['ObservationTheRings', 'GoldenOpportunity'],
        sourceTag: 'GoldenOpportunity',
        gameId: '10614',
      },
      {
        name: '대행 [헤르메스]',
        krCandidates: [
          { id: 'ProcurationHermes', description: 'base row' },
          { id: 'StackYisangSpecialSkill', description: 'identity row' },
        ],
        krNameToTags: ['ProcurationHermes', 'StackYisangSpecialSkill'],
        sourceTag: 'StackYisangSpecialSkill',
        gameId: '10115',
      },
      {
        name: '원호 방어',
        krCandidates: [
          { id: 'AssistDefense', description: 'base row' },
          { id: 'SupportProtect', description: 'identity row' },
        ],
        krNameToTags: ['AssistDefense', 'SupportProtect'],
        sourceTag: 'SupportProtect',
        gameId: '11115',
      },
    ]

    for (const item of cases) {
      const resolved = resolveKeywordMetaSourceForSyncTest({
        name: item.name,
        krCandidates: item.krCandidates,
        krNameToTags: item.krNameToTags,
        sourceHit: {
          gameIds: new Set([item.gameId]),
          tags: new Set([item.sourceTag]),
        },
      })

      expect(resolved.tag).toBe(item.sourceTag)
      expect(resolved.krData?.description).toBe('identity row')
    }
  })

  it('keeps existing keyword icons unless a duplicate source-backed tag is safer', () => {
    expect(resolveKeywordMetaSourceForSyncTest({
      name: '지령[쪽지] III',
      existingIconSlug: 'index-prescript-enemy-2',
      krCandidates: [{ id: 'IndexPrescriptYi_2', description: 'identity row' }],
      krNameToTags: ['IndexPrescriptEnemy_2', 'IndexPrescriptYi_2'],
      sourceHit: {
        gameIds: new Set(['10115']),
        tags: new Set(['IndexPrescriptYi_2']),
      },
    }).iconSlug).toBe('index-prescript-yi-2')

    expect(resolveKeywordMetaSourceForSyncTest({
      name: '지령[쪽지] III',
      existingIconSlug: 'curated-directive-note-3',
      krCandidates: [{ id: 'IndexPrescriptYi_2', description: 'identity row' }],
      krNameToTags: ['IndexPrescriptEnemy_2', 'IndexPrescriptYi_2'],
      sourceHit: {
        gameIds: new Set(['10115']),
        tags: new Set(['IndexPrescriptYi_2']),
      },
    }).iconSlug).toBe('curated-directive-note-3')
  })

  it('uses curated storage slugs for selected source-backed identity keyword icon variants', () => {
    const cases = [
      {
        name: '생체 재료',
        existingIconSlug: 'corpus-ingredient',
        tag: 'ChargeBodyArt',
        expected: 'corpus-ingredient-2',
      },
      {
        name: '대행 [헤르메스]',
        existingIconSlug: 'proxy-hermes',
        tag: 'StackYisangSpecialSkill',
        expected: 'procuration-hermes-2',
      },
      {
        name: '원호 방어',
        existingIconSlug: 'assist-defense',
        tag: 'SupportProtect',
        expected: 'assist-defense-2',
      },
      {
        name: '조망',
        existingIconSlug: 'viewing-the-tableau',
        tag: 'GoldenOpportunity',
        expected: 'viewing-the-tableau-2',
      },
      {
        name: '아이언 메이든',
        existingIconSlug: 'iron-maiden',
        tag: 'IronMaidenPersonality',
        expected: 'iron-maiden-2',
      },
      {
        name: '지령 탐닉',
        existingIconSlug: 'directive-indulgence',
        tag: 'BlackNightmareYisang',
        expected: 'indulgence-in-prescripts-2',
      },
    ]

    for (const item of cases) {
      expect(resolveKeywordMetaSourceForSyncTest({
        name: item.name,
        existingIconSlug: item.existingIconSlug,
        krCandidates: [
          { id: `${item.tag}Base`, description: 'base row' },
          { id: item.tag, description: 'identity row' },
        ],
        krNameToTags: [`${item.tag}Base`, item.tag],
        sourceHit: {
          gameIds: new Set(['source-id']),
          tags: new Set([item.tag]),
        },
      }).iconSlug).toBe(item.expected)
    }
  })

  it('resolves keyword effect type from exact source tag before conflicting fallback tags', () => {
    expect(resolveKeywordEffectTypeForSyncTest({
      tag: 'ExactPositive',
      sourceHit: {
        gameIds: new Set(['source-id']),
        tags: new Set(['FallbackNegative', 'ExactPositive']),
      },
      effectTypesByTag: new Map([
        ['ExactPositive', 'positive'],
        ['FallbackNegative', 'negative'],
      ]),
    })).toBe('positive')
  })

  it('falls back to sourceHit tags with negative priority when exact source tag is missing', () => {
    expect(resolveKeywordEffectTypeForSyncTest({
      tag: 'MissingExactTag',
      sourceHit: {
        gameIds: new Set(['source-id']),
        tags: new Set(['FallbackNeutral', 'FallbackPositive', 'FallbackNegative']),
      },
      effectTypesByTag: new Map([
        ['FallbackNeutral', 'neutral'],
        ['FallbackPositive', 'positive'],
        ['FallbackNegative', 'negative'],
      ]),
    })).toBe('negative')
  })

  it('returns null keyword effect type when no source tag is available', () => {
    expect(resolveKeywordEffectTypeForSyncTest({
      tag: null,
      effectTypesByTag: new Map([
        ['UnusedPositive', 'positive'],
      ]),
    })).toBeNull()
  })

  it('uses title as KR display name when nameWithTitle only repeats the sinner name', () => {
    expect(normalizeKrPersonalityDisplayName({
      name: '오티스',
      title: '거미집\n중지 아비',
      nameWithTitle: '오티스',
    })).toBe('거미집 중지 아비')
  })

  it('keeps localized number-zero derived skills but skips hidden unlocalized condition skills', () => {
    const gamePerson = {
      id: 11115,
      characterId: 11,
      attributeList: [
        { skillId: 1111505, number: 0 },
        { skillId: 1111510, number: 0 },
      ],
    }

    const skillMap = new Map([
      [1111505, {
        id: 1111505,
        skillTier: 1,
        requireIDList: ['CheckAwakenLevel3'],
        skillData: [{
          gaksungLevel: 3,
          atkType: 'HIT',
          defType: 'ATTACK',
          attributeType: 'VIOLET',
          defaultValue: 3,
          skillLevelCorrection: 2,
          targetNum: 1,
          coinList: [{ operatorType: 'ADD', scale: 2 }],
        }],
      }],
      [1111510, {
        id: 1111510,
        skillTier: 3,
        isHiddenForUI: true,
        requireIDList: ['CheckAwakenLevel3'],
        skillData: [{
          gaksungLevel: 3,
          atkType: 'HIT',
          defType: 'COUNTER',
          attributeType: 'VIOLET',
          defaultValue: 3,
          skillLevelCorrection: 2,
          targetNum: 1,
          coinList: [{ operatorType: 'ADD', scale: 2 }],
        }],
      }],
    ])

    const krSkillMap = new Map([
      [1111505, {
        id: 1111505,
        levelList: [{ level: 3, name: '배떼지를 갈라주지', desc: '', coinlist: [] }],
      }],
    ])

    expect(hasLocalizedSkillContent(krSkillMap.get(1111510))).toBe(false)
    expect(hasLocalizedSkillContent({
      id: 1111511,
      levelList: [{ level: 3, name: '', desc: '', coinlist: [] }],
    })).toBe(false)

    const rows = buildSkillRows(gamePerson, skillMap, krSkillMap, null)

    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.name)).toEqual(['배떼지를 갈라주지', '배떼지를 갈라주지'])
    expect(rows.some(row => row.name === '스킬3')).toBe(false)
  })

  it('REQ-DATA-SYNC-035 includes unlocked tier-three counter variants with their level-specific raw descriptions', () => {
    const skill = {
      id: 1021607, skillTier: 3, isHiddenForUI: false, requireIDList: ['CheckAwakenLevel3'],
      skillData: [{ gaksungLevel: 3, defType: 'COUNTER', atkType: 'SLASH',
        defaultValue: 3, coinList: [{ operatorType: 'ADD', scale: 4 }] }],
    }
    const locale = { id: skill.id, levelList: [3, 4].map(level => ({
      level, name: '정오의 해체', desc: `동기화 ${level} 설명`,
      coinlist: [{ coindescs: [{ desc: '[OnSucceedAttack] 코인 효과' }] }],
    })) }
    const rows = buildSkillRows(
      { id: 10216, characterId: 2, defenseSkillIDList: [skill.id, 1021608, 1021609] },
      new Map([[skill.id, skill], [1021608, { ...skill, id: 1021608, isHiddenForUI: true }],
        [1021609, { ...skill, id: 1021609, isHiddenForUI: true }]]),
      new Map([[skill.id, locale], [1021608, { ...locale, id: 1021608 }]]), null,
    )
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row).toMatchObject({ name: '정오의 해체', skill_order: 3, skill_type: 'counter' })
      expect(['1021607', '1021608']).toContain(row.image_id)
      // REQ-DATA-SYNC-035: the coin text stays raw inside <coin=N>, and the [Tag] is not translated or labelled.
      expect(row.description).toBe(`동기화 ${row.uptie_level} 설명\n<coin=1>[OnSucceedAttack] 코인 효과</coin>`)
    }
  })

  it('compares generated and DB skill rows with stable ordering and null normalization', () => {
    const baseSkill = {
      identity_id: 'identity-1',
      name: '배떼지를 갈라주지',
      skill_type: 'blunt',
      atk_type: 'blunt',
      sin_affinity: 'pride',
      base_power: 3,
      coin_power: 2,
      coins: 1,
      offense_level: 62,
      description: '피해량 +10%',
      skill_order: 1,
      atk_weight: 1,
      variant_order: 1,
      uptie_level: 3,
    }

    expect(areSkillRowsDifferent(
      [
        { ...baseSkill, name: '두 번째', skill_order: 2, uptie_level: 4 },
        baseSkill,
      ],
      [
        {
          id: 'db-skill-2',
          ...baseSkill,
          name: '두 번째',
          skill_order: 2,
          uptie_level: 4,
          name_en: null,
          name_jp: null,
          description_en: null,
          description_jp: null,
        },
        {
          id: 'db-skill-1',
          ...baseSkill,
          name_en: undefined,
          name_jp: undefined,
          description_en: undefined,
          description_jp: undefined,
        },
      ],
    )).toBe(false)

    expect(areSkillRowsDifferent(
      [baseSkill],
      [{ id: 'db-skill-1', ...baseSkill }, { id: 'stale-skill', ...baseSkill, name: '삭제 대상' }],
    )).toBe(true)
  })

  it('keeps existing skill ids when a rebuild only changes content', () => {
    const skill = { name: '가드', skill_order: 4, uptie_level: 4, variant_order: 1, image_id: '1010104' }
    const rows = withStableSkillIds(
      [{ ...skill, image_id: '1010104_4' }, { ...skill, name: '신규 스킬' }],
      [{ id: 'db-skill-1', ...skill, image_id: '1010104' }],
    )
    expect(rows.map(row => row.id)).toEqual(['db-skill-1', undefined])
    expect(rows[0].image_id).toBe('1010104_4')
  })

  it('treats same-name skill variants as equal regardless of row order', () => {
    const a = { name: '도축 - 갈비뼈', skill_order: 1, uptie_level: 4, base_power: 3, coin_power: 4, variant_order: 1, image_id: '1021501' }
    const b = { ...a, variant_order: 4, image_id: '1021505' }
    expect(areSkillRowsDifferent([a, b], [b, a])).toBe(false)
  })
})

// Raw strings copied from the 2026-09-24 extraction (complete-data). Only the "<b>화상</b>" keyword name and the
// "<i>…</i>" flavor are made up, to pin that names are still cleaned and flavor text is kept raw.
const KR_SKILL_1011001 = { id: 1011001, levelList: [{ level: 4, name: '떠난이에게 축하를', flavor: '<i>작별</i> 인사', desc: '<style="highlight">보유한 [BulletLament]가 10 이상이면, 합 위력 +1</style>\n대상의 [Sinking]과 모든 [SinkingWhite]의 합이 6 이상이면, 코인 위력 +1\n[WinDuel] [Sinking] 횟수 2 증가\n', coinlist: [
  { coindescs: [{ desc: '[BulletLament] 1 소모' }, { desc: '[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여' }] },
  { coindescs: [{ desc: '[BulletLament] 1 소모' }, { desc: '[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여' }] },
  { coindescs: [] },
] }] }
const EN_SKILL_1011001 = { id: 1011001, levelList: [{ level: 4, name: 'Celebration for the Departed', desc: '<style="highlight">At 10+ [BulletLament], Clash Power +1</style>\nIf the sum of the target\'s [Sinking] and both [SinkingWhite] is 6 or higher, Coin Power +1\n[WinDuel] Inflict +2 [Sinking] Count', coinlist: [
  { coindescs: [{ desc: 'Spend 1 [BulletLament]' }, { desc: '[OnSucceedAttack] Inflict [SinkingWhite] equal to [BulletLament] spent' }] },
  { coindescs: [{ desc: 'Spend 1 [BulletLament]' }, { desc: '[OnSucceedAttack] Inflict [SinkingWhite] equal to [BulletLament] spent' }] },
] }] }
const JP_SKILL_1011001 = { id: 1011001, levelList: [{ level: 4, name: '往にし者へ祝辞を', desc: '<style="highlight">保有した[BulletLament]が10以上なら、マッチ威力 +1</style>\n[WinDuel] [Sinking]回数が2増加', coinlist: [
  { coindescs: [{ desc: '[BulletLament]を1消耗' }, { desc: '[OnSucceedAttack] 消耗した[BulletLament]だけ[SinkingWhite]を付与' }] },
] }] }
const KR_PASSIVE_1020601 = { id: 1020601, name: '차가 식기 전에...', desc: '상대의 약점, 취약 속성(내성 1 초과) 으로 공격할 때, 공격 전 대상의 <sprite name="Burst"><color=#e30000><u><link="Burst">파열</color></link></u>만큼 <sprite name="Breath"><color=#f8c200><u><link="Breath">호흡</color></link></u>을 얻음 (턴 당 최대 20)', summary: '약점, 취약 속성으로 공격할 때, 공격 전 대상의 파열만큼 호흡을 얻음' }
const EN_PASSIVE_1020601 = { id: 1020601, name: 'Before the Tea Cools...', desc: 'When attacking a target using a damage type the target is "Weak" or "Fatal" (Resistance>x1) to, gain [Breath] equal to [Burst] on target before the attack (max 20 per turn)' }
const JP_PASSIVE_1020601 = { id: 1020601, name: 'お茶が冷める前に…', desc: '対象の弱点・脆弱属性(耐性1超過)で攻撃するとき、攻撃前対象の<sprite name="Burst"><color=#e30000><u><link="Burst">破裂</color></link></u>だけ<sprite name="Breath"><color=#f8c200><u><link="Breath">呼吸</color></link></u>を得る(1ターンにつき最大20)' }
const EGO_SKILL_2010211 = {
  kr: { id: 2010211, levelList: [{ level: 5, name: '4번째 성냥불', desc: '<style="highlight">[BeforeAttack] 모든 공격 대상의 [Combustion]의 합\n- 6당, 최종 위력 +1 (최대 4)\n- 1당, 피해량 +1% (최대 30%)</style>', coinlist: [{ coindescs: [{ desc: '[OnSucceedAttack] [Combustion] 4 부여<style="highlight"></style>' }, { desc: '[OnSucceedAttackHead] [Combustion] 6 부여<style="highlight"></style>' }] }] }] },
  en: { id: 2010211, levelList: [{ level: 5, name: '4th Match Flame', desc: '<style="highlight">[BeforeAttack] Apply the following effects:\n- Final Power +1 for every 6 [Combustion] on all targets (max 4)</style>', coinlist: [{ coindescs: [{ desc: '[OnSucceedAttack] Inflict 4 [Combustion]<style="highlight"></style>' }] }] }] },
  jp: { id: 2010211, levelList: [{ level: 5, name: '4本目のマッチの火', desc: '<style="highlight">[BeforeAttack] 全攻撃対象の[Combustion]の合計</style>', coinlist: [{ coindescs: [{ desc: '[OnSucceedAttack] [Combustion]4を付与<style="highlight"></style>' }] }] }] },
}
const EGO_PASSIVE_2030111 = { kr: '공격 적중 시 대상에게 [Laceration]이 있으면 체력 3 회복', jp: '攻撃的中時、対象に[Laceration]があるなら体力を3回復' }
const BUFS = {
  kr: [{ id: 'Combustion', name: '<b>화상</b>', desc: '{1}턴 동안 턴 종료 시 {0}만큼 고정 체력 피해를 입음' },
    { id: 'Charge', name: '충전', desc: '소모 시 특정 스킬의 능력이 상승함. 횟수를 최대 20까지 얻을 수 있음. 턴 종료 시 횟수 1 감소.\n\n<color=#1aece7>횟수 누적 소모량: {2}</color>' }],
  en: [{ id: 'Combustion', name: 'Burn', desc: 'Turn End: Take {0} fixed damage. Lasts {1} turn(s).' }],
  jp: [{ id: 'Combustion', name: '火傷', desc: '{1}ターンの間、ターン終了時に{0}の固定ダメージを受ける' }],
}

describe('REQ-DATA-SYNC-035 identity and EGO text is stored as the game wrote it', () => {
  type Sync = typeof import('./identity-data')
  let dir = ''
  let sync: Sync

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'identity-raw-text-'))
    const write = (lang: string, file: string, list: unknown[]) => {
      mkdirSync(join(dir, lang), { recursive: true })
      writeFileSync(join(dir, lang, file), JSON.stringify({ dataList: list }))
    }
    write('KR', 'KR_Skills_personality-01.txt', [KR_SKILL_1011001])
    write('EN', 'EN_Skills_personality-01.txt', [EN_SKILL_1011001])
    write('JP', 'JP_Skills_personality-01.txt', [JP_SKILL_1011001])
    write('KR', 'KR_Passives.txt', [KR_PASSIVE_1020601])
    write('EN', 'EN_Passives.txt', [EN_PASSIVE_1020601])
    write('JP', 'JP_Passives.txt', [JP_PASSIVE_1020601])
    write('KR', 'KR_Skills_Ego.txt', [EGO_SKILL_2010211.kr])
    write('EN', 'EN_Skills_Ego.txt', [EGO_SKILL_2010211.en])
    write('JP', 'JP_Skills_Ego.txt', [EGO_SKILL_2010211.jp])
    write('KR', 'KR_Passive_Ego.txt', [{ id: 2030111, name: '과도한 열정', desc: EGO_PASSIVE_2030111.kr }])
    write('EN', 'EN_Passive_Ego.txt', [])
    write('JP', 'JP_Passive_Ego.txt', [{ id: 2030111, name: '過度な熱情', desc: EGO_PASSIVE_2030111.jp }])
    for (const lang of ['kr', 'en', 'jp'] as const) write(lang.toUpperCase(), `${lang.toUpperCase()}_Bufs.txt`, BUFS[lang])
    // The paths are read when the module loads, so load a copy that sees the fixture directory.
    vi.resetModules()
    vi.stubEnv('LIMBUS_DATA_DIR', dir)
    sync = await import('./identity-data')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
    rmSync(dir, { recursive: true, force: true })
  })

  it('REQ-DATA-SYNC-035 rawGameText only trims the surrounding whitespace', () => {
    expect(rawGameText('  <style="highlight">[Combustion]</style> {0}\n ')).toBe('<style="highlight">[Combustion]</style> {0}')
    expect(rawGameText(undefined)).toBe('')
  })

  it('REQ-DATA-SYNC-035 closes each passive text before joining them, so a tag does not run into the next passive', () => {
    expect(joinPassiveGameTexts(['<color=#ff6000>첫째 <u>밑줄', '둘째'])).toBe('<color=#ff6000>첫째 <u>밑줄</u></color>\n\n둘째')
    expect(joinPassiveGameTexts(['<style="highlight">- a\n- b</style>', '둘째'])).toBe('<style="highlight">- a\n- b</style>\n\n둘째')
  })

  it('REQ-DATA-SYNC-035 skips empty passive texts and gives null when none is left', () => {
    expect(joinPassiveGameTexts(['', undefined, '본문', null])).toBe('본문')
    expect(joinPassiveGameTexts(['', undefined])).toBeNull()
    expect(joinPassiveGameTexts([])).toBeNull()
  })

  it('REQ-DATA-SYNC-035 composes a skill description as the main text, then each coin that has descriptions inside <coin=N>', () => {
    const level = KR_SKILL_1011001.levelList[0]
    expect(composeRawSkillDescription(level)).toBe([
      '<style="highlight">보유한 [BulletLament]가 10 이상이면, 합 위력 +1</style>',
      '대상의 [Sinking]과 모든 [SinkingWhite]의 합이 6 이상이면, 코인 위력 +1',
      '[WinDuel] [Sinking] 횟수 2 증가',
      '<coin=1>[BulletLament] 1 소모\n[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여</coin>',
      '<coin=2>[BulletLament] 1 소모\n[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여</coin>',
    ].join('\n'))
    // The coin number is the coin's position, so an empty coin 1 leaves coin 2 numbered 2; no main text means no leading newline.
    expect(composeRawSkillDescription({ desc: '', coinlist: [{ coindescs: [] }, { coindescs: [{ desc: ' [OnSucceedAttack] 피해 ' }] }] })).toBe('<coin=2>[OnSucceedAttack] 피해</coin>')
    expect(composeRawSkillDescription(undefined)).toBe('')
  })

  it('REQ-DATA-SYNC-035 stores identity skill rows raw in KR, EN and JP: tags, [Id] and the coin blocks stay; the name is cleaned', () => {
    const sources = sync.loadSkillPassiveSources()
    const gamePerson = { id: 10110, characterId: 1, attributeList: [{ skillId: 1011001 }] }
    const skillMap = new Map([[1011001, { id: 1011001, skillTier: 1, skillData: [{ gaksungLevel: 4, atkType: 'HIT', defType: 'ATTACK', attributeType: 'VIOLET', defaultValue: 3, targetNum: 1, coinList: [{ operatorType: 'ADD', scale: 2 }, { operatorType: 'ADD', scale: 2 }] }] }]])
    const rows = sync.buildSkillRows(gamePerson, skillMap, sources.krSkillMap, null, sources.enLocale, sources.jpLocale)
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row.description).toBe([
      '<style="highlight">보유한 [BulletLament]가 10 이상이면, 합 위력 +1</style>',
      '대상의 [Sinking]과 모든 [SinkingWhite]의 합이 6 이상이면, 코인 위력 +1',
      '[WinDuel] [Sinking] 횟수 2 증가',
      '<coin=1>[BulletLament] 1 소모\n[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여</coin>',
      '<coin=2>[BulletLament] 1 소모\n[OnSucceedAttack] 소모한 [BulletLament]만큼 [SinkingWhite] 부여</coin>',
    ].join('\n'))
    expect(row.description_en).toBe([
      '<style="highlight">At 10+ [BulletLament], Clash Power +1</style>',
      "If the sum of the target's [Sinking] and both [SinkingWhite] is 6 or higher, Coin Power +1",
      '[WinDuel] Inflict +2 [Sinking] Count',
      '<coin=1>Spend 1 [BulletLament]\n[OnSucceedAttack] Inflict [SinkingWhite] equal to [BulletLament] spent</coin>',
      '<coin=2>Spend 1 [BulletLament]\n[OnSucceedAttack] Inflict [SinkingWhite] equal to [BulletLament] spent</coin>',
    ].join('\n'))
    expect(row.description_jp).toBe([
      '<style="highlight">保有した[BulletLament]が10以上なら、マッチ威力 +1</style>',
      '[WinDuel] [Sinking]回数が2増加',
      '<coin=1>[BulletLament]を1消耗\n[OnSucceedAttack] 消耗した[BulletLament]だけ[SinkingWhite]を付与</coin>',
    ].join('\n'))
    expect(row.flavor).toBe('<i>작별</i> 인사')
    expect(row.name).toBe('떠난이에게 축하를')
  })

  it('REQ-DATA-SYNC-035 stores passive descriptions raw (sprite, color, link and [Id] stay; no {0} word)', () => {
    const sources = sync.loadSkillPassiveSources()
    const mapping = { personalityID: 10206, battlePassiveList: [{ level: 1, passiveIDList: [1020601] }], supporterPassiveList: [] }
    const rows = sync.buildPassiveRows(mapping, 'identity-1', sources.krPassiveMap, new Map(), sources.enLocale, sources.jpLocale)
    const krRaw = '상대의 약점, 취약 속성(내성 1 초과) 으로 공격할 때, 공격 전 대상의 <sprite name="Burst"><color=#e30000><u><link="Burst">파열</color></link></u>만큼 <sprite name="Breath"><color=#f8c200><u><link="Breath">호흡</color></link></u>을 얻음 (턴 당 최대 20)'
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.description).toBe(krRaw)
      expect(row.description_en).toBe(EN_PASSIVE_1020601.desc)
      expect(row.description_jp).toBe(JP_PASSIVE_1020601.desc)
    }
    expect(rows[0].name).toBe('차가 식기 전에...')
  })

  it('REQ-DATA-SYNC-035 loads EGO skill and passive text raw for the bootstrap rows, with the coin blocks', () => {
    const context = sync.loadEgoSyncContext()
    expect(sync.composeRawSkillDescription(context.skills.kr.get('2010211_5'))).toBe([
      '<style="highlight">[BeforeAttack] 모든 공격 대상의 [Combustion]의 합\n- 6당, 최종 위력 +1 (최대 4)\n- 1당, 피해량 +1% (최대 30%)</style>',
      '<coin=1>[OnSucceedAttack] [Combustion] 4 부여<style="highlight"></style>\n[OnSucceedAttackHead] [Combustion] 6 부여<style="highlight"></style></coin>',
    ].join('\n'))
    expect(sync.composeRawSkillDescription(context.skills.en.get('2010211_5'))).toContain('Inflict 4 [Combustion]<style="highlight"></style></coin>')
    expect(context.skills.jp.get('2010211_5')?.name).toBe('4本目のマッチの火')
    expect(context.passives.kr.get(2030111)?.desc).toBe(EGO_PASSIVE_2030111.kr)
    expect(context.passives.jp.get(2030111)?.desc).toBe(EGO_PASSIVE_2030111.jp)
  })

  it('REQ-DATA-SYNC-035 reads keyword descriptions raw, keeps keyword names cleaned, and lets placeholder-rules tokenize the slots', () => {
    const kr = sync.loadKrKeywordDescriptions()
    // The made-up "<b>화상</b>" name is looked up by its cleaned form.
    const combustion = kr.get('화상')?.[0]
    expect(combustion?.id).toBe('Combustion')
    expect(combustion?.description).toBe('{1}턴 동안 턴 종료 시 {0}만큼 고정 체력 피해를 입음')
    expect(buffPlaceholders(combustion?.description, 'Combustion')).toBe('{{count}}턴 동안 턴 종료 시 {{potency}}만큼 고정 체력 피해를 입음')
    // A tag around a slot survives; the slot becomes the live-value token (BUFF_PLACEHOLDER_ROLES.Charge).
    const charge = kr.get('충전')?.[0]
    expect(charge?.description).toContain('<color=#1aece7>횟수 누적 소모량: {2}</color>')
    expect(buffPlaceholders(charge?.description, 'Charge')).toContain('<color=#1aece7>횟수 누적 소모량: {{live}}</color>')
    expect(sync.loadLangKeywordDescriptions('en').get('Combustion')?.description).toBe('Turn End: Take {0} fixed damage. Lasts {1} turn(s).')
    expect(sync.loadLangKeywordDescriptions('jp').get('Combustion')?.name).toBe('火傷')
  })
})
