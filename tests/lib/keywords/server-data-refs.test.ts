import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))

type Result = { data: unknown[] | null; error: { code?: string; message: string } | null }
const db = vi.hoisted(() => ({
  /** Rows per table; keyword_meta rows carry game_id, which a select without that column drops. */
  tables: {} as Record<string, Record<string, unknown>[]>,
  /** Selects of keyword_meta that fail like a missing column. */
  missingColumns: [] as string[],
  refsError: null as { code?: string; message: string } | null,
  selects: [] as { table: string; columns: string }[],
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        let columns = ''
        const chain: Record<string, unknown> = {}
        chain.select = (cols: string) => { columns = cols; db.selects.push({ table, columns: cols }); return chain }
        chain.eq = () => chain
        chain.order = () => chain
        chain.range = async (from: number): Promise<Result> => {
          const missing = db.missingColumns.find(column => columns.includes(column))
          if (table === 'keyword_meta' && missing) return { data: null, error: { code: '42703', message: `column keyword_meta.${missing} does not exist` } }
          if (table === 'game_text_refs' && db.refsError) return { data: null, error: db.refsError }
          if (from > 0) return { data: [], error: null }
          const rows = db.tables[table] ?? []
          return { data: table === 'keyword_meta' && !columns.includes('game_id') ? rows.map(({ game_id: _, ...rest }) => rest) : rows, error: null }
        }
        return chain
      },
    }),
  }),
}))

import { getKeywordCatalog, getKeywordData, keywordDescriptions } from '@/lib/keywords/server-data'

const META = [
  { name: '화상', description: '옛 설명', max_stack: null, icon_slug: 'burn', effect_type: 'negative', name_en: 'old Burn', name_jp: '旧', description_en: 'old en', description_jp: '旧説明', game_id: 'Combustion' },
  { name: '호흡', description: '크리티컬 확률 증가', max_stack: 20, icon_slug: 'poise', effect_type: 'positive', name_en: 'Poise', name_jp: '呼吸', description_en: 'Poise en', description_jp: null, game_id: null },
  { name: '원호 공격', description: '손으로 쓴 설명', max_stack: null, icon_slug: null, effect_type: null, name_en: null, name_jp: null, description_en: null, description_jp: null, game_id: 'CoverAttack' },
]
const REFS = [
  { id: 'Combustion', name: '화상', name_en: 'Burn', name_jp: '火傷', description: '턴 종료 시 피해', description_en: 'At turn end, take damage', description_jp: 'ターン終了時にダメージ' },
  { id: 'CoverAttack', name: '원호 공격', name_en: 'Cover Attack', name_jp: '援護攻撃', description: '게임 설명', description_en: 'Game text', description_jp: null },
]

beforeEach(() => {
  db.tables = { keyword_meta: META, game_text_refs: REFS }
  db.missingColumns = []
  db.refsError = null
  db.selects = []
})

describe('REQ-KEYWORDS-004 the keyword catalogue reads names and descriptions from the references', () => {
  it('REQ-KEYWORDS-004 takes the localized names and descriptions of a row with a game_id from game_text_refs, keyed by the Korean name', async () => {
    const data = await getKeywordData()
    expect(data['화상']).toMatchObject({
      desc: '턴 종료 시 피해', nameEn: 'Burn', nameJp: '火傷', descEn: 'At turn end, take damage', descJp: 'ターン終了時にダメージ',
      iconSlug: 'burn', effectType: 'negative',
    })
    expect(Object.keys(data)).toEqual(['화상', '호흡', '원호 공격'])
  })

  it('REQ-KEYWORDS-004 keeps the keyword_meta texts for a row without a game_id', async () => {
    const data = await getKeywordData()
    expect(data['호흡']).toMatchObject({ desc: '크리티컬 확률 증가', nameEn: 'Poise', nameJp: '呼吸', descEn: 'Poise en', descJp: null, maxStack: 20 })
  })

  it('REQ-KEYWORDS-004 keeps the hand-written Korean description of 원호 공격 and takes the other languages from the reference', async () => {
    const data = await getKeywordData()
    expect(data['원호 공격']).toMatchObject({ desc: '손으로 쓴 설명', nameEn: 'Cover Attack', descEn: 'Game text', descJp: null })
  })

  it('REQ-KEYWORDS-004 serves tooltip descriptions per language from the references', async () => {
    const data = await getKeywordData()
    expect(keywordDescriptions(data, 'en')['화상']).toBe('At turn end, take damage')
    expect(keywordDescriptions(data, 'ja')['화상']).toBe('ターン終了時にダメージ')
    expect(keywordDescriptions(data, 'ko')['화상']).toBe('턴 종료 시 피해')
  })

  it('REQ-KEYWORDS-004 leaves descriptions out of the layout catalogue but keeps the reference names', async () => {
    const catalog = await getKeywordCatalog()
    expect(catalog['화상']).toMatchObject({ desc: '', descEn: null, descJp: null, nameEn: 'Burn', nameJp: '火傷' })
  })

  it('REQ-KEYWORDS-004 reads only keyword references, and none when no row has a game_id', async () => {
    db.tables.keyword_meta = META.map(row => ({ ...row, game_id: null }))
    const data = await getKeywordData()
    expect(db.selects.some(select => select.table === 'game_text_refs')).toBe(false)
    expect(data['화상']).toMatchObject({ nameEn: 'old Burn', desc: '옛 설명' })
  })

  it('REQ-KEYWORDS-004 still works before the migration: without the game_id column the keyword_meta texts are used', async () => {
    db.missingColumns = ['game_id']
    const data = await getKeywordData()
    expect(data['화상']).toMatchObject({ nameEn: 'old Burn', desc: '옛 설명', effectType: 'negative' })
    expect(db.selects.some(select => select.table === 'game_text_refs')).toBe(false)
  })

  it('REQ-KEYWORDS-004 falls back to the keyword_meta texts, and does not throw, when the reference table cannot be read', async () => {
    db.refsError = { code: 'PGRST205', message: 'Could not find the table limbus.game_text_refs' }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const data = await getKeywordData()
    expect(data['화상']).toMatchObject({ nameEn: 'old Burn', desc: '옛 설명' })
    error.mockRestore()
  })
})
