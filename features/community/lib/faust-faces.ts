import { readJson, writeJson } from '@/lib/utils/local-storage'

/** Faust expressions shown on the home Assist tile; the ones seen are remembered in this browser for the achievement. */
export const FAUST_FACES = 14
export const FAUST_SEEN_KEY = 'faust-faces-seen'

export function readSeenFaces(storage: Pick<Storage, 'getItem'> | null | undefined): number[] {
  const value = readJson(FAUST_SEEN_KEY, storage ?? null)
  return Array.isArray(value) ? [...new Set(value.filter((face): face is number => Number.isInteger(face) && face >= 0 && face < FAUST_FACES))] : []
}

export function markFaceSeen(storage: Pick<Storage, 'getItem' | 'setItem'>, face: number) {
  const seen = readSeenFaces(storage)
  if (seen.includes(face)) return
  writeJson(FAUST_SEEN_KEY, [...seen, face], storage) // private mode: nothing to keep
}
