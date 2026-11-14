import { LCB_IDS, SINNER_SLUGS } from '@/lib/constants/game'
import { isAwakenedUptie } from '@/lib/decks/deck-identity-uptie'

export type ThumbnailSlot = {
  sinnerId: string
  folderName: string
  gameId: string
  /** 0-based formation order, null when the sinner is not in the formation. */
  order: number | null
  /** Awakened art, derived from uptie (missing = IV). */
  gacksung: boolean
  /** LCB identity filled in for a sinner the post left empty. */
  placeholder: boolean
}

type SlotInput = { sinner_id?: string | null; folder_name?: string | null; game_id?: string | null; slot_order?: number | null; uptie?: number | null }

/** Always 12 portraits: formation order first, then the rest in sinner order, empty sinners shown as their LCB identity. */
export function formationThumbnail(slots: readonly (SlotInput | null | undefined)[]): ThumbnailSlot[] {
  const bySinner = new Map<string, SlotInput>()
  for (const slot of slots) {
    if (slot?.sinner_id && slot.game_id && slot.folder_name && !bySinner.has(slot.sinner_id)) bySinner.set(slot.sinner_id, slot)
  }
  return SINNER_SLUGS.map(sinnerId => {
    const slot = bySinner.get(sinnerId)
    if (!slot) return { sinnerId, folderName: 'LCB Sinner', gameId: LCB_IDS[sinnerId], order: null, gacksung: false, placeholder: true }
    const order = (slot.slot_order ?? 99) < 99 ? slot.slot_order! : null
    return { sinnerId, folderName: slot.folder_name!, gameId: slot.game_id!, order, gacksung: isAwakenedUptie(slot.uptie), placeholder: false }
  }).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}
