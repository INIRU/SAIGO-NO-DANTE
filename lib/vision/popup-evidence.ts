import type { OcrReference, OcrWord } from './ocr-match'

const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const ACQUIRED_HEADER = '기프트를획득했습니다'

export function popupHeaderEvidence(value: string): boolean {
  const text = normalized(value)
  if (text.includes(ACQUIRED_HEADER)) return true
  const target = [...ACQUIRED_HEADER]
  const characters = [...text]
  for (let start = 0; start < characters.length; start++) for (let length = target.length - 2; length <= target.length + 2; length++) {
    if (start + length > characters.length) continue
    const source = characters.slice(start, start + length)
    let previous = Array.from({ length: target.length + 1 }, (_, index) => index)
    for (let row = 1; row <= source.length; row++) {
      const current = [row]
      for (let column = 1; column <= target.length; column++) current[column] = Math.min(
        previous[column] + 1, current[column - 1] + 1,
        previous[column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1))
      previous = current
    }
    if (previous[target.length] <= 2) return true
  }
  return false
}

export interface PopupLabelRead { text: string; words: OcrWord[] }

function nameIds(read: PopupLabelRead, gifts: OcrReference[]): string[] | null {
  const name = normalized(read.text)
  if (!name) return []
  const matches = gifts.filter(gift => gift.texts.some(text => normalized(text) === name))
  if (matches.length > 1) return null
  // Tesseract under-reports confidence on Hangul; a whole long name cannot be a partial read, but a short one can.
  const sufficientlyRead = [...name].length >= 5 || (read.words.length > 0 && read.words.every(word =>
    Number.isFinite(word.confidence) && word.confidence >= 70))
  return sufficientlyRead ? matches.map(gift => gift.id) : []
}

/**
 * A popup header plus agreeing evidence from inside that popup: exact name reads, the local artwork, or one
 * gift's unique effect phrases. Any ambiguity or disagreement abstains.
 */
export function acquiredGiftFromPopup({ header, labels, iconGiftId, effectGiftIds = [], gifts }: {
  header: string
  labels: PopupLabelRead[]
  iconGiftId: string | null
  effectGiftIds?: string[]
  gifts: OcrReference[]
}): string | null {
  if (!popupHeaderEvidence(header) || effectGiftIds.length > 1) return null
  const candidates = new Set<string>()
  for (const read of labels) {
    const ids = nameIds(read, gifts)
    if (!ids) return null
    for (const id of ids) candidates.add(id)
  }
  if (!candidates.size) {
    // Light text on bright plates is often one glyph off. Two reads must land on the same single long name that every
    // other gift name stays well away from; a lone or split near-miss abstains.
    const near = labels.map(read => nearestGiftName(read.text, gifts)).filter((id): id is string => id !== null)
    if (near.length >= 2 && near.every(id => id === near[0])) candidates.add(near[0])
  }
  for (const id of [iconGiftId, ...effectGiftIds]) {
    if (!id) continue
    if (!gifts.some(gift => gift.id === id)) return null
    candidates.add(id)
  }
  return candidates.size === 1 ? [...candidates][0] : null
}

/**
 * Every gift a popup's evidence points at, however weak or conflicting (short or near name reads, icons, effect owners),
 * for resolving it with other knowledge. Empty without the popup header.
 */
export function popupCandidateIds({ header, labels, iconGiftIds, effectGiftIds, gifts }: {
  header: string
  labels: PopupLabelRead[]
  iconGiftIds: string[]
  effectGiftIds: string[]
  gifts: OcrReference[]
}): string[] {
  if (!popupHeaderEvidence(header)) return []
  const ids = new Set<string>()
  for (const read of labels) {
    const name = normalized(read.text)
    if (!name) continue
    for (const gift of gifts) if (gift.texts.some(text => normalized(text) === name)) ids.add(gift.id)
    const near = nearestGiftName(read.text, gifts)
    if (near) ids.add(near)
  }
  for (const id of [...iconGiftIds, ...effectGiftIds]) if (gifts.some(gift => gift.id === id)) ids.add(id)
  return [...ids]
}

/**
 * Floor log for a confirmed acquisition: the floor the run recorded when the popup was captured, unless the latest
 * exploration banner showed a different floor; then the gift goes to the inventory only rather than a guessed floor.
 */
export function acquisitionFloor(capturedFloor: number, bannerFloor: number | null): number | null {
  return bannerFloor !== null && bannerFloor !== capturedFloor ? null : capturedFloor
}

const nameCache = new WeakMap<OcrReference[], { id: string; name: string }[]>()

function nearestGiftName(text: string, gifts: OcrReference[]): string | null {
  const read = [...normalized(text)]
  if (read.length < 6) return null
  let names = nameCache.get(gifts)
  if (!names) {
    names = gifts.flatMap(gift => gift.texts.map(value => ({ id: gift.id, name: normalized(value) })))
      .filter(item => [...item.name].length >= 6)
    nameCache.set(gifts, names)
  }
  let best: { id: string; distance: number } | null = null
  let runnerUp = Infinity
  for (const item of names) {
    const distance = editDistance(read, [...item.name], 3)
    if (!best || distance < best.distance) {
      if (best && best.id !== item.id) runnerUp = Math.min(runnerUp, best.distance)
      best = { id: item.id, distance }
    } else if (item.id !== best.id) runnerUp = Math.min(runnerUp, distance)
  }
  return best && best.distance <= 1 && runnerUp >= 3 ? best.id : null
}

/** Levenshtein distance, stopping once it exceeds `limit`. */
function editDistance(source: string[], target: string[], limit: number): number {
  if (Math.abs(source.length - target.length) > limit) return limit + 1
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let row = 1; row <= source.length; row++) {
    const current = [row]
    let smallest = row
    for (let column = 1; column <= target.length; column++) {
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1,
        previous[column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1))
      smallest = Math.min(smallest, current[column])
    }
    if (smallest > limit) return limit + 1
    previous = current
  }
  return previous[target.length]
}

/**
 * Vestiges (어두운·아스라한·빛나는·찬란한·달의 잔영) only count as a grade of gift for selling and fusion, so automatic
 * screen acquisition skips them by exact catalog id. Manual records and the catalog itself are unaffected.
 */
export const AUTO_ACQUIRE_EXCLUDED_GIFT_IDS: ReadonlySet<string> = new Set(['9991', '9992', '9993', '9994', '9995'])
