import { writeJson } from '@/lib/utils/local-storage'

const KEY = 'limbus-recent-floor-gifts'
const MAX = 12

export function pushRecentGift(list: string[], id: string, max = MAX): string[] {
  return [id, ...list.filter(item => item !== id)].slice(0, max)
}

export function parseRecentGifts(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

export function loadRecentGifts(): string[] {
  try { return parseRecentGifts(localStorage.getItem(KEY)) } catch { return [] }
}

/** Remembers a picked gift in this browser and returns the new list. */
export function rememberGift(id: string): string[] {
  const next = pushRecentGift(loadRecentGifts(), id)
  writeJson(KEY, next) // the list lives for this session only when storage refuses
  return next
}
