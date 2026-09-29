import type { OcrReference, OcrWord } from './ocr-match'
import { nearestName, ocrNormalized } from './text-normalize'

const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
/** Gift names compare with Japanese OCR swaps folded (ブ/プ, ッ/ツ, 口/ロ); headers keep their own edit tolerance. */
const nameKey = ocrNormalized
/**
 * The acquisition popup's header in each client ("E.G.O 기프트를 획득했습니다." / "E.G.O Gift GET!" /
 * "E.G.Oギフトを獲得しました。"), normalized, with the glyph edits a misread may add. The short English one allows one.
 */
const ACQUIRED_HEADERS: [string, number][] = [['기프트를획득했습니다', 2], ['egogiftget', 1], ['ギフトを獲得しました', 2]]

/** The shop's "E.G.O 기프트 구매" / "Purchase E.G.O Gifts" / "E.G.Oギフト購入" confirmation: not an acquisition yet. */
export function popupPurchaseHeader(value: string): boolean {
  const text = normalized(value)
  return text.includes('기프트구매') || text.includes('purchaseegogift') || text.includes('ギフト購入')
}

export function popupHeaderEvidence(value: string): boolean {
  const text = normalized(value)
  return ACQUIRED_HEADERS.some(([header, edits]) => text.includes(header) || nearHeader([...text], [...header], edits))
}

/** Whether a full-frame read shows an acquisition popup's own sentence (not the companion's "획득" notices). */
export function showsAcquiredHeader(value: string): boolean {
  const text = normalized(value)
  return ACQUIRED_HEADERS.some(([header]) => text.includes(header))
}

/** Some window of `characters` within `edits` of `target` (±2 glyphs long). */
function nearHeader(characters: string[], target: string[], edits: number): boolean {
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
    if (previous[target.length] <= edits) return true
  }
  return false
}

export interface PopupLabelRead { text: string; words: OcrWord[] }

function nameIds(read: PopupLabelRead, gifts: OcrReference[]): string[] | null {
  const name = nameKey(read.text)
  if (!name) return []
  const matches = gifts.filter(gift => gift.texts.some(text => nameKey(text) === name))
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
 * Every gift a popup's evidence points at, however weak or conflicting, for resolving it with other knowledge: exact
 * name reads of any confidence (`named`), and near names, icons, effect owners and lexicon-decoded names below the
 * acceptance bar (`others`). Empty without the header.
 */
export function popupCandidateIds({ header, labels, iconGiftIds, effectGiftIds, lexiconGiftIds = [], gifts }: {
  header: string
  labels: PopupLabelRead[]
  iconGiftIds: string[]
  effectGiftIds: string[]
  lexiconGiftIds?: string[]
  gifts: OcrReference[]
}): { named: string[]; others: string[] } {
  const named = new Set<string>(), others = new Set<string>()
  if (!popupHeaderEvidence(header)) return { named: [], others: [] }
  for (const read of labels) {
    const name = nameKey(read.text)
    if (!name) continue
    for (const gift of gifts) if (gift.texts.some(text => nameKey(text) === name)) named.add(gift.id)
    const near = nearestGiftName(read.text, gifts)
    if (near) others.add(near)
  }
  for (const id of [...iconGiftIds, ...effectGiftIds, ...lexiconGiftIds]) if (gifts.some(gift => gift.id === id)) others.add(id)
  return { named: [...named], others: [...others].filter(id => !named.has(id)) }
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
  let names = nameCache.get(gifts)
  if (!names) {
    names = gifts.flatMap(gift => gift.texts.map(value => ({ id: gift.id, name: nameKey(value) })))
      .filter(item => [...item.name].length >= 6)
    nameCache.set(gifts, names)
  }
  return nearestName(nameKey(text), names)
}

/**
 * Vestiges (어두운·아스라한·빛나는·찬란한·달의 잔영) only count as a grade of gift for selling and fusion, so automatic
 * screen acquisition skips them by exact catalog id. Manual records and the catalog itself are unaffected.
 */
export const AUTO_ACQUIRE_EXCLUDED_GIFT_IDS: ReadonlySet<string> = new Set(['9991', '9992', '9993', '9994', '9995'])
