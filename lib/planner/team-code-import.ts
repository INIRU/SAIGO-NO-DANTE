import { decodeTeamCode } from '@/lib/decks/team-code'
import type { EgoData, EgoSlot, IdentityData, IdentitySlot } from './types'

/**
 * A formation code (the deck builder's and the planner's "편성 코드") as the plan's identity and E.G.O slots: every
 * identity it names, its formation number (99 = bench), and its E.G.O. Null for anything that is not a valid code.
 */
export function planSlotsFromTeamCode(code: string, sinners: { id: string; order_num: number }[], identities: IdentityData[],
  egos: (EgoData & { game_id?: string | null })[]): { identitySlots: IdentitySlot[]; egoSlots: EgoSlot[] } | null {
  let decoded
  try { decoded = decodeTeamCode(code.trim(), sinners, identities, egos) } catch { return null }
  if (!decoded) return null
  const identitySlots = sinners.flatMap((sinner): IdentitySlot[] => {
    const identity = decoded.deckSlots[sinner.id]
    if (!identity) return []
    const order = decoded.formationOrder.indexOf(sinner.id)
    return [{ identity_id: identity.id, sinner_id: sinner.id, name_kr: identity.name_kr, rarity: identity.rarity, keywords: identity.keywords ?? [],
      skill_keyword_list: identity.skill_keyword_list ?? [], game_id: identity.game_id, folder_name: identity.folder_name, slot_order: order >= 0 ? order : 99 }]
  })
  const egoSlots = Object.entries(decoded.egoSlots).flatMap(([sinnerId, grades]) => Object.values(grades).map((ego): EgoSlot =>
    ({ ego_id: ego.id, sinner_id: sinnerId, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity })))
  return identitySlots.length ? { identitySlots, egoSlots } : null
}
