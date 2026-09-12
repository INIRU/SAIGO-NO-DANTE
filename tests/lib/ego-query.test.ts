import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ ego: {} as Record<string, unknown>, skills: [] as Record<string, unknown>[], error: null as { message: string } | null }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ schema: () => ({ from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: state.ego, error: null }),
      order: async () => ({ data: table === 'ego_skills' ? state.skills : [], error: state.error }),
    }
    return query
  } }) }),
}))
import { getEGOById } from '@/lib/db/queries'

beforeEach(() => { state.ego = { id: 'e', ego_skills: [{ name: 'obsolete' }], ego_cor_skills: [{ name: 'obsolete' }] }; state.skills = []; state.error = null })

describe('normalized EGO skill query', () => {
  it('does not revive stale JSONB values when the normalized relation is empty', async () => {
    const result = await getEGOById('e')
    expect(result?.ego_skills).toEqual([])
    expect(result?.ego_cor_skills).toEqual([])
  })
  it('maps awakening and corrosion independently with translated coin effects', async () => {
    state.skills = [{ name: 'skill', category: 'awakening', description: '효과\n[코인 1] 첫 효과', description_en: 'Effect\n[Coin 1] First', base_power: 12, coins: 1 }]
    const result = await getEGOById('e')
    expect(result?.ego_skills?.[0]).toMatchObject({ name: 'skill', skillPower: 12, normalEffect: '효과', coin1Effect: '첫 효과', coin1Effect_en: 'First' })
    expect(result?.ego_cor_skills).toEqual([])
  })
  it('reports relational lookup failure instead of silently rendering missing skills', async () => {
    state.error = { message: 'relation failed' }
    await expect(getEGOById('e')).rejects.toEqual(state.error)
  })
  it('preserves stage V, source identity, sanity cost and Japanese coin boundaries', async () => {
    state.skills = [{ name: 'Fifth', category: 'awakening', game_skill_id: 2020511, construe_level: 5, mental_consume: 25, description_jp: '効果\n[コイン 1] 最初\n続き\n[コイン 2] 次' }]
    const skill = (await getEGOById('e'))?.ego_skills?.[0]
    expect(skill).toMatchObject({ gameSkillId: 2020511, construeLevel: 5, mentalConsume: 25, normalEffect_jp: '効果', coin1Effect_jp: '最初\n続き', coin2Effect_jp: '次' })
  })
})
