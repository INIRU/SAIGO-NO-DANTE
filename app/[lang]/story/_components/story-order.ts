import type { StoryIndexEntry } from '@/lib/story-map'

/** Story order, oldest first, as the game's Drive list (newest on top) reads backwards: by chapter number, so 9.5장
 * follows 9장; two stories of the same number (5.5장) by in-story date, then id. */
export function storyOrder<T extends Pick<StoryIndexEntry, 'id' | 'number' | 'timeline'>>(index: T[]): T[] {
  const num = (e: T) => { const n = Number(e.number); return Number.isFinite(n) ? n : Infinity }
  return [...index].sort((a, b) => num(a) - num(b) || (a.timeline ?? '').localeCompare(b.timeline ?? '') || a.id - b.id)
}

/** Chapters after the furthest one the reader has opened are hidden. Nothing opened yet (null) = the first chapter
 * only, so a newcomer meets no spoilers; an id that is not in the order counts the same. `order` is oldest first. */
export function isHiddenChapter(order: number[], progress: number | null, id: number) {
  const at = progress != null && order.includes(progress) ? order.indexOf(progress) : 0
  return order.indexOf(id) > at
}

type Part = Pick<StoryIndexEntry, 'id' | 'hard' | 'normal' | 'sync'>

/** A chapter and its HARD versions (subchapterFeatureList HARD, paired by mapIllustId): the normal one first. */
export function chapterParts<T extends Part>(index: T[], id: number): T[] {
  const e = index.find(x => x.id === id)
  if (!e) return []
  const normal = e.hard && e.normal != null ? e.normal : e.id
  return index.filter(x => x.id === normal || (x.hard && x.normal === normal)).sort((a, b) => Number(a.hard) - Number(b.hard) || a.id - b.id)
}

/** Left out of the chapter list: a HARD version (reached from its normal chapter's map) and a sync chapter (the same
 * chapter under another id, 9128 = 10장). */
export function isExtraPart<T extends Part>(_index: T[], e: T) {
  return e.hard || e.sync != null
}
