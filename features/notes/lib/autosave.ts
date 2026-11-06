/** One automatic draft per editor target (a new deck/plan, or one saved id), kept in this browser's localStorage. */
export type AutosaveKind = 'deck' | 'plan'

export const autosaveKey = (kind: AutosaveKind, id?: string | null) => `limbus-autosave:${kind}:${id || 'new'}`

export function serializeAutosave<T>(state: T, savedAt = Date.now()): string {
  return JSON.stringify({ v: 1, savedAt, state })
}

export function parseAutosave<T>(raw: string | null, isState: (state: unknown) => state is T): { savedAt: number; state: T } | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    const { savedAt, state } = parsed as { savedAt?: unknown; state?: unknown }
    return typeof savedAt === 'number' && isState(state) ? { savedAt, state } : null
  } catch { return null }
}

/**
 * Offer a stored draft back only when it differs from what the editor opened with and is newer than the last save on the
 * server (`savedAt`, null when unknown): a draft older than a save made elsewhere would overwrite newer content.
 */
export function shouldOfferAutosave(stored: { savedAt: number; state: unknown } | null, baseline: string, savedAt: number | null | undefined): boolean {
  if (!stored || JSON.stringify(stored.state) === baseline) return false
  return savedAt == null || !Number.isFinite(savedAt) || stored.savedAt > savedAt
}

export function readAutosave<T>(key: string, isState: (state: unknown) => state is T) {
  try { return parseAutosave(localStorage.getItem(key), isState) } catch { return null }
}

export function writeAutosave<T>(key: string, state: T): void {
  try { localStorage.setItem(key, serializeAutosave(state)) } catch { /* full or blocked storage: no draft */ }
}

export function clearAutosave(key: string): void {
  try { localStorage.removeItem(key) } catch { /* nothing to clear */ }
}
