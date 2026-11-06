import { loadTempSlots, saveTempSlot, type TempSlot } from '@/lib/drafts/temp-slots'

/** Deck builder temporary saves: five slots in this browser. */
export const DECK_DRAFTS_KEY = 'limbus-deck-drafts'
const LEGACY_DECK_DRAFT_KEY = 'limbus-deck-draft'

export interface DeckDraft {
  title: string
  contentType: string
  description: string
  deckSlotIds: Record<string, string>
  egoSlotIds: Record<string, Record<string, string>>
  formationOrder: string[]
  mainKeywords: string[]
  mainKeywordsManual: boolean
  savedAt: number
  gacksungSlots?: Record<string, boolean>
  upties?: Record<string, number>
  skillDistribution?: Record<string, [number, number, number]>
}

export const isDeckDraft = (value: unknown): value is DeckDraft =>
  !!value && typeof value === 'object' && typeof (value as DeckDraft).deckSlotIds === 'object' && (value as DeckDraft).deckSlotIds !== null

/** The slots, after moving the old single draft into the first empty slot once. */
export function loadDeckDraftSlots(): TempSlot<DeckDraft>[] {
  const slots = loadTempSlots(DECK_DRAFTS_KEY, isDeckDraft)
  try {
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_DECK_DRAFT_KEY) ?? 'null')
    const free = slots.find(slot => !slot.draft)
    if (isDeckDraft(legacy) && free) {
      const moved = saveTempSlot(DECK_DRAFTS_KEY, free.slotNumber, legacy, legacy.title?.trim() || 'Draft', isDeckDraft)
      if (moved) { localStorage.removeItem(LEGACY_DECK_DRAFT_KEY); return moved }
    }
  } catch { /* the old draft stays where it was */ }
  return slots
}
