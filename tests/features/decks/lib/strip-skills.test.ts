import { describe, expect, it } from 'vitest'
import { buildStripSkills, toEgoSlotItems } from '@/features/decks/lib/strip-skills'

const row = (id: string, skill_order: number, extra: Record<string, unknown> = {}) => ({ id, skill_order, skill_type: 'attack', uptie_level: 4, sin_affinity: 'wrath', atk_type: 'slash', ...extra })

describe('buildStripSkills', () => {
  const identity = { sinner_id: 'yi-sang', game_id: '10101' }

  it('lists skills 1-3 with the deck counts and skips defense', () => {
    const skills = buildStripSkills(identity, [row('a', 1), row('b', 2, { atk_type: 'pierce' }), row('c', 3), row('d', 4, { skill_type: 'defense' })], [1, 2, 3])
    expect(skills.map(skill => skill?.count)).toEqual([1, 2, 3])
    expect(skills[1]?.attackType).toBe('pierce')
    expect(skills[0]?.iconUrl).toContain('10101')
  })

  it('keeps the highest uptie row and falls back to 3/2/1 counts; a missing skill is null', () => {
    const skills = buildStripSkills(identity, [row('a', 1, { uptie_level: 1, atk_type: 'blunt' }), row('a4', 1), row('b', 2)], [])
    expect(skills.map(skill => skill?.count ?? null)).toEqual([3, 2, null])
    expect(skills[0]?.attackType).toBe('slash')
  })
})

describe('toEgoSlotItems', () => {
  it('localizes the name and drops empty grades', () => {
    const items = toEgoSlotItems({ ZAYIN: { id: '1', name_kr: '가', name_en: 'A', sin_affinity: 'wrath' }, TETH: undefined }, 'en')
    expect(items).toEqual({ ZAYIN: { id: '1', name: 'A', sin_affinity: 'wrath', image_url: undefined } })
  })
})
