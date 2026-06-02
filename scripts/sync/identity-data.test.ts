import { describe, expect, it } from 'vitest'

import {
  buildSkillRows,
  areSkillRowsDifferent,
  cleanLocaleContent,
  findStaleRichTextKeywordMetaNames,
  hasLocalizedSkillContent,
  normalizeKrPersonalityDisplayName,
  resolveKeywordEffectTypeForSyncTest,
  resolveKeywordMetaSourceForSyncTest,
  translateDescriptionForSyncTest,
  translateDesc,
} from './identity-data'

describe('identity-data sync helpers', () => {
  it('Unity rich text tags are stripped before locale text is normalized', () => {
    const source = '자신에게 <style="highlight"><b><i><u><s>중지</s></u></i></b></style> - 원한 문신 [<s>큰 누님</s>] <color=#ff00ff><link="x"><size=80%><mark=#fff>강화</mark></size></link></color><sprite name="x" />'

    expect(cleanLocaleContent(source)).toBe('자신에게 중지 - 원한 문신 [큰 누님] 강화')
    expect(translateDesc(source)).toBe('자신에게 중지 - 원한 문신 [큰 누님] 강화')
    expect(translateDescriptionForSyncTest(
      '중지 - 원한 문신 [MiddleFatherTattoo]',
      { MiddleFatherTattoo: '<s>큰 누님</s>' },
    )).toBe('중지 - 원한 문신 큰 누님')
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
          defense_level: null,
        },
        {
          id: 'db-skill-1',
          ...baseSkill,
          name_en: undefined,
          name_jp: undefined,
          description_en: undefined,
          description_jp: undefined,
          defense_level: undefined,
        },
      ],
    )).toBe(false)

    expect(areSkillRowsDifferent(
      [baseSkill],
      [{ id: 'db-skill-1', ...baseSkill }, { id: 'stale-skill', ...baseSkill, name: '삭제 대상' }],
    )).toBe(true)
  })
})
