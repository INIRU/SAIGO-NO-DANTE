import { describe, expect, it } from 'vitest'
import { encodeRandomResult } from '@/features/tools/lib/random/deck-code'
import { deckLinkFromCode, plannerStateFromCode } from '@/features/tools/lib/random/send'
import { generateRandom } from '@/features/tools/lib/random/engine'
import { rngFromSeed } from '@/features/tools/lib/random/seed'
import { decodeTeamCode } from '@/lib/decks/team-code'
import { BASE_OPTIONS, EGOS, IDENTITIES, SINNERS, sinnerIds } from './fixture'

const roll = (seed: string, deploy: { min: number; max: number } | null) =>
  generateRandom(SINNERS, IDENTITIES, EGOS, { ...BASE_OPTIONS, deploy }, rngFromSeed(seed))
const encode = (result: ReturnType<typeof roll>) => encodeRandomResult(SINNERS, IDENTITIES, EGOS, result)
const decode = (code: string) => decodeTeamCode(code, SINNERS, IDENTITIES, EGOS)!

describe('REQ-TOOLS-016 the formation code carries the random order', () => {
  it('REQ-TOOLS-016 writes exactly the rolled count and order, and nothing for the unnumbered sinners', async () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const result = roll(seed, { min: 1, max: 12 })
      const decoded = decode(await encode(result))
      expect(decoded.formationOrder).toEqual(result.order)
      expect(decoded.formationOrder.length).toBe(result.order!.length)
    }
  })

  it('REQ-TOOLS-016 keeps every identity and E.G.O of the roll, numbered or not', async () => {
    const result = roll('whole', { min: 3, max: 3 })
    const decoded = decode(await encode(result))
    for (const id of sinnerIds()) {
      expect(decoded.deckSlots[id]?.id).toBe(result.identities[id]?.id)
      expect(Object.values(decoded.egoSlots[id] ?? {}).map(ego => ego.id).sort()).toEqual(result.egos[id].map(ego => ego.id).sort())
    }
  })

  it('REQ-TOOLS-005 keeps the old behaviour without a random order: all twelve in sinner order', async () => {
    const result = roll('plain', null)
    expect(result.order).toBeNull()
    expect(decode(await encode(result)).formationOrder).toEqual(sinnerIds())
  })
})

describe('REQ-TOOLS-020 sending the roll on', () => {
  it('REQ-TOOLS-020 turns the code into a planner state with the same numbers and bench for the rest', async () => {
    const result = roll('planner', { min: 4, max: 4 })
    const state = plannerStateFromCode(await encode(result), SINNERS as never, IDENTITIES as never, EGOS as never)!
    expect(state.identitySlots).toHaveLength(12)
    const numbered = state.identitySlots.filter(slot => slot.slot_order < 99).sort((a, b) => a.slot_order - b.slot_order)
    expect(numbered.map(slot => slot.sinner_id)).toEqual(result.order)
    expect(numbered.map(slot => slot.slot_order)).toEqual([0, 1, 2, 3])
    expect(state.identitySlots.filter(slot => slot.slot_order === 99)).toHaveLength(8)
    expect(state.egoSlots.length).toBe(Object.values(result.egos).flat().length)
    expect(state.title).toBe('')
    expect(state.activeTab).toBe('deck')
  })

  it('REQ-TOOLS-020 gives nothing for a code that is not one', () => {
    expect(plannerStateFromCode('nope', SINNERS as never, IDENTITIES as never, EGOS as never)).toBeNull()
  })

  it('REQ-TOOLS-020 opens the deck builder with the code in the formation query', () => {
    expect(deckLinkFromCode('a+b/c=')).toBe('/decks/new?formation=a%2Bb%2Fc%3D')
  })
})
