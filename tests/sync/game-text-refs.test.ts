import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildGameTextRefs,
  diffGameTextRefs,
  readGameTextSources,
  type GameTextRefRow,
  type GameTextSources,
} from '@/scripts/sync/game-text-refs-rules'

// Fixtures are entries copied verbatim from the 2026-09-24 extraction (KR/EN/JP): Combustion, AttackDown (KR name ends
// with a space), Vibration, FavorBuffTwth1stPhaseForUI (Unity tags in desc, in the BossRaid file), and SkillTag ids
// OnSucceedAttack, WhenUse, nxPostLine and CantBreak (only JP has it).
const FIXTURES = resolve(__dirname, '../fixtures/game-text-refs')

const row = (rows: GameTextRefRow[], id: string) => {
  const found = rows.find(r => r.id === id)
  if (!found) throw new Error(`no row ${id}`)
  return found
}

describe('REQ-DATA-SYNC-034 game text refs from the extraction files', () => {
  const sources = readGameTextSources(FIXTURES)
  const rows = buildGameTextRefs({ ...sources, keywordMetaNames: ['화상', '공격레벨감소', '진동'] })

  it('REQ-DATA-SYNC-034 reads every BattleKeywords*/SkillTag* file of each language', () => {
    expect(sources.keywords.kr.map(e => e.id).sort()).toEqual(['AttackDown', 'Combustion', 'FavorBuffTwth1stPhaseForUI', 'Vibration'])
    expect(sources.skillTags.kr.map(e => e.id).sort()).toEqual(['OnSucceedAttack', 'WhenUse', 'nxPostLine'])
    expect(sources.skillTags.jp.map(e => e.id)).toContain('CantBreak')
    expect(rows.map(r => r.id)).toEqual([...rows.map(r => r.id)].sort())
  })

  it('REQ-DATA-SYNC-034 a keyword row holds the name and description of all three languages', () => {
    expect(row(rows, 'Combustion')).toEqual({
      id: 'Combustion',
      kind: 'keyword',
      name: '화상',
      name_en: 'Burn',
      name_jp: expect.any(String),
      description: '턴 종료 시, 효과 위력만큼 고정 체력 피해를 받음\n턴 종료 후 횟수 1 감소',
      description_en: 'At the end of the turn, take fixed damage by the effect’s Potency.\nThen, reduce its Count by 1.',
      description_jp: expect.any(String),
      flavor: null,
      flavor_en: null,
      flavor_jp: null,
      keyword_name: '화상',
    })
    expect(row(rows, 'Combustion').name_jp).not.toBe('')
  })

  it('REQ-DATA-SYNC-034 trims the trailing space of a name but keeps the description verbatim', () => {
    const attackDown = row(rows, 'AttackDown')
    expect(attackDown.name).toBe('공격 레벨 감소')
    expect(attackDown.description).toBe('한 턴 동안 공격 레벨이 수치에 비례하여 감소')
  })

  it('REQ-DATA-SYNC-034 keeps Unity tags in a description untouched', () => {
    const favor = row(rows, 'FavorBuffTwth1stPhaseForUI')
    expect(favor.description).toContain('<color=#f8c200>출혈 또는 특수 출혈</color>')
    expect(favor.description_en).toContain('<color=#f8c200>')
    expect(favor.name).toBe('사영 [루주]')
  })

  it('REQ-DATA-SYNC-034 keyword_name matches the keyword_meta name ignoring whitespace', () => {
    expect(row(rows, 'Combustion').keyword_name).toBe('화상')
    expect(row(rows, 'AttackDown').keyword_name).toBe('공격레벨감소')
    expect(row(rows, 'Vibration').keyword_name).toBe('진동')
    expect(row(rows, 'FavorBuffTwth1stPhaseForUI').keyword_name).toBeNull()
  })

  it('REQ-DATA-SYNC-034 SkillTag ids become skilltag rows with their bracketed label and no description', () => {
    const onHit = row(rows, 'OnSucceedAttack')
    expect(onHit).toMatchObject({ kind: 'skilltag', name: '[적중시]', name_en: '[On Hit]', description: null, description_en: null, description_jp: null, keyword_name: null })
    expect(row(rows, 'nxPostLine').name).toBe('[전열 {n}명]')
  })

  it('REQ-DATA-SYNC-034 an id only one language has keeps the other languages empty', () => {
    expect(row(rows, 'CantBreak')).toMatchObject({ kind: 'skilltag', name: null, name_en: null, name_jp: '[破壊不能コイン]' })
  })
})

