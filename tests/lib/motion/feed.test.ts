import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/db/queries', () => ({ getIdentities: async () => [
  { id: 'u1', name_kr: '새벽 해결사', name_en: 'Dawn Fixer', name_jp: null, sinner_id: 'faust', game_id: '10216', folder_name: 'Dawn', rarity: 3, release_date: '2026-01-01' },
] }))
vi.mock('@/lib/db/game-text-refs', () => ({ getGameTextRefNamesOrNull: async () => null }))
const EGOS = [{ game_id: '20211', sinner_id: 'faust', name_kr: '에고', name_en: 'Ego', name_jp: null, grade: 'ZAYIN', sin_affinity: 'gloom', image_url: 'https://img/20211.webp' }]
const SINNERS = [{ id: 'faust', name_kr: '파우스트', name_en: 'Faust', name_jp: 'ファウスト' }]
const row = (image_id: string, uptie_level: number) => ({
  id: `s${uptie_level}`, name: '예지', name_en: null, name_jp: null, skill_type: 'evade', atk_type: null, sin_affinity: 'gloom', coins: 1,
  base_power: 3, coin_power: 7, description: `${uptie_level}동기화`, description_en: null, description_jp: null, skill_order: 4, image_id,
  atk_weight: 1, offense_level: null, variant_order: 8, uptie_level, identity: { sinner_id: 'heathcliff', game_id: '10916', keywords: [] },
})
const ROWS = [row('1091608', 1), row('1091608', 3), row('1091608_4', 4)]
// The database as a filter over ROWS: whichever of eq / in the loader uses.
// (the ego and sinners tables are read to the end of the chain; the skills table is paged by readAllMetaRows)
const table = (name: string) => {
  const rows = name === 'ego' ? EGOS : name === 'sinners' ? SINNERS : []
  const chain: Record<string, unknown> = { not: () => chain, order: () => chain, range: () => chain, then: (done: (v: unknown) => void) => done({ data: rows, error: null }) }
  return chain
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ schema: () => ({ from: (name: string) => ({ select: () => ({
    ...table(name),
    eq: async (column: string, value: string) => ({ data: ROWS.filter(r => r[column as 'image_id'] === value), error: null }),
    in: async (column: string, values: string[]) => ({ data: ROWS.filter(r => values.includes(r[column as 'image_id'])), error: null }),
  }) }) }) }),
}))

describe('REQ-MOTION-005 the skill card of a motion', () => {
  it('REQ-MOTION-005 finds the uptie 4 row, whose image id the database writes with _4', async () => {
    const { loadMotionSkill } = await import('@/lib/motion/feed')
    const skill = await loadMotionSkill(1091608, 'ko')
    expect(skill).toMatchObject({ uptie_level: 4, image_id: '1091608_4', description: '4동기화' })
  })
})

describe('REQ-MOTION-042 the site data of the E.G.O', () => {
  it('REQ-MOTION-042 hands the catalog the site E.G.O by game id (name in the page language, picture, grade, sin), and the identities their rarity', async () => {
    const { loadMotionSiteData } = await import('@/lib/motion/feed')
    const site = await loadMotionSiteData('en')
    expect(site.egos).toEqual([{ game_id: '20211', name: 'Ego', image_url: 'https://img/20211.webp', grade: 'ZAYIN', sinner_id: 'faust', sin_affinity: 'gloom' }])
    expect((await loadMotionSiteData('ja')).egos[0].name).toBe('에고')
    expect(site.identities[0]).toMatchObject({ game_id: '10216', rarity: 3, folder_name: 'Dawn', sinner_name: 'Faust' })
  })
})

describe('REQ-MOTION-015 a skill id another identity borrows', () => {
  const row = (game_id: string, name: string) => ({ name, identity: { game_id } })

  it('REQ-MOTION-015 reads the rows of the identity the id belongs to, whatever the other rows are', async () => {
    const { ownSkillRows } = await import('@/lib/motion/feed')
    const own = row('10113', '대상 조정 사격'), borrowed = row('10412', '쏘아내겠소 / 언제든지')
    expect(ownSkillRows([borrowed, own], 1011303)).toEqual([own])
    // The uptie 4 id and an identity list of one both count.
    expect(ownSkillRows([{ name: 'a', identity: [{ game_id: '10113' }] }, borrowed], 1011303).map(r => r.name)).toEqual(['a'])
    // No row of its own: what there is.
    expect(ownSkillRows([borrowed], 1011303)).toEqual([borrowed])
  })
})

describe('REQ-MOTION-042 the skill card of an E.G.O skill', () => {
  it('REQ-MOTION-042 shapes the highest construe row like an identity skill, in the page language', async () => {
    const { egoSkillRow } = await import('@/lib/motion/feed')
    const row = (construe_level: number) => ({ id: 'x', name: '구멍', name_en: 'Le Trou', name_jp: null, skill_type: 'pierce', sin_affinity: 'pride', coins: 1, base_power: 5, coin_power: 5, description: '설명', description_en: 'Text', description_jp: null, skill_order: 1, atk_weight: 1, offense_level: 60, construe_level, coin_list: [], category: 'awakening', ego: { sinner_id: 'faust', game_id: '20211' } })
    expect(egoSkillRow([row(1), row(4)], 'en')).toMatchObject({ name: 'Le Trou', description: 'Text', atk_type: 'pierce', skill_order: 3, uptie_level: 4, image_id: null, identity: { sinner_id: 'faust', game_id: '20211', keywords: null } })
    expect(egoSkillRow([row(1)], 'ja')).toMatchObject({ name: '구멍', description: '설명' })
    expect(egoSkillRow([], 'ko')).toBeNull()
  })
})
