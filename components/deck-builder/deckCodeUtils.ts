import type { Sinner, Identity, EGO } from '@/lib/data/sinners'
import { decodeTeamCode, encodeTeamCode } from '@/lib/decks/team-code'

export async function decodeDeckCode(
  code: string,
  sinners: Sinner[],
  identities: Identity[],
  egos: EGO[],
): Promise<{ deckSlots: Record<string, Identity | undefined>; egoSlots: Record<string, Record<string, EGO>>; formationOrder: string[] } | null> {
  return decodeTeamCode(code, sinners, identities, egos)
}

export async function encodeDeckCode(
  sinners: Sinner[],
  _identities: Identity[],
  _egos: EGO[],
  deckSlots: Record<string, Identity | undefined>,
  egoSlots: Record<string, Record<string, EGO>>,
  formationOrder: string[],
): Promise<string> {
  return encodeTeamCode({ sinners, deckSlots, egoSlots, formationOrder })
}
