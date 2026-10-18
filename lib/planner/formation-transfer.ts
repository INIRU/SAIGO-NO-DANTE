import type { EgoData, EgoSlot, IdentityData, IdentitySlot } from './types'

/** A saved deck's identity row, as /api/decks/[id] (nested identity) or the deck tables (flat id) return it. */
export interface DeckIdentityRow {
  slot_order: number
  identity_id?: string | null
  identities?: { id: string } | null
  uptie?: number | null
  s1_count?: number | null
  s2_count?: number | null
  s3_count?: number | null
}
export interface DeckEgoRow { grade: string; ego_id?: string | null; ego?: { id: string } | null }

/** A saved deck as the plan's identity and E.G.O slots (formation number, uptie and skill counts kept). Null when no identity resolves. */
export function planSlotsFromDeckRows(rows: DeckIdentityRow[], egoRows: DeckEgoRow[], identities: IdentityData[],
  egos: EgoData[]): { identitySlots: IdentitySlot[]; egoSlots: EgoSlot[] } | null {
  const identityById = new Map(identities.map(identity => [identity.id, identity]))
  const egoById = new Map(egos.map(ego => [ego.id, ego]))
  const identitySlots = rows.flatMap((row): IdentitySlot[] => {
    const identity = identityById.get(row.identity_id ?? row.identities?.id ?? '')
    if (!identity) return []
    const counts = row.s1_count != null && row.s2_count != null && row.s3_count != null
      ? { s1_count: row.s1_count, s2_count: row.s2_count, s3_count: row.s3_count } : {}
    return [{ identity_id: identity.id, sinner_id: identity.sinner_id, name_kr: identity.name_kr, rarity: identity.rarity, keywords: identity.keywords ?? [],
      skill_keyword_list: identity.skill_keyword_list ?? [], affiliation: identity.affiliation, association_list: identity.association_list,
      game_id: identity.game_id, folder_name: identity.folder_name, slot_order: row.slot_order, uptie: row.uptie ?? undefined, ...counts }]
  })
  if (!identitySlots.length) return null
  const egoSlots = egoRows.flatMap((row): EgoSlot[] => {
    const ego = egoById.get(row.ego_id ?? row.ego?.id ?? '')
    return ego ? [{ ego_id: ego.id, sinner_id: ego.sinner_id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity }] : []
  })
  return { identitySlots, egoSlots }
}

export interface DeckFormation {
  deckSlotIds: Record<string, string>
  egoSlotIds: Record<string, Record<string, string>>
  formationOrder: string[]
  upties: Record<string, number>
  skillDistribution: Record<string, [number, number, number]>
}

/** The plan's slots in the deck builder's shapes (sinner id keyed). Skill counts are kept only when they differ from 3/2/1. */
export function deckFormationFromPlan(identitySlots: IdentitySlot[], egoSlots: EgoSlot[]): DeckFormation {
  const formation: DeckFormation = { deckSlotIds: {}, egoSlotIds: {}, formationOrder: [], upties: {}, skillDistribution: {} }
  for (const slot of identitySlots) {
    formation.deckSlotIds[slot.sinner_id] = slot.identity_id
    if (slot.uptie !== undefined) formation.upties[slot.sinner_id] = slot.uptie
    const { s1_count: a, s2_count: b, s3_count: c } = slot
    if (a != null && b != null && c != null && (a !== 3 || b !== 2 || c !== 1)) formation.skillDistribution[slot.sinner_id] = [a, b, c]
  }
  formation.formationOrder = identitySlots.filter(slot => slot.slot_order < 99).sort((a, b) => a.slot_order - b.slot_order).map(slot => slot.sinner_id)
  for (const slot of egoSlots) (formation.egoSlotIds[slot.sinner_id] ??= {})[slot.grade] = slot.ego_id
  return formation
}
