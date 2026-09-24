/**
 * Formation members of a saved plan deck, counted like the deck board: slots with an identity and a formation order
 * (slot_order below 99; a missing order counts as 99, unformed).
 */
export function planFormationCount(deck: unknown): number {
  if (!Array.isArray(deck)) return 0
  return deck.filter(slot => {
    if (!slot || typeof slot !== 'object') return false
    const { identity_id: identityId, slot_order: slotOrder } = slot as { identity_id?: unknown; slot_order?: unknown }
    return typeof identityId === 'string' && identityId !== '' && typeof slotOrder === 'number' && slotOrder < 99
  }).length
}

