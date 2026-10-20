/**
 * Which new note-editor tools this browser has already used. The key carries a version: raising `v1` brings the dots back
 * for a later round of new tools. Storage can be blocked (private windows), so every access is guarded and a used tool is
 * also remembered in memory for the rest of the visit.
 */
const used = new Set<string>()
const listeners = new Set<() => void>()

export const newFeatureKey = (feature: string) => `note-editor-new:v1:${feature}`

export function noteFeatureIsNew(feature: string): boolean {
  if (used.has(feature)) return false
  try { return localStorage.getItem(newFeatureKey(feature)) !== '1' } catch { return true }
}

export function markNoteFeatureUsed(feature: string) {
  if (used.has(feature)) return
  used.add(feature)
  try { localStorage.setItem(newFeatureKey(feature), '1') } catch { /* blocked storage: the dot stays gone for this visit only */ }
  listeners.forEach(listener => listener())
}

export function subscribeNoteFeatures(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const NEW_WORD: Record<string, string> = { ko: '새 기능', en: 'New', ja: '新機能' }
/** The button's accessible name: the dot has no text, so while it shows the name ends with the word for "new". */
export function newFeatureLabel(title: string, isNew: boolean, lang: string): string {
  return isNew ? `${title}, ${NEW_WORD[lang] ?? NEW_WORD.ko}` : title
}
