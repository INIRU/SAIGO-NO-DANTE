import { expect, it } from 'vitest'
import { encodeTeamCode } from '@/lib/decks/team-code'
import { planSlotsFromTeamCode } from '@/lib/planner/team-code-import'
import type { EgoData, IdentityData } from '@/lib/planner/types'

const ids = ['yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault', 'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor']
const sinners = ids.map((id, index) => ({ id, name_kr: id, order_num: index + 1 }))
const identity = (sinner: number, local: number): IdentityData => ({ id: 'i-' + sinner + '-' + local, sinner_id: ids[sinner - 1], name_kr: 'identity ' + sinner + '-' + local,
  rarity: 3, keywords: ['화상'], skill_keyword_list: ['화상'], game_id: String(10000 + sinner * 100 + local), folder_name: 'folder' })
const ego = (sinner: number, local: number, grade: string) => ({ id: 'e-' + sinner + '-' + local, sinner_id: ids[sinner - 1], name: 'ego', name_kr: 'E.G.O ' + sinner,
  grade, sin_affinity: 'wrath', image_url: null, cost: null, game_id: String(20000 + sinner * 100 + local) }) as EgoData & { game_id: string }
const identities = ids.flatMap((_, index) => [identity(index + 1, 1), identity(index + 1, 5)])
const egos = ids.flatMap((_, index) => [ego(index + 1, 1, 'ZAYIN'), ego(index + 1, 3, 'TETH')])

it('REQ-PLANNER-017 loads a formation code into the plan: every identity, its formation order and its E.G.O', () => {
  const deckSlots = Object.fromEntries(ids.map((id, index) => [id, identities[index * 2 + (index % 2)]]))
  const egoSlots = { 'yi-sang': { ZAYIN: egos[0], TETH: egos[1] }, faust: { ZAYIN: egos[2] } }
  const formationOrder = ['faust', 'yi-sang', 'outis']
  const code = encodeTeamCode({ sinners, deckSlots, egoSlots, formationOrder })
  const plan = planSlotsFromTeamCode(code, sinners, identities, egos)!
  expect(plan.identitySlots).toHaveLength(12)
  expect(plan.identitySlots.find(slot => slot.sinner_id === 'faust')).toMatchObject({ identity_id: 'i-2-5', slot_order: 0, name_kr: 'identity 2-5', keywords: ['화상'] })
  expect(plan.identitySlots.find(slot => slot.sinner_id === 'yi-sang')?.slot_order).toBe(1)
  expect(plan.identitySlots.find(slot => slot.sinner_id === 'outis')?.slot_order).toBe(2)
  expect(plan.identitySlots.find(slot => slot.sinner_id === 'gregor')?.slot_order).toBe(99)
  expect(plan.egoSlots).toEqual(expect.arrayContaining([
    { ego_id: 'e-1-1', sinner_id: 'yi-sang', name_kr: 'E.G.O 1', grade: 'ZAYIN', sin_affinity: 'wrath' },
    { ego_id: 'e-1-3', sinner_id: 'yi-sang', name_kr: 'E.G.O 1', grade: 'TETH', sin_affinity: 'wrath' },
    { ego_id: 'e-2-1', sinner_id: 'faust', name_kr: 'E.G.O 2', grade: 'ZAYIN', sin_affinity: 'wrath' },
  ]))
  // The code always carries each sinner's ZAYIN (the default E.G.O), as the planner adds on choosing an identity.
  expect(plan.egoSlots.filter(slot => slot.grade === 'ZAYIN')).toHaveLength(12)
  expect(plan.egoSlots.filter(slot => slot.grade !== 'ZAYIN')).toEqual([{ ego_id: 'e-1-3', sinner_id: 'yi-sang', name_kr: 'E.G.O 1', grade: 'TETH', sin_affinity: 'wrath' }])
})

it('REQ-PLANNER-017 rejects anything that is not a formation code', () => {
  for (const code of ['', 'hello', '!!!', 'H4sIAAAAAAAACg==']) expect(planSlotsFromTeamCode(code, sinners, identities, egos)).toBeNull()
})
