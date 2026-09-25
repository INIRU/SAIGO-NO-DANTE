import { expect, it } from 'vitest'
import { missingFormationCount, withBaseIdentities, type IdentityInfo } from '@/lib/collection'

const identity = (id: string, rarity: number) => ({ id, sinner_id: 's', name_kr: id, game_id: null, folder_name: null, rarity, keywords: null }) as IdentityInfo

it('counts LCB identities as owned and only formed slots as missing', () => {
  const owned = withBaseIdentities(new Set(['w-corp']), { yisang: [identity('lcb-yisang', 1), identity('w-corp', 3), identity('n-corp', 2)] })
  expect([...owned].sort()).toEqual(['lcb-yisang', 'w-corp'])
  const slots = [
    { id: 'lcb-yisang', slot_order: 0 },
    { id: 'w-corp', slot_order: 1 },
    { id: 'n-corp', slot_order: 2 },
    { id: 'n-corp', slot_order: 99 }, // backup: optional, never counted
    { id: null, slot_order: 3 },
  ]
  expect(missingFormationCount(slots, owned)).toBe(1)
  expect(missingFormationCount(slots.slice(0, 2), owned)).toBe(0)
})

