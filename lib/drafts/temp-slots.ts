/**
 * Numbered temporary save slots kept in this browser's localStorage (cookies hold about 4 KB, less than one plan).
 * Planner, deck builder and Assist each keep their own key; the stored shape stays compatible with the planner's older
 * three-slot storage, which simply gains two empty slots.
 */
export const TEMP_SLOT_COUNT = 5

interface TempDraft<T> { id: string; label: string; savedAt: string; state: T }
export interface TempSlot<T> { slotNumber: number; draft: TempDraft<T> | null }

const isDraft = <T,>(value: unknown, isState: (state: unknown) => state is T): value is TempDraft<T> => {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<TempDraft<unknown>>
  return typeof draft.id === 'string' && typeof draft.label === 'string' && typeof draft.savedAt === 'string' && isState(draft.state)
}

export function parseTempSlots<T>(raw: string | null, isState: (state: unknown) => state is T): TempSlot<T>[] {
  let source: unknown[] = []
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    source = Array.isArray(parsed) ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { slots?: unknown }).slots) ? (parsed as { slots: unknown[] }).slots : []
  } catch { /* unreadable storage reads as empty slots */ }
  return Array.from({ length: TEMP_SLOT_COUNT }, (_, index) => {
    const draft = source[index]
    return { slotNumber: index + 1, draft: isDraft(draft, isState) ? draft : null }
  })
}

export function loadTempSlots<T>(key: string, isState: (state: unknown) => state is T): TempSlot<T>[] {
  try { return parseTempSlots(localStorage.getItem(key), isState) } catch { return parseTempSlots(null, isState) }
}

function persist<T>(key: string, slots: TempSlot<T>[]): void {
  localStorage.setItem(key, JSON.stringify({ version: 1, slots: slots.map(slot => slot.draft) }))
}

const draftId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Saves into one slot and returns the slots; null when the browser refused to store it (full or blocked storage). */
export function saveTempSlot<T>(key: string, slotNumber: number, state: T, label: string, isState: (state: unknown) => state is T): TempSlot<T>[] | null {
  const slots = loadTempSlots(key, isState).map(slot => slot.slotNumber === slotNumber
    ? { ...slot, draft: { id: draftId(), label, savedAt: new Date().toISOString(), state } } : slot)
  try { persist(key, slots); return slots } catch { return null }
}

export function deleteTempSlot<T>(key: string, slotNumber: number, isState: (state: unknown) => state is T): TempSlot<T>[] {
  const slots = loadTempSlots(key, isState).map(slot => slot.slotNumber === slotNumber ? { ...slot, draft: null } : slot)
  try { persist(key, slots) } catch { /* the slots shown stay as stored */ }
  return slots
}
