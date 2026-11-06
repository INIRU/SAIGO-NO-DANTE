import type { FusionSlotRead } from './fusion-evidence'
import type { OcrWord } from './ocr-match'
import { explorationThemeIds, type ExplorationThemeReference } from './exploration-match'
import { gameUiTransform } from './shop-shelf'
import { isStrongRead } from './strong-read'
import { bonusPicks, type ClearBonusCard, type ClearBonusOffer } from '@/lib/utils/clear-bonus-offer'

/**
 * The theme pack selection's CLEAR BONUS: the gifts under each pack card. Beating that floor's boss offers them and the
 * player takes one (two on a hard floor), so a planned gift among
 * them need not be bought in that floor's shop.
 *
 * Layout in the game's 1920×1080 UI (measured 2026-11-05 on 350 labelled cards at 1280×720, 1366×768, 1440×1080 and
 * 1920×1080, and seen on real captures): the cards stand on fixed places 315.8 apart around x 964, three to five of them;
 * each card's bonus band has a one-pixel line on top at y 807 (blue on normal floors, red on hard ones) and holds up to
 * four icons 65.2 apart, centred on the card, centres at y 843.6, side 64.9.
 */
export const BONUS_CARD_X = 964
export const BONUS_CARD_STEP = 315.8
export const BONUS_LINE_Y = 807
export const BONUS_ICON_Y = 843.6
export const BONUS_ICON = 64.9
export const BONUS_ICON_STEP = 65.2
/** The band line is looked for under the card's middle, this far each way (UI units). */
export const BONUS_LINE_HALF = 100
/** Rows above and below the line in the strip the worker samples (frame pixels). */
export const BONUS_STRIP_ROWS = 5

/** Card places (UI x): three or five cards stand on the odd places, four on the even ones. */
export const BONUS_PLACES = {
  odd: [-2, -1, 0, 1, 2].map(k => BONUS_CARD_X + k * BONUS_CARD_STEP),
  even: [-1.5, -0.5, 0.5, 1.5].map(k => BONUS_CARD_X + k * BONUS_CARD_STEP),
}

/** A card place's line strip in frame pixels: the rows around the band's top line under the card's middle. */
export function bonusLineStrip(width: number, height: number, place: number, titleBar = 0) {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  const y = Math.round(top + BONUS_LINE_Y * scale)
  const x0 = Math.max(0, Math.round(left + (place - BONUS_LINE_HALF) * scale))
  const x1 = Math.min(width, Math.round(left + (place + BONUS_LINE_HALF) * scale))
  return { x: x0, y: y - BONUS_STRIP_ROWS, width: Math.max(0, x1 - x0), height: BONUS_STRIP_ROWS * 2 + 1 }
}

/**
 * Share of the strip's columns that show the band's top line: within two rows of the middle, a row whose brightest
 * channel is at least 50 and 25 over the rows three above and below. No colour test: the line is blue on normal floors
 * and red on hard ones, and a real capture's JPEG washes its colour out (60, 64, 84 at 1280 wide).
 */
export function bonusLineShare(pixels: Uint8ClampedArray, width: number, height: number): number {
  if (!width || height < BONUS_STRIP_ROWS * 2 + 1) return 0
  const middle = BONUS_STRIP_ROWS
  const bright = (row: number, column: number) => {
    const at = (row * width + column) * 4
    return Math.max(pixels[at], pixels[at + 1], pixels[at + 2])
  }
  let hits = 0
  for (let column = 0; column < width; column++) {
    for (let row = middle - 2; row <= middle + 2; row++) {
      const value = bright(row, column)
      if (value >= 50 && value - Math.max(bright(row - 3, column), bright(row + 3, column)) >= 25) { hits++; break }
    }
  }
  return hits / width
}

/** The places holding a band: the odd or the even set, whichever shows more line, and in it each place over half lit. */
export function bonusBandPlaces(oddShares: readonly number[], evenShares: readonly number[]): number[] {
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
  const [places, shares] = sum(oddShares) >= sum(evenShares) ? [BONUS_PLACES.odd, oddShares] : [BONUS_PLACES.even, evenShares]
  return places.filter((_, index) => (shares[index] ?? 0) >= 0.5)
}

/** Seven icon positions under a card (half an icon step apart): four or two icons sit on the even ones, three or one on the odd. */
export function bonusIconRegions(width: number, height: number, place: number, titleBar = 0) {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  return [-3, -2, -1, 0, 1, 2, 3].map(k => ({ x: left + (place + k * BONUS_ICON_STEP / 2) * scale, y: top + BONUS_ICON_Y * scale, size: BONUS_ICON * scale }))
}

const strongGift = (read: FusionSlotRead) => (read && 'id' in read && isStrongRead(read) ? read.id : null)

/**
 * The card's gifts from its seven position reads: four (all even positions), three (all odd), two (the inner even pair)
 * or one (the middle), whichever layout reads strongly with more icons. A half-shifted crop rarely reads strongly, so the
 * wrong parity loses. Checked offline on the 350 labelled cards: 349 exact, 1 a gift short, none wrong (as captured and
 * as a real 1280-wide JPEG capture).
 */
export function bonusLayout(reads: readonly FusionSlotRead[]): string[] {
  const gifts = reads.map(strongGift)
  const all = (indices: number[]) => indices.every(index => gifts[index])
  const even = all([0, 2, 4, 6]) ? [0, 2, 4, 6] : all([2, 4]) ? [2, 4] : []
  const odd = all([1, 3, 5]) ? [1, 3, 5] : all([3]) ? [3] : []
  return (even.length > odd.length ? even : odd).map(index => gifts[index]!)
}

export type { ClearBonusCard, ClearBonusOffer }

export const offerKey = (cards: readonly ClearBonusCard[]) => cards.map(card => `${Math.round(card.place)}:${card.gifts.join(',')}`).join('|')

/**
 * The pack names on a selection screen: the OCR words on each card's name line (y 640–730 UI, the card's width), read
 * as one pack name. `factor`: OCR pixels to frame pixels.
 */
export function bonusCardThemes(words: readonly OcrWord[], places: readonly number[], width: number, height: number,
  themes: ExplorationThemeReference[], factor = 1, titleBar = 0): Map<number, string[]> {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  const names = new Map<number, string[]>()
  for (const place of places) {
    const inside = words.filter(word => {
      const x = (word.left + word.width / 2) * factor, y = (word.top + word.height / 2) * factor
      return Math.abs(x - (left + place * scale)) <= 135 * scale && y >= top + 640 * scale && y <= top + 730 * scale
    })
    const ids = inside.length ? explorationThemeIds(inside, themes) : []
    if (ids.length) names.set(place, ids)
  }
  return names
}

/**
 * The card of the pack the floor took: the one whose name read as that pack, else the only card whose every gift is in
 * the pack's gift pool (the bonus is drawn from it). Null when neither settles it.
 */
export function cardOfTheme(cards: readonly ClearBonusCard[], themeId: string, pool: ReadonlySet<string> | null): ClearBonusCard | null {
  const named = cards.filter(card => card.themeIds?.length === 1 && card.themeIds[0] === themeId)
  if (named.length === 1) return named[0]
  if (!pool) return null
  const fits = cards.filter(card => card.gifts.length > 0 && !card.themeIds?.length && card.gifts.every(gift => pool.has(gift)))
  return fits.length === 1 && !cards.some(card => card.themeIds?.includes(themeId) && card !== fits[0]) ? fits[0] : null
}

export { bonusPicks }
