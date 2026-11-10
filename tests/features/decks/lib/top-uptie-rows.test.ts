import { describe, expect, it } from 'vitest'
import { topUptiePassives, topUptieRows, topUptieSkills } from '@/features/decks'

describe('REQ-DECKS-002 one row per skill or passive, at its highest uptie', () => {
  it('REQ-DECKS-002 skills with the same (skill_order, variant_order) keep the highest uptie_level', () => {
    const rows = [
      { id: 'a3', skill_order: 1, variant_order: null, uptie_level: 3 },
      { id: 'a4', skill_order: 1, variant_order: 0, uptie_level: 4 },
      { id: 'b', skill_order: 1, variant_order: 1, uptie_level: 3 },
      { id: 'c', skill_order: 2, uptie_level: 3 },
    ]
    expect(topUptieSkills(rows).map(r => r.id)).toEqual(['a4', 'b', 'c'])
  })

  it('REQ-DECKS-002 passives with the same (passive_type, passive_order) keep the highest uptie_level', () => {
    const rows = [
      { id: 'p3', passive_type: 'battle', passive_order: 1, uptie_level: 3 },
      { id: 'p4', passive_type: 'battle', passive_order: 1, uptie_level: 4 },
      { id: 's', passive_type: 'support', passive_order: 1, uptie_level: 3 },
    ]
    expect(topUptiePassives(rows).map(r => r.id)).toEqual(['p4', 's'])
  })

  it('REQ-DECKS-002 a row without uptie_level counts as 3 and the first of equal rows stays', () => {
    const rows = [{ id: 'first', k: 'x' }, { id: 'second', k: 'x', uptie_level: 3 }, { id: 'low', k: 'x', uptie_level: 2 }]
    expect(topUptieRows(rows, r => r.k).map(r => r.id)).toEqual(['first'])
  })
})
