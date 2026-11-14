import { decodeTeamCode, type TeamCodeEgo, type TeamCodeIdentity, type TeamCodeSinner } from '@/lib/decks/team-code'

type DeckFormationInit = {
  identitySlotIds: Record<string, string>
  egoSlotIds: Record<string, Record<string, string>>
  /** Sinner ids by formation number; only the numbered ones. */
  formationOrder: string[]
}

/** The deck builder's starting slots out of a formation code; null when it is not a readable code. */
export function deckInitFromTeamCode(code: string, sinners: TeamCodeSinner[], identities: (TeamCodeIdentity & { id: string })[],
  egos: (TeamCodeEgo & { id: string })[]): DeckFormationInit | null {
  const decoded = decodeTeamCode(code.trim(), sinners, identities, egos)
  if (!decoded) return null
  const identitySlotIds: Record<string, string> = {}
  for (const [sinnerId, identity] of Object.entries(decoded.deckSlots)) if (identity) identitySlotIds[sinnerId] = identity.id
  const egoSlotIds: Record<string, Record<string, string>> = {}
  for (const [sinnerId, grades] of Object.entries(decoded.egoSlots)) {
    egoSlotIds[sinnerId] = Object.fromEntries(Object.entries(grades).map(([grade, ego]) => [grade, ego.id]))
  }
  return { identitySlotIds, egoSlotIds, formationOrder: decoded.formationOrder }
}

/** The `formation` value of a query string (a raw "+" in a pasted link arrives as a space, which a code never has). */
export function formationParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get('formation')?.replace(/ /g, '+')
  return value || null
}
