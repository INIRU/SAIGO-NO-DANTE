import { expect, it } from 'vitest'
import { resolvePlannerIdentity, resolvePlannerEgo } from '@/lib/planner/catalog-references'
import { selectUptieRows } from '@/lib/identity/skill-model'
it('recovers old planner references uniquely without mutating saved slots', () => {
  const slot = { identity_id: 'old', game_id: '10611', sinner_id: 'hong-lu' }
  const identity = { id: 'restored', game_id: '10611', sinner_id: 'hong-lu' }
  expect(resolvePlannerIdentity(slot, [identity])?.id).toBe('restored')
  expect(resolvePlannerIdentity(slot, [identity, { ...identity, id: 'ambiguous' }])).toBeUndefined()
  expect(resolvePlannerIdentity({ ...slot, sinner_id: 'faust' }, [identity])).toBeUndefined()
  expect(slot.identity_id).toBe('old')
  const ego = { id: 'current-ego', sinner_id: 'hong-lu', grade: 'ZAYIN', name_kr: '허환경' }
  expect(resolvePlannerEgo({ ...ego, ego_id: 'old-ego' }, [ego])).toBe(ego)
  expect(selectUptieRows([{ identity_id: identity.id, uptie_level: 3, name: '원문' }], 4)[0].name).toBe('원문')
})
