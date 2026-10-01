/** The gift a note label names: note blocks carry the gift id, older note tokens its Korean name. */
export function findNoteGift<T extends { id: string; name: string }>(gifts: readonly T[], key: string): T | undefined {
  return gifts.find(gift => gift.id === key || gift.name === key)
}
