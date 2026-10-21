import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
const row = (image_id: string, uptie_level: number) => ({
  id: `s${uptie_level}`, name: '예지', name_en: null, name_jp: null, skill_type: 'evade', atk_type: null, sin_affinity: 'gloom', coins: 1,
  base_power: 3, coin_power: 7, description: `${uptie_level}동기화`, description_en: null, description_jp: null, skill_order: 4, image_id,
  atk_weight: 1, offense_level: null, variant_order: 8, uptie_level, identity: { sinner_id: 'heathcliff', game_id: '10916', keywords: [] },
})
const ROWS = [row('1091608', 1), row('1091608', 3), row('1091608_4', 4)]
// The database as a filter over ROWS: whichever of eq / in the loader uses.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ schema: () => ({ from: () => ({ select: () => ({
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
