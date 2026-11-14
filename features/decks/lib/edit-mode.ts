import { normalizeUptie } from '@/lib/decks/deck-identity-uptie'

type DeckIdentityRow = {
  identity_id: string
  slot_order: number | null
  uptie?: number | null
  gacksung?: boolean | null
  s1_count?: number | null
  s2_count?: number | null
  s3_count?: number | null
}
type DeckEgoRow = { ego_id: string; grade: string }

/**
 * What the deck builder opens with for a stored deck: the edit page (a deck being edited) and the fork page (a copy of
 * another deck) both build it from the deck's rows. Rows of identities or E.G.O the game data no longer has are skipped.
 * A sinner holds one slot, so a second row of the same sinner overwrites the first.
 */
export function buildEditMode({ deckIdentities, deckEgos, identities, egos }: {
  deckIdentities: readonly DeckIdentityRow[]
  deckEgos: readonly DeckEgoRow[]
  identities: readonly { id: string; sinner_id: string }[]
  egos: readonly { id: string; sinner_id: string }[]
}) {
  const identitySlotIds: Record<string, string> = {}
  const gacksungSlots: Record<string, boolean> = {}
  const upties: Record<string, number> = {}
  const slotOrders: Record<string, number> = {}
  const skillDistribution: Record<string, [number, number, number]> = {}

  for (const di of deckIdentities) {
    const identity = identities.find(i => i.id === di.identity_id)
    if (!identity) continue
    identitySlotIds[identity.sinner_id] = identity.id
    if (di.gacksung) gacksungSlots[identity.sinner_id] = true
    upties[identity.sinner_id] = normalizeUptie(di.uptie)
    slotOrders[identity.sinner_id] = di.slot_order!
    const s1 = di.s1_count ?? 3
    const s2 = di.s2_count ?? 2
    const s3 = di.s3_count ?? 1
    if (s1 !== 3 || s2 !== 2 || s3 !== 1) {
      skillDistribution[identity.sinner_id] = [s1, s2, s3]
    }
  }

  // formationOrder: only the slots that are not 99 (kept out of the formation), in slot order
  const formationOrder = Object.entries(slotOrders)
    .filter(([, order]) => order !== 99)
    .sort(([, a], [, b]) => a - b)
    .map(([sinnerId]) => sinnerId)

  // egoSlotIds: sinnerId → grade → egoId
  const egoSlotIds: Record<string, Record<string, string>> = {}
  for (const de of deckEgos) {
    const ego = egos.find(e => e.id === de.ego_id)
    if (!ego) continue
    if (!egoSlotIds[ego.sinner_id]) egoSlotIds[ego.sinner_id] = {}
    egoSlotIds[ego.sinner_id][de.grade] = ego.id
  }

  return { identitySlotIds, gacksungSlots, upties, skillDistribution, formationOrder, egoSlotIds }
}
