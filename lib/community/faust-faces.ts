/** Faust expressions shown on the home Assist tile; the ones seen are remembered in this browser for the achievement. */
export const FAUST_FACES = 14
export const FAUST_SEEN_KEY = 'faust-faces-seen'

export function readSeenFaces(storage: Pick<Storage, 'getItem'> | null | undefined): number[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(FAUST_SEEN_KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((face): face is number => Number.isInteger(face) && face >= 0 && face < FAUST_FACES))] : []
  } catch {
    return []
  }
}

export function markFaceSeen(storage: Pick<Storage, 'getItem' | 'setItem'>, face: number) {
  const seen = readSeenFaces(storage)
  if (seen.includes(face)) return
  try { storage.setItem(FAUST_SEEN_KEY, JSON.stringify([...seen, face])) } catch { /* private mode: nothing to keep */ }
}
