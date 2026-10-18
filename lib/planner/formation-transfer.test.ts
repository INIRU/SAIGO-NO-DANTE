import { describe, expect, it } from 'vitest'
import { deckFormationFromPlan, planSlotsFromDeckRows } from './formation-transfer'
import type { EgoData, IdentityData } from './types'

const identity = (id: string, sinner_id: string): IdentityData =>
  ({ id, sinner_id, name_kr: id, rarity: 3, keywords: ['화상'], game_id: id, folder_name: id })
const ego = (id: string, sinner_id: string, grade: string): EgoData =>
  ({ id, sinner_id, name: id, name_kr: id, grade, sin_affinity: '분노', image_url: null, cost: null })
const identities = [identity('i1', 's1'), identity('i2', 's2')]
const egos = [ego('e1', 's1', 'ZAYIN'), ego('e2', 's2', 'HE')]

describe('planSlotsFromDeckRows', () => {
  it('maps deck rows (flat or nested identity) to plan slots with formation, uptie and skills', () => {
    const result = planSlotsFromDeckRows(
      [{ identity_id: 'i1', slot_order: 0, uptie: 3, s1_count: 2, s2_count: 2, s3_count: 2 }, { identities: { id: 'i2' }, slot_order: 99, uptie: null }],
      [{ grade: 'ZAYIN', ego_id: 'e1' }, { grade: 'HE', ego: { id: 'e2' } }, { grade: 'WAW', ego_id: 'missing' }],
      identities, egos,
    )
    expect(result!.identitySlots.map(s => [s.identity_id, s.sinner_id, s.slot_order, s.uptie, s.s1_count])).toEqual([['i1', 's1', 0, 3, 2], ['i2', 's2', 99, undefined, undefined]])
    expect(result!.egoSlots.map(s => [s.ego_id, s.sinner_id, s.grade])).toEqual([['e1', 's1', 'ZAYIN'], ['e2', 's2', 'HE']])
  })
  it('is null when no identity resolves', () => {
    expect(planSlotsFromDeckRows([{ identity_id: 'x', slot_order: 0 }], [], identities, egos)).toBeNull()
  })
})

describe('deckFormationFromPlan', () => {
  it('maps plan slots to the deck builder shapes', () => {
    const base = { name_kr: '', rarity: 3, keywords: [], game_id: null, folder_name: null }
    const formation = deckFormationFromPlan(
      [{ ...base, identity_id: 'i2', sinner_id: 's2', slot_order: 1, uptie: 3 }, { ...base, identity_id: 'i1', sinner_id: 's1', slot_order: 0, s1_count: 2, s2_count: 2, s3_count: 2 }, { ...base, identity_id: 'i3', sinner_id: 's3', slot_order: 99, s1_count: 3, s2_count: 2, s3_count: 1 }],
      [{ ego_id: 'e1', sinner_id: 's1', name_kr: '', grade: 'ZAYIN' }],
    )
    expect(formation.deckSlotIds).toEqual({ s1: 'i1', s2: 'i2', s3: 'i3' })
    expect(formation.formationOrder).toEqual(['s1', 's2'])
    expect(formation.upties).toEqual({ s2: 3 })
    expect(formation.skillDistribution).toEqual({ s1: [2, 2, 2] })
    expect(formation.egoSlotIds).toEqual({ s1: { ZAYIN: 'e1' } })
  })
})
