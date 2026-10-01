import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildGameTextRefs,
  countRefUsage,
  keepOrSetGameId,
  planKeywordGameIds,
  readGameTextSources,
  readRefUsage,
  resolveKeywordGameIds,
  selectPrimaryRefs,
  type GameTextRefRow,
} from '@/scripts/sync/game-text-refs-rules'

const FIXTURES = resolve(__dirname, '../fixtures/game-text-refs')

const ref = (id: string, name: string | null, keyword_name: string | null = name, kind: GameTextRefRow['kind'] = 'keyword'): GameTextRefRow => ({
  id, kind, name, name_en: null, name_jp: null, description: null, description_en: null, description_jp: null, keyword_name,
})

// 화상 has two ids in the game (Burn, Combustion), 가호 too; 호흡 has one.
const REFS = [
  ref('Burn', '화상'), ref('Combustion', '화상'),
  ref('KnightBless', '가호'), ref('BlessingAlly', '가호'),
  ref('Breath', '호흡'),
  ref('OnHit', '[적중시]', null, 'skilltag'),
]

describe('REQ-DATA-SYNC-038 primary reference of a keyword_meta row', () => {
  it('REQ-DATA-SYNC-038 takes the keyword\'s own tag from the keywords step when the tag is a keyword reference', () => {
    const plan = selectPrimaryRefs({
      refs: REFS,
      metaNames: ['화상'],
      tags: new Map([['화상', 'Combustion']]),
      usage: new Map([['Burn', 99]]),
    })
    expect(plan.chosen.get('화상')).toEqual({ id: 'Combustion', reason: 'tag' })
    expect(plan.ambiguous.size).toBe(0)
    expect(plan.none).toEqual([])
  })

  it('REQ-DATA-SYNC-038 still takes the tag when its reference carries another KR name (game names with Unity tags), and lists the name', () => {
    const refs = [ref('ReinforcedTattooSpider', '중지 - 원한 문신 [<s>큰 형님</s>]', null)]
    const plan = selectPrimaryRefs({ refs, metaNames: ['중지 - 원한 문신 [큰 형님]', '호흡'], tags: new Map([['중지 - 원한 문신 [큰 형님]', 'ReinforcedTattooSpider']]) })
    expect(plan.chosen.get('중지 - 원한 문신 [큰 형님]')).toEqual({ id: 'ReinforcedTattooSpider', reason: 'tag' })
    expect(plan.tagNameDiffers).toEqual(['중지 - 원한 문신 [큰 형님]'])
    expect(selectPrimaryRefs({ refs: REFS, metaNames: ['화상'], tags: new Map([['화상', 'Combustion']]) }).tagNameDiffers).toEqual([])
  })

  it('REQ-DATA-SYNC-038 ignores a tag that is not in the reference table or is only a skill tag', () => {
    const missing = selectPrimaryRefs({ refs: REFS, metaNames: ['호흡'], tags: new Map([['호흡', 'NoSuchTag']]) })
    expect(missing.chosen.get('호흡')).toEqual({ id: 'Breath', reason: 'only' })
    const skillTag = selectPrimaryRefs({ refs: REFS, metaNames: ['호흡'], tags: new Map([['호흡', 'OnHit']]) })
    expect(skillTag.chosen.get('호흡')).toEqual({ id: 'Breath', reason: 'only' })
  })

  it('REQ-DATA-SYNC-038 takes the single reference whose keyword_name is the name', () => {
    const plan = selectPrimaryRefs({ refs: REFS, metaNames: ['호흡'] })
    expect(plan.chosen.get('호흡')).toEqual({ id: 'Breath', reason: 'only' })
  })

  it('REQ-DATA-SYNC-038 among several same-name references takes the one used most in skill, passive and gift texts', () => {
    const plan = selectPrimaryRefs({
      refs: REFS,
      metaNames: ['화상', '가호'],
      usage: new Map([['Burn', 3], ['Combustion', 120], ['KnightBless', 4], ['BlessingAlly', 1]]),
    })
    expect(plan.chosen.get('화상')).toEqual({ id: 'Combustion', reason: 'most-used' })
    expect(plan.chosen.get('가호')).toEqual({ id: 'KnightBless', reason: 'most-used' })
  })

  it('REQ-DATA-SYNC-038 leaves a tie unset and lists the candidates, so the site keeps the keyword_meta texts', () => {
    const plan = selectPrimaryRefs({ refs: REFS, metaNames: ['화상', '가호'], usage: new Map([['Burn', 5], ['Combustion', 5]]) })
    expect(plan.chosen.has('화상')).toBe(false)
    expect(plan.ambiguous.get('화상')).toEqual(['Burn', 'Combustion'])
    // no usage at all is a tie too
    expect(plan.ambiguous.get('가호')).toEqual(['BlessingAlly', 'KnightBless'])
  })

  it('REQ-DATA-SYNC-038 has none for a name no keyword reference carries', () => {
    const plan = selectPrimaryRefs({ refs: REFS, metaNames: ['참격', '호흡'] })
    expect(plan.none).toEqual(['참격'])
    expect(plan.chosen.has('참격')).toBe(false)
  })

  it('REQ-DATA-SYNC-038 does not depend on the order of the references or names', () => {
    const input = { usage: new Map([['Burn', 1], ['Combustion', 2], ['KnightBless', 2], ['BlessingAlly', 2]]), tags: new Map([['호흡', 'Breath']]) }
    const a = selectPrimaryRefs({ ...input, refs: REFS, metaNames: ['화상', '가호', '호흡', '참격'] })
    const b = selectPrimaryRefs({ ...input, refs: [...REFS].reverse(), metaNames: ['참격', '호흡', '가호', '화상'] })
    const plain = (plan: typeof a) => ({ chosen: [...plan.chosen].sort(), ambiguous: [...plan.ambiguous].sort(), none: [...plan.none].sort() })
    expect(plain(b)).toEqual(plain(a))
  })

  it('REQ-DATA-SYNC-038 keeps an id that is already stored when no rule found one, and lets a found one replace it', () => {
    expect(keepOrSetGameId('Combustion', null)).toBe('Combustion')
    expect(keepOrSetGameId('Combustion', undefined)).toBe('Combustion')
    expect(keepOrSetGameId('Combustion', 'Burn')).toBe('Burn')
    expect(keepOrSetGameId(undefined, 'Burn')).toBe('Burn')
    expect(keepOrSetGameId(undefined, null)).toBeNull()
    expect(keepOrSetGameId(undefined, undefined)).toBeNull()
  })
})

