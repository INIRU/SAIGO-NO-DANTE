import type { Sinner, Identity, EGO } from '@/lib/types'
import { encodeDeckCode } from '@/components/deck-builder/deckCodeUtils'
import type { RandomResult } from './engine'

/**
 * Convert random result into a deck code string.
 * Maps random EGO into its correct grade slot and carries the rolled formation order (count and numbers) as it is.
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
  for (const [sinnerId, egoArr] of Object.entries(result.egos)) {
    if (!egoArr?.length) continue
    const gradeMap: Record<string, EGO> = {}
    for (const ego of egoArr) {
      gradeMap[ego.grade] = ego
    }
    egoSlots[sinnerId] = gradeMap
  }

  // A rolled order is the formation as it is (N numbered sinners); without one, all twelve go in sinner order.
  const formationOrder = result.order ?? sinners
    .filter(s => deckSlots[s.id])
    .sort((a, b) => a.order_num - b.order_num)
    .map(s => s.id)

  return encodeDeckCode(sinners, allIdentities, allEgos, deckSlots, egoSlots, formationOrder)
}
