import type { Sinner, Identity, EGO } from '@/lib/types'
import { encodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import type { RandomResult } from './engine'

/**
 * Convert random result into a deck code string.
 * Maps random EGO into its correct grade slot.
 */
export async function encodeRandomResult(
  sinners: Sinner[],
  allIdentities: Identity[],
  allEgos: EGO[],
  result: RandomResult,
): Promise<string> {
  const deckSlots: Record<string, Identity | undefined> = {}
  for (const [sinnerId, identity] of Object.entries(result.identities)) {
    deckSlots[sinnerId] = identity ?? undefined
  }

  const egoSlots: Record<string, Record<string, EGO>> = {}
  for (const [sinnerId, ego] of Object.entries(result.egos)) {
    if (!ego) continue
    egoSlots[sinnerId] = { [ego.grade]: ego }
  }

  const formationOrder = sinners
    .filter(s => deckSlots[s.id])
    .sort((a, b) => a.order_num - b.order_num)
    .map(s => s.id)

  return encodeDeckCode(sinners, allIdentities, allEgos, deckSlots, egoSlots, formationOrder)
}