describe('REQ-DATA-SYNC-038 how often a reference is used', () => {
  it('REQ-DATA-SYNC-038 counts every [Id] of the given texts, also inside Unity tags and repeated', () => {
    const usage = countRefUsage([
      '<style="highlight">[Combustion]</style> 3 부여, [Combustion] 1 소모 [적중시]',
      '[Burn] 1\n[Combustion]',
    ], new Set(['Combustion', 'Burn', 'Unused']))
    expect(usage.get('Combustion')).toBe(3)
    expect(usage.get('Burn')).toBe(1)
    expect(usage.has('Unused')).toBe(false)
    expect(usage.has('적중시')).toBe(false)
  })

  describe('from the extraction files', () => {
    let dir = ''
    afterEach(() => rmSync(dir, { recursive: true, force: true }))

    it('REQ-DATA-SYNC-038 reads personality and E.G.O skills, passives and gifts but not enemy, abnormality or assist texts', () => {
      dir = mkdtempSync(join(tmpdir(), 'ref-usage-'))
      mkdirSync(join(dir, 'KR'))
      const write = (name: string, text: string) => writeFileSync(join(dir, 'KR', name), `﻿{"dataList":[{"id":1,"desc":"${text}"}]}`)
      write('KR_Skills_personality-01.txt', '[Combustion] [Combustion]')
      write('KR_Skills_Ego_Personality-01.txt', '[Combustion]')
      write('KR_Passives.txt', '[Burn]')
      write('KR_Passive_Ego.txt', '[Burn]')
      write('KR_EGOgift_MirrorDungeon.txt', '[Burn]')
      write('KR_Skills_Enemy.txt', '[Burn] [Burn] [Burn] [Burn]')
      write('KR_Passives_Abnormality.txt', '[Burn] [Burn] [Burn]')
      write('KR_Skills_Assist.txt', '[Burn] [Burn]')
      write('KR_BattleKeywords.txt', '[Burn] [Burn] [Burn] [Burn] [Burn]')
      const usage = readRefUsage(dir, new Set(['Combustion', 'Burn']))
      expect(usage.get('Combustion')).toBe(3)
      expect(usage.get('Burn')).toBe(3)
    })
  })
})

