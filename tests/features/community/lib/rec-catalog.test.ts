import { describe, expect, it } from 'vitest'
import { cosine, statusShare, STATUS_KEYWORDS } from '@/features/community/lib/rec-catalog'
import { catalogOf, ego, identity } from './rec-fixtures'

const at = (keyword: string) => STATUS_KEYWORDS.indexOf(keyword as (typeof STATUS_KEYWORDS)[number])

describe('recommender catalog', () => {
  const catalog = catalogOf({
    identities: [
      identity('I1', 'a', { status: ['화상', '진동'], factions: ['거미집', '엄지'], kw: ['속박', '화상'] }),
      identity('I2', 'a', { factions: ['거미집'] }), identity('S0', 'a', { rarity: 1, factions: ['LCB'] }),
    ],
    skills: [
      { identity_id: 'I1', skill_order: 1, sin_affinity: 'wrath', description: '[Combustion] 3 부여 [Combustion] 2 [Combustion] [Vibration]' },
      { identity_id: 'I1', skill_order: 2, sin_affinity: '분노', description: '' },
      { identity_id: 'I1', skill_order: 3, sin_affinity: 'pride', description: '' },
    ],
    passives: [
      { identity_id: 'I1', passive_type: 'battle', passive_order: 1, sin_affinity: 'wrath', sin_count: 2, active_cond: 'resonance', sin_requirements: [{ sin: 'wrath', count: 4 }], description: '[Breath]' },
      { identity_id: 'I1', passive_type: 'battle', passive_order: 2, sin_affinity: 'pride', sin_count: 3, active_cond: 'stock', sin_requirements: null, description: '' },
      { identity_id: 'I1', passive_type: 'support', passive_order: 3, sin_affinity: 'pride', sin_count: 3, active_cond: 'stock', sin_requirements: null, description: '' },
      { identity_id: 'I1', passive_type: 'battle', passive_order: 4, sin_affinity: null, sin_count: null, active_cond: null, sin_requirements: null, description: '' },
    ],
    egos: [ego('E1', 'a', 'HE', { status: ['화상', '속박'], cost: [1, 2] })],
    gifts: [{ game_id: 9001, keyword: '화상', grade: '1' }, { game_id: 9002, keyword: null, grade: '2' }],
    themes: [{ id: 1001, difficulty: 'normal', ego_gift_ids: [9001], specific_ego_gift_ids: [9002, 9001], floor_info: { 노말: [1] } }],
  })

  it('REQ-DECKS-047 weighs a status keyword by how often the kit mentions it (log of tags in skills and passives), at least 1 for its own skill keywords', () => {
    const status = catalog.identities.I1.status
    expect(status[at('화상')]).toBeCloseTo(1 + Math.log(3))
    expect(status[at('호흡')]).toBeCloseTo(1)
    expect(status[at('진동')]).toBeCloseTo(1)
    expect(status[at('출혈')]).toBe(0)
    expect(catalog.identities.I1.kw).toEqual(['속박'])
  })

  it('REQ-DECKS-047 flags the LCB starter, counts skill cards per sin at the 3-2-1 distribution, and keeps battle passives that depend on sins', () => {
    expect(catalog.identities.S0.starter).toBe(true)
    expect(catalog.identities.I1.starter).toBe(false)
    expect(catalog.identities.I1.sins).toEqual({ wrath: 5, pride: 1 })
    expect(catalog.identities.I1.passives).toEqual([
      { cond: 'resonance', req: [{ sin: 'wrath', count: 4 }] },
      { cond: 'stock', req: [{ sin: 'pride', count: 3 }] },
    ])
  })

  it('REQ-DECKS-047 weighs a rarer affiliation more, lists packs with their gifts once, and pads an E.G.O cost to the seven sins', () => {
    expect(catalog.idf.faction['엄지']).toBeGreaterThan(catalog.idf.faction['거미집'])
    expect(catalog.themes['1001'].gifts).toEqual(['9001', '9002'])
    expect(catalog.gifts).toEqual({ 9001: '화상', 9002: '공통' })
    expect(catalog.egos.E1.cost).toEqual([1, 2, 0, 0, 0, 0, 0])
    expect(catalog.egos.E1.status[at('화상')]).toBe(1)
    expect(catalog.egos.E1.kw).toEqual(['속박'])
  })

  it('REQ-DECKS-047 compares kits by cosine of their keyword shares and treats an empty kit as nothing alike', () => {
    const burn = statusShare(catalog.identities.I1.status), none = statusShare(catalog.identities.I2.status)
    expect(cosine(burn, burn)).toBeCloseTo(1)
    expect(cosine(burn, none)).toBe(0)
    expect(statusShare([0, 0, 0])).toEqual([0, 0, 0])
  })
})
