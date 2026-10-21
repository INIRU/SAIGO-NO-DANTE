/** One suggested identity (or E.G.O) as `/api/discovery/suggest` sends it; everything after `score` may be missing. */
export type SuggestionPartner = { id: string; score: number; /** Already chosen on the board. */ chosen: boolean }
export type Suggestion = { id: string; score?: number; reasons?: string[]; partners?: SuggestionPartner[] }
/** What the chosen identities add up to: the keywords and factions most of them share. */
export type Archetype = { keywords: string[]; factions: string[] }
export type SuggestionResponse = { items: Suggestion[]; archetype?: Archetype }

export type ReasonPart = { kind: 'keyword' | 'faction' | 'sin'; value: string }

const REASON = /^(keyword|faction|sin):(.+)$/

/** The readable parts of reason codes `keyword:<name>`, `faction:<name>`, `sin:<type>`; codes in another shape are dropped. At most `limit`. */
export function reasonParts(codes: readonly string[] | undefined, limit = 2): ReasonPart[] {
  return (codes ?? []).flatMap(code => {
    const match = REASON.exec(code.trim())
    return match ? [{ kind: match[1] as ReasonPart['kind'], value: match[2].trim() }] : []
  }).slice(0, limit)
}

/** The identity suggestions for one sinner's slot; an empty board still asks (the meta and new identities lead then). */
export function identitySuggestUrl(sinnerId: string | null, context: readonly string[]): string | null {
  if (!sinnerId) return null
  return `/api/discovery/suggest?type=identity&sinner=${sinnerId}${context.length ? `&with=${context.join(',')}` : ''}`
}

/** `suggestionContext` from a plan's identity slots: the numbered slots (formation order) first, unnumbered ones (99) after. */
export function plannerSuggestionContext(slots: readonly { sinner_id: string; identity_id: string; slot_order: number }[], sinnerId: string, isPlaceholder: (identityId: string) => boolean): string[] {
  const order = slots.filter(slot => slot.slot_order < 99).sort((a, b) => a.slot_order - b.slot_order).map(slot => slot.sinner_id)
  return suggestionContext(Object.fromEntries(slots.map(slot => [slot.sinner_id, slot.identity_id])), order, sinnerId, isPlaceholder)
}

/** Identity ids that suggestions for `sinnerId`'s slot are asked beside: every identity chosen on the board for the other sinners (placeholders are not a choice), those with a formation number first. */
export function suggestionContext(chosen: Record<string, string | undefined>, formationOrder: readonly string[], sinnerId: string, isPlaceholder: (identityId: string) => boolean): string[] {
  const ordered = formationOrder.filter(id => id !== sinnerId)
  const rest = Object.keys(chosen).filter(id => id !== sinnerId && !ordered.includes(id))
  return [...ordered, ...rest].flatMap(id => { const identity = chosen[id]; return identity && !isPlaceholder(identity) ? [identity] : [] })
}