describe('REQ-DATA-SYNC-038 plan from the extraction', () => {
  it('REQ-DATA-SYNC-038 builds the references from the extraction and links each keyword_meta name', () => {
    const plan = planKeywordGameIds({
      dataDir: FIXTURES,
      metaNames: ['화상', '공격레벨감소', '진동', '없는 키워드'],
      tags: new Map([['진동', 'Vibration']]),
    })
    expect(plan.chosen.get('화상')).toEqual({ id: 'Combustion', reason: 'only' })
    expect(plan.chosen.get('공격레벨감소')).toEqual({ id: 'AttackDown', reason: 'only' })
    expect(plan.chosen.get('진동')).toEqual({ id: 'Vibration', reason: 'tag' })
    expect(plan.none).toEqual(['없는 키워드'])
    // the same rows the references sync stores
    const rows = buildGameTextRefs({ ...readGameTextSources(FIXTURES), keywordMetaNames: ['화상', '공격레벨감소', '진동', '없는 키워드'] })
    expect(rows.filter(r => r.keyword_name === '화상').map(r => r.id)).toEqual(['Combustion'])
  })
})

describe('REQ-DATA-SYNC-038 what is stored', () => {
  const plan = selectPrimaryRefs({
    refs: REFS,
    metaNames: ['화상', '가호', '호흡', '참격'],
    tags: new Map([['화상', 'Combustion']]),
  })
  const names = ['화상', '가호', '호흡', '참격']

  it('REQ-DATA-SYNC-038 stores the chosen id when game_text_refs holds it and counts set, ambiguous and none', () => {
    const { ids, report } = resolveKeywordGameIds({ plan, names, stored: new Map(), dbRefIds: new Set(['Combustion', 'Breath', 'Burn']) })
    expect(Object.fromEntries(ids)).toEqual({ 화상: 'Combustion', 가호: null, 호흡: 'Breath', 참격: null })
    expect(report).toEqual({ set: 2, byTag: 1, only: 1, mostUsed: 0, ambiguous: 1, none: 1, refNotInDb: 0, columnMissing: false })
  })

  it('REQ-DATA-SYNC-038 does not write an id the reference table lacks yet (the foreign key would fail), and reports it', () => {
    const { ids, report } = resolveKeywordGameIds({ plan, names, stored: new Map(), dbRefIds: new Set(['Breath']) })
    expect(ids.get('화상')).toBeNull()
    expect(ids.get('호흡')).toBe('Breath')
    expect(report.refNotInDb).toBe(1)
    expect(resolveKeywordGameIds({ plan, names, stored: new Map(), dbRefIds: null }).report.refNotInDb).toBe(2)
  })

  it('REQ-DATA-SYNC-038 keeps a stored id for a name the rules leave undecided', () => {
    const { ids } = resolveKeywordGameIds({ plan, names, stored: new Map([['가호', 'KnightBless'], ['참격', null]]), dbRefIds: new Set() })
    expect(ids.get('가호')).toBe('KnightBless')
    expect(ids.get('참격')).toBeNull()
  })

  it('REQ-DATA-SYNC-038 still reports the plan when the game_id column does not exist yet', () => {
    const { report } = resolveKeywordGameIds({ plan, names, stored: null, dbRefIds: new Set(['Combustion', 'Breath']) })
    expect(report.columnMissing).toBe(true)
    expect(report.set).toBe(2)
  })
})

describe('REQ-DATA-SYNC-038 migration', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261001060026_keyword_meta_game_id.sql'), 'utf8')

  it('REQ-DATA-SYNC-038 adds a nullable game_id that references game_text_refs and drops nothing', () => {
    expect(sql).toMatch(/alter table limbus\.keyword_meta\s+add column if not exists game_id text references limbus\.game_text_refs\s*\(id\) on delete set null/i)
    expect(sql).toMatch(/create index if not exists keyword_meta_game_id_idx on limbus\.keyword_meta \(game_id\)/i)
    expect(sql).not.toMatch(/drop\s+(column|table)|delete from|update limbus/i)
  })
})