describe('REQ-DATA-SYNC-034 same id in several files and kinds', () => {
  const empty = { kr: [], en: [], jp: [] }
  const sources = (over: Partial<GameTextSources>): GameTextSources => ({ keywords: empty, skillTags: empty, ...over })

  it('REQ-DATA-SYNC-034 the richest entry wins per language, whatever the file order', () => {
    const rows = buildGameTextRefs({
      ...sources({
        keywords: {
          kr: [{ id: 'Burn', name: '화상' }, { id: 'Burn', name: '화상', desc: '턴 종료 시 피해' }],
          en: [{ id: 'Burn', name: 'Burn', desc: 'Takes damage' }, { id: 'Burn', name: 'Burn' }],
          jp: [],
        },
      }),
      keywordMetaNames: [],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: '화상', description: '턴 종료 시 피해', name_en: 'Burn', description_en: 'Takes damage', name_jp: null })
  })

  it('REQ-DATA-SYNC-034 an id in both BattleKeywords and SkillTag is a skilltag', () => {
    const rows = buildGameTextRefs({
      ...sources({
        keywords: { kr: [{ id: 'Wide', name: '광역', desc: '넓다' }], en: [], jp: [] },
        skillTags: { kr: [{ id: 'Wide', name: '[광역]' }], en: [], jp: [] },
      }),
      keywordMetaNames: ['광역'],
    })
    expect(rows).toEqual([expect.objectContaining({ id: 'Wide', kind: 'skilltag', name: '[광역]', description: null, keyword_name: null })])
  })

  it('REQ-DATA-SYNC-034 no keyword_meta name equal to the KR name leaves keyword_name empty', () => {
    const rows = buildGameTextRefs({
      ...sources({ keywords: { kr: [{ id: 'A', name: '없는 이름' }], en: [], jp: [] } }),
      keywordMetaNames: ['화상'],
    })
    expect(rows[0].keyword_name).toBeNull()
  })

  it('REQ-DATA-SYNC-034 an exact keyword_meta name is preferred over a whitespace-insensitive one', () => {
    const rows = buildGameTextRefs({
      ...sources({ keywords: { kr: [{ id: 'A', name: '공격 레벨 감소' }], en: [], jp: [] } }),
      keywordMetaNames: ['공격레벨감소', '공격 레벨 감소'],
    })
    expect(rows[0].keyword_name).toBe('공격 레벨 감소')
  })
})

describe('REQ-DATA-SYNC-034 comparing with the stored rows', () => {
  const base: GameTextRefRow = {
    id: 'Combustion', kind: 'keyword', name: '화상', name_en: 'Burn', name_jp: '燃焼',
    description: 'a', description_en: 'b', description_jp: 'c', flavor: null, flavor_en: null, flavor_jp: null, keyword_name: '화상',
  }

  it('REQ-DATA-SYNC-034 counts new, changed and unchanged rows (updated_at is ignored)', () => {
    const next: GameTextRefRow[] = [base, { ...base, id: 'Vibration', name: '진동' }, { ...base, id: 'Poise', name: '호흡' }, { ...base, id: 'Bleed' }]
    const stored = [
      { ...base, updated_at: '2026-09-01T00:00:00Z' },
      { ...base, id: 'Vibration', name: '진동 ' },
      { ...base, id: 'Bleed', keyword_name: null },
    ]
    const diff = diffGameTextRefs(stored, next)
    expect(diff.unchanged.map(r => r.id)).toEqual(['Combustion'])
    expect(diff.changed.map(r => r.id)).toEqual(['Vibration', 'Bleed'])
    expect(diff.created.map(r => r.id)).toEqual(['Poise'])
  })
})

describe('REQ-DATA-SYNC-034 reading source files', () => {
  it('REQ-DATA-SYNC-034 strips a BOM and fails loudly on a file that is not valid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'game-text-refs-'))
    try {
      for (const lang of ['KR', 'EN', 'JP']) mkdirSync(join(dir, lang))
      writeFileSync(join(dir, 'KR', 'KR_BattleKeywords.txt'), '﻿' + JSON.stringify({ dataList: [{ id: 'A', name: '가' }] }))
      expect(readGameTextSources(dir).keywords.kr).toEqual([{ id: 'A', name: '가' }])
      writeFileSync(join(dir, 'EN', 'EN_SkillTag.txt'), '{ broken')
      expect(() => readGameTextSources(dir)).toThrow(/EN_SkillTag\.txt/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('REQ-KEYWORDS-004 keyword flavor lines', () => {
  const empty = { kr: [], en: [], jp: [] }
  const sources = (over: Partial<GameTextSources>): GameTextSources => ({ keywords: empty, skillTags: empty, ...over })
  it('REQ-KEYWORDS-004 keeps the flavor of a keyword per language, from another file when the richest entry has none', () => {
    const rows = buildGameTextRefs({
      ...sources({
        keywords: {
          kr: [{ id: 'TangleBlackYarn', name: '뒤엉킴', desc: '- 최댓값 : 30\n- 수치당 받는 피해량 +1%' }, { id: 'TangleBlackYarn', name: '뒤엉킴', flavor: '검은 물이 <i>검은 실</i>로 엉켜간다.' }],
          en: [{ id: 'TangleBlackYarn', name: 'Tangle', desc: 'Max 30', flavor: 'Black yarn.' }],
          jp: [],
        },
        skillTags: { kr: [{ id: 'OnSucceedAttack', name: '[적중시]', flavor: '없음' }], en: [], jp: [] },
      }),
      keywordMetaNames: [],
    })
    const tangle = rows.find(row => row.id === 'TangleBlackYarn')!
    expect(tangle).toMatchObject({ flavor: '검은 물이 <i>검은 실</i>로 엉켜간다.', flavor_en: 'Black yarn.', flavor_jp: null })
    expect(rows.find(row => row.id === 'OnSucceedAttack')).toMatchObject({ flavor: null })
  })

  it('REQ-KEYWORDS-004 counts a new flavor as a change of the stored row', () => {
    const base = { id: 'X', kind: 'keyword', name: 'x', name_en: null, name_jp: null, description: null, description_en: null, description_jp: null, flavor: null, flavor_en: null, flavor_jp: null, keyword_name: null } as const
    expect(diffGameTextRefs([base], [{ ...base, flavor: '대사' }]).changed).toHaveLength(1)
  })
})
