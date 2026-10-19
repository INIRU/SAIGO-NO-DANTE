import { createInitialState, type EgoData, type IdentityData, type PlannerState } from '@/lib/planner/types'
import { planSlotsFromTeamCode } from '@/lib/planner/team-code-import'

/**
 * A formation code as a fresh planner state (identities with their formation numbers, bench = 99, and E.G.O) for the
 * planner's hand-off storage. Null when the code is not a formation code.
 */
export function plannerStateFromCode(code: string, sinners: { id: string; order_num: number }[], identities: IdentityData[],
  egos: (EgoData & { game_id?: string | null })[]): PlannerState | null {
  const slots = planSlotsFromTeamCode(code, sinners, identities, egos)
  return slots ? { ...createInitialState('hard'), identitySlots: slots.identitySlots, egoSlots: slots.egoSlots } : null
}

/** The deck builder opened with the code (it starts from the formation named in `formation`). */
export const deckLinkFromCode = (code: string) => `/decks/new?formation=${encodeURIComponent(code)}`
