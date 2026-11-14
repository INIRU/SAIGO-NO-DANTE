import { describe, expect, it } from 'vitest'
import { normalizeUptie } from '@/features/decks/lib/deck-identity-uptie'
import { buildEditMode } from '@/features/decks/lib/edit-mode'

type Row = Parameters<typeof buildEditMode>[0]['deckIdentities'][number]
type EgoRow = Parameters<typeof buildEditMode>[0]['deckEgos'][number]

// The block /decks/[id]/edit and /decks/new?fork= each wrote out before the shared function.
function legacy(deck: { deck_identities: Row[]; deck_egos: EgoRow[] }, identities: { id: string; sinner_id: string }[], egos: { id: string; sinner_id: string }[]) {
  const identitySlotIds: Record<string, string> = {}
  const gacksungSlots: Record<string, boolean> = {}
  const upties: Record<string, number> = {}
  const slotOrders: Record<string, number> = {}
  const skillDistribution: Record<string, [number, number, number]> = {}

  for (const di of deck.deck_identities) {
    const identity = identities.find(i => i.id === di.identity_id)
    if (!identity) continue
    identitySlotIds[identity.sinner_id] = identity.id
    if (di.gacksung) gacksungSlots[identity.sinner_id] = true
    upties[identity.sinner_id] = normalizeUptie(di.uptie)
    slotOrders[identity.sinner_id] = di.slot_order
    const s1 = di.s1_count ?? 3
    const s2 = di.s2_count ?? 2
    const s3 = di.s3_count ?? 1
    if (s1 !== 3 || s2 !== 2 || s3 !== 1) {
      skillDistribution[identity.sinner_id] = [s1, s2, s3]
    }
  }

  const formationOrder = Object.entries(slotOrders)
    .filter(([, order]) => order !== 99)
    .sort(([, a], [, b]) => a - b)
    .map(([sinnerId]) => sinnerId)

  const egoSlotIds: Record<string, Record<string, string>> = {}
  for (const de of deck.deck_egos) {
    const ego = egos.find(e => e.id === de.ego_id)
    if (!ego) continue
    if (!egoSlotIds[ego.sinner_id]) egoSlotIds[ego.sinner_id] = {}
    egoSlotIds[ego.sinner_id][de.grade] = ego.id
  }
  return { identitySlotIds, gacksungSlots, upties, skillDistribution, formationOrder, egoSlotIds }
}

const identities = [
  { id: 'i-a', sinner_id: 's1' }, { id: 'i-b', sinner_id: 's2' }, { id: 'i-c', sinner_id: 's3' }, { id: 'i-d', sinner_id: 's4' },
]
const egos = [
  { id: 'e-a1', sinner_id: 's1' }, { id: 'e-a2', sinner_id: 's1' }, { id: 'e-b1', sinner_id: 's2' },
]

const deckIdentities: Row[] = [
  { identity_id: 'i-c', slot_order: 2, uptie: 3, gacksung: true, s1_count: 2, s2_count: 2, s3_count: 2 },
  { identity_id: 'i-a', slot_order: 0, uptie: 4, gacksung: false, s1_count: 3, s2_count: 2, s3_count: 1 },
  { identity_id: 'i-b', slot_order: 99, uptie: null, gacksung: null, s1_count: null, s2_count: null, s3_count: null },
  { identity_id: 'i-d', slot_order: 1, uptie: 1, s1_count: 3, s2_count: 3, s3_count: 0 },
  { identity_id: 'unknown', slot_order: 3, uptie: 2 },
]
const deckEgos: EgoRow[] = [
  { ego_id: 'e-a1', grade: 'ZAYIN' }, { ego_id: 'e-a2', grade: 'HE' }, { ego_id: 'e-b1', grade: 'TETH' }, { ego_id: 'gone', grade: 'WAW' },
]

describe('buildEditMode', () => {
  it('builds the slots, upties, skill counts, formation order and E.G.O of a deck', () => {
    expect(buildEditMode({ deckIdentities, deckEgos, identities, egos })).toEqual({
      identitySlotIds: { s3: 'i-c', s1: 'i-a', s2: 'i-b', s4: 'i-d' },
      gacksungSlots: { s3: true },
      upties: { s3: 3, s1: 4, s2: 4, s4: 1 },
      // Only a count other than the default 3/2/1 is kept.
      skillDistribution: { s3: [2, 2, 2], s4: [3, 3, 0] },
      // Sorted by slot order; the identity kept out of the formation (slot 99) is left out.
      formationOrder: ['s1', 's4', 's3'],
      egoSlotIds: { s1: { ZAYIN: 'e-a1', HE: 'e-a2' }, s2: { TETH: 'e-b1' } },
    })
  })

  it('is what the edit page and the fork page built, for decks of every shape', () => {
    const shapes: { deck_identities: Row[]; deck_egos: EgoRow[] }[] = [
      { deck_identities: deckIdentities, deck_egos: deckEgos },
      { deck_identities: [], deck_egos: [] },
      { deck_identities: deckIdentities.slice(0, 1), deck_egos: [] },
      { deck_identities: [{ identity_id: 'i-a', slot_order: 99 }], deck_egos: deckEgos.slice(2) },
      // The same sinner twice: the later row wins every map, and its slot order decides the formation.
      { deck_identities: [{ identity_id: 'i-a', slot_order: 5, uptie: 2 }, { identity_id: 'i-a', slot_order: 1, uptie: 3, gacksung: true }], deck_egos: [] },
      { deck_identities: [{ identity_id: 'i-a', slot_order: 1, uptie: 7 as number }, { identity_id: 'i-b', slot_order: 1 }], deck_egos: [] },
    ]
    for (const deck of shapes) {
      expect(buildEditMode({ deckIdentities: deck.deck_identities, deckEgos: deck.deck_egos, identities, egos })).toEqual(legacy(deck, identities, egos))
    }
  })

  it('keeps the formation order stable for equal slot orders', () => {
    const rows: Row[] = [{ identity_id: 'i-b', slot_order: 1 }, { identity_id: 'i-a', slot_order: 1 }]
    expect(buildEditMode({ deckIdentities: rows, deckEgos: [], identities, egos }).formationOrder).toEqual(['s2', 's1'])
  })

  it('treats an uptie that is not 1 to 3 as 4', () => {
    const rows: Row[] = [{ identity_id: 'i-a', slot_order: 0, uptie: 0 }, { identity_id: 'i-b', slot_order: 1, uptie: null }]
    expect(buildEditMode({ deckIdentities: rows, deckEgos: [], identities, egos }).upties).toEqual({ s1: 4, s2: 4 })
  })
})
