import { LCB_IDS } from '@/lib/constants/game'
import type { IdentityData, IdentitySlot } from '@/lib/planner/types'

/** Fills every sinner without a slot with their LCB identity, outside the formation (slot_order 99). */
export function withLcbIdentitySlots(identities: readonly IdentityData[], existing: readonly IdentitySlot[] = []): IdentitySlot[] {
  const taken = new Set(existing.map(slot => slot.sinner_id))
  const filled = Object.entries(LCB_IDS).flatMap(([sinnerId, gameId]) => {
    if (taken.has(sinnerId)) return []
    const identity = identities.find(entry => entry.sinner_id === sinnerId && entry.game_id === gameId)
    return identity ? [{
      identity_id: identity.id,
      sinner_id: identity.sinner_id,
      name_kr: identity.name_kr,
      rarity: identity.rarity,
      keywords: identity.keywords ?? [],
      skill_keyword_list: identity.skill_keyword_list,
      affiliation: identity.affiliation,
      association_list: identity.association_list,
      game_id: identity.game_id,
      folder_name: identity.folder_name,
      slot_order: 99,
    }] : []
  })
  return [...existing, ...filled]
}
