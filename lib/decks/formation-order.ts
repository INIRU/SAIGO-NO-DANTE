import { DEPLOYED_SLOT_COUNT } from '@/lib/constants/game'

/**
 * Identity ids that suggestions for `sinnerId`'s slot are asked beside: every identity already chosen on the board for
 * the other sinners (the LCB placeholders are not a choice), those with a formation number first, in that order.
 */
export function suggestionContext(chosen: Record<string, string | undefined>, formationOrder: readonly string[], sinnerId: string, isPlaceholder: (identityId: string) => boolean): string[] {
  const ordered = formationOrder.filter(id => id !== sinnerId)
  const rest = Object.keys(chosen).filter(id => id !== sinnerId && !ordered.includes(id))
  return [...ordered, ...rest].flatMap(id => { const identity = chosen[id]; return identity && !isPlaceholder(identity) ? [identity] : [] })
}

/**
 * The formation order after an identity is picked for a sinner: a sinner without a number gets the next free one while
 * numbers up to the deployed count are left; one that has a number keeps it; going back to the LCB placeholder frees it
 * (the numbers after it move up).
 */
export function orderAfterPick(order: readonly string[], sinnerId: string, toPlaceholder: boolean): string[] {
  if (toPlaceholder) return order.filter(id => id !== sinnerId)
  if (order.includes(sinnerId) || order.length >= DEPLOYED_SLOT_COUNT) return [...order]
  return [...order, sinnerId]
}

/** The order after giving `sinnerId` the 1-based number `number`: the sinner that held it takes the other's old number. */
export function orderWithSwap(order: readonly string[], sinnerId: string, number: number): string[] {
  const from = order.indexOf(sinnerId), to = number - 1
  if (from < 0 || to < 0 || to >= order.length || to === from) return [...order]
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
