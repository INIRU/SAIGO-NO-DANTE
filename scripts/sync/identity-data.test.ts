import { describe, expect, it } from 'vitest'

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
  translateDescriptionForSyncTest,
  translateDesc,
  deriveIdentityAcquisition,
  fillValuePlaceholders,
  unknownBuffPlaceholders,
} from './identity-data'

describe('identity-data sync helpers', () => {
  it('stores buff value slots in keyword descriptions as tokens instead of leaving {0}', () => {
    expect(fillValuePlaceholders('이번 턴 동안 타격 속성 스킬의 최종 위력 -{0}', 'HitPowerDown')).toBe('이번 턴 동안 타격 속성 스킬의 최종 위력 -{{potency}}')
    expect(fillValuePlaceholders('Deal +{0}% damage for {1} turns', 'Combustion')).toBe('Deal +{{potency}}% damage for {{count}} turns')
    expect(fillValuePlaceholders('대상의 참격 내성을 {0:F1} 감소', 'SlashResistUp')).toBe('대상의 참격 내성을 {{potency}} 감소')
    // Source cases (complete-data 2026-09-24) where a slot is not potency or count.
    expect(fillValuePlaceholders('횟수 누적 소모량: {2}', 'Charge')).toBe('횟수 누적 소모량: {{live}}')
    expect(fillValuePlaceholders('- {0} 포박중', 'TiedWithRope')).toBe('- {{target}} 포박중')
    expect(fillValuePlaceholders(null, 'Combustion')).toBeNull()
    expect(fillValuePlaceholders('{5} 새 자리', 'NewBuff')).toBe('{{value}} 새 자리')
    expect(unknownBuffPlaceholders.get('NewBuff')).toEqual(new Set([5]))
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
  it('Unity rich text tags are stripped before locale text is normalized', () => {
    const source = '자신에게 <style="highlight"><b><i><u><s>중지</s></u></i></b></style> - 원한 문신 [<s>큰 누님</s>] <color=#ff00ff><link="x"><size=80%><mark=#fff>강화</mark></size></link></color><sprite name="x" />'

    expect(cleanLocaleContent(source)).toBe('자신에게 중지 - 원한 문신 [큰 누님] 강화')
    expect(translateDesc(source)).toBe('자신에게 중지 - 원한 문신 [큰 누님] 강화')
    expect(translateDescriptionForSyncTest(
      '중지 - 원한 문신 [MiddleFatherTattoo]',
      { MiddleFatherTattoo: '<s>큰 누님</s>' },
    )).toBe('중지 - 원한 문신 큰 누님')
  })

  it('names the EGO passive section tags from SkillTag, which already carry their brackets', () => {
    // KR_SkillTag (2026-09 extraction): section headers of an EGO passive's always-on and on-use effects.
    expect(translateDescriptionForSyncTest(
      '[AlwaysUseEGOPassive2010911]\n\n기본 스킬의 공격 적중 시 대상에게 진동 2 부여\n\n[WhenUseEGOPassive]',
      { AlwaysUseEGOPassive2010911: '[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과]', WhenUseEGOPassive: '[사용 효과]' },
    )).toBe('[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과]\n\n기본 스킬의 공격 적중 시 대상에게 진동 2 부여\n\n[사용 효과]')
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

  it('includes unlocked tier-three counter variants with their level-specific descriptions', () => {
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
      expect(row.description).toBe(`동기화 ${row.uptie_level} 설명\n[코인 1] [적중시] 코인 효과`)
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
