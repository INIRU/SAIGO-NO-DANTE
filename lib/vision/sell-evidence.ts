/**
 * Gift sales in the shop's "E.G.O 기프트 판매" window (Korean, English and Japanese clients). A sale shows no acquisition popup: the only
 * evidence is the confirmation dialog "[이름]을(를) 코스트 N에 판매하시겠습니까?" (about 0.5-0.7 s) and the cost in the top
 * right, "current ▸ after sale" while a gift is selected. Cancel and confirm both close the dialog, so a sale counts only
 * once the cost afterwards starts with the cost before plus the price (video review 2026-09-24, 13 sales).
 *
 * Real OCR (scripts/vision/bench_ocr_modes.ts): dialog lines arrive out of order and split ("트 | 150에"), brackets mix
 * ("[빛나는 잔영]을(를]") or lose the opening "[", and the arrow between the two costs is dropped ("129229"), or read as
 * "683-783" / "356 506". Everything below is read with that in mind.
 */
import type { OcrReference } from './ocr-match'
import { nearestName, ocrNormalized } from './text-normalize'

export interface SellDialog { name: string; price: number }
export interface PendingSale extends SellDialog { giftId: string; at: number; costBefore: number }
export const SALE_CONFIRM_MS = 5000

/** Names compare as letters and digits, with Japanese OCR swaps folded (text-normalize). */
const key = ocrNormalized
const compact = (text: string) => text.normalize('NFKC').replace(/\s+/g, '')

/**
 * The confirmation question in each client: "[이름]을(를) 코스트 N에 판매하시겠습니까?" / "Sell [name] for N Cost?" /
 * "[名前]をコストNで売却しますか？" (the game's localization strings).
 */
export function sellQuestion(text: string): boolean {
  const flat = compact(text)
  return flat.includes('판매하시겠') || /sell.{0,80}?for\d{1,4}cost/i.test(flat) || /で売却しますか/.test(flat)
}

/** Gift name and price from a full-frame read that shows the sell confirmation dialog, in any line order. */
export function sellDialog(text: string): SellDialog | null {
  const flat = compact(text)
  let name: string | undefined, price: string | undefined
  if (flat.includes('판매하시겠')) {
    name = flat.match(/\[?([^[\]()|]{1,40}?)[\])]을[([]를/)?.[1]
    price = flat.match(/트(\d{1,4})에/)?.[1]
  } else if (/sell.{0,80}?for\d{1,4}cost/i.test(flat)) {
    // Spaces are gone, so the name reads "CigaretteHolder"; gift names are matched without spaces anyway.
    // The window title "Sell E.G.O Gift" precedes the question: the name starts after the last "Sell".
    const match = flat.match(/sell\[?((?:(?!sell)[^[\]|]){1,60}?)\]?for(\d{1,4})cost/i)
    name = match?.[1]; price = match?.[2]
  } else if (/で売却しますか/.test(flat)) {
    const match = flat.match(/\[?([^[\]|]{1,40}?)\]?をコスト(\d{1,4})で売却/)
    name = match?.[1]; price = match?.[2]
  }
  return name && price ? { name, price: Number(price) } : null
}

/**
 * Whether a read is the sell window (its title "E.G.O 기프트 판매" / "Sell E.G.O Gift" / "E.G.Oギフト売却"), where the
 * top-right cost belongs to selling. The shop's own "Sell Gifts" button has no E.G.O in it.
 */
export function isSellWindow(text: string): boolean {
  const flat = compact(text)
  return flat.includes('기프트판매') || /sellE\.?G\.?[O0]\.?gift/i.test(flat) || flat.includes('ギフト売却')
}

/**
 * The sell window's cost display at 1920×1080: where its row starts and the row's centre and half height. The window is
 * laid out in a 16:9 game view centred in the capture (as the fusion dialog and the acquisition popup are), so a tall or
 * square game window has it mid-screen, not in the top fifth. The half height leaves room for a window title bar,
 * which moves the view down by half its height. The window's title is no anchor: it hangs on a chain and swings when
 * the dialog opens and closes.
 */
const COST_LEFT = 1344, COST_CENTER_Y = 153, COST_ROW_HALF = 67

/** Digit groups of the sell window's cost display, in reading order: ["129229"], ["683", "783"] or ["683"]. */
export function sellCost(words: { text: string; left: number; top: number; width: number; height: number }[], width: number, height: number): string[] {
  const scale = Math.min(width / 1920, height / 1080)
  const left = (width - 1920 * scale) / 2 + COST_LEFT * scale, center = (height - 1080 * scale) / 2 + COST_CENTER_Y * scale
  return words.filter(word => word.left >= left && Math.abs(word.top + word.height / 2 - center) <= COST_ROW_HALF * scale)
    .sort((first, second) => first.left - second.left)
    .flatMap(word => word.text.normalize('NFKC').match(/\d{2,8}/g) ?? [])
}

/** The cost before selling: the first group, or where a merged "beforeafter" splits into two costs that differ by the price. */
export function costBeforeSale(cost: readonly string[], price: number): number | null {
  if (!cost.length) return null
  if (cost.length > 1) return Number(cost[0])
  const digits = cost[0]
  for (let at = 1; at < digits.length; at++)
    if (Number(digits.slice(at)) - Number(digits.slice(0, at)) === price && digits[at] !== '0') return Number(digits.slice(0, at))
  return Number(digits)
}

const sellNames = new WeakMap<readonly OcrReference[], { id: string; name: string }[]>()

/**
 * The one gift whose name matches (spacing and brackets ignored), that uniquely ends with a clipped read of it, or
 * whose long name is one misread glyph away with every other name at least three away (as for acquisition popups).
 */
export function sellGiftId(name: string, gifts: readonly OcrReference[]): string | null {
  const wanted = key(name)
  if (wanted.length < 2) return null
  let names = sellNames.get(gifts)
  if (!names) {
    names = gifts.flatMap(gift => gift.texts.map(text => ({ id: gift.id, name: key(text) })))
    sellNames.set(gifts, names)
  }
  const unique = (test: (text: string) => boolean) => {
    const owners = new Set(names.filter(item => test(item.name)).map(item => item.id))
    return owners.size === 1 ? [...owners][0] : null
  }
  return unique(text => text === wanted) ?? (wanted.length >= 3 ? unique(text => text.length - wanted.length <= 2 && text.endsWith(wanted)) : null) ??
    nearestName(wanted, names, 5)
}

/** A read after the dialog decides it: the cost starts with before + price (sold) or with before (cancelled). */
export function saleOutcome(pending: PendingSale, cost: readonly string[], at: number): 'sold' | 'cancelled' | 'expired' | null {
  if (at - pending.at > SALE_CONFIRM_MS) return 'expired'
  const digits = cost.join('')
  if (!digits) return null
  if (digits.startsWith(String(pending.costBefore + pending.price))) return 'sold'
  if (digits.startsWith(String(pending.costBefore))) return 'cancelled'
  return null
}

/**
 * Leaving the sell window right after the last sale: the shop screen shows the same currency, so the sold total there
 * (and no longer the total before) settles it; anything else leaves the sale open until it expires.
 */
export function soldOnShopScreen(pending: PendingSale, text: string): boolean {
  const numbers = new Set(text.normalize('NFKC').match(/\d{2,5}/g) ?? [])
  return numbers.has(String(pending.costBefore + pending.price)) && !numbers.has(String(pending.costBefore))
}

export interface SaleState {
  pending: PendingSale | null
  /** The dialog the latest reads showed; a read without it ends it, so the next dialog is a new sale. */
  dialog: { name: string; price: number; at: number } | null
  /** The last sell-window cost read outside a dialog, for the cost before the next sale. */
  lastCost: { cost: string[]; at: number } | null
}
export const EMPTY_SALE_STATE: SaleState = { pending: null, dialog: null, lastCost: null }

/**
 * One full-frame read of the shop. The confirmation dialog opens a pending sale at the cost read before it (unreadable
 * first frames retry on the next read). Nothing is decided while that dialog is still up, because the cost then still
 * shows "before ▸ after". A later read settles it: the sell window's cost rose by the price (sold) or not (cancelled),
 * a following dialog shows the new cost, a dialog read while closing already shows the sold total, or the shop screen
 * shows it after leaving at once.
 */
export function readSaleStep(state: SaleState, read: { at: number; text: string; cost: string[]; giftId: (name: string) => string | null }):
  { state: SaleState; sold: PendingSale[] } {
  const { at, text, cost } = read
  const sold: PendingSale[] = []
  let { pending, dialog: seen, lastCost } = state
  const sellWindow = isSellWindow(text)
  const dialog = sellDialog(text)
  const sameDialog = !!dialog && !!seen && seen.name === dialog.name && seen.price === dialog.price && at - seen.at < 1500
  if (pending && at > pending.at && !sameDialog) {
    const outcome = sellWindow ? saleOutcome(pending, cost, at)
      : at - pending.at > SALE_CONFIRM_MS ? 'expired' : soldOnShopScreen(pending, text) ? 'sold' : null
    if (outcome === 'sold') sold.push(pending)
    if (outcome) pending = null
  }
  if (!dialog) return { state: { pending, dialog: null, lastCost: sellWindow && cost.length ? { cost, at } : lastCost }, sold }
  if (sameDialog) return { state: { pending, dialog: { ...seen!, at }, lastCost }, sold }
  const giftId = read.giftId(dialog.name)
  const recent = lastCost && at - lastCost.at < 10_000 ? lastCost.cost : []
  const before = costBeforeSale(recent, dialog.price) ?? costBeforeSale(cost, dialog.price)
  if (!giftId || before === null) return { state: { pending: null, dialog: null, lastCost }, sold }
  const sale = { ...dialog, giftId, at, costBefore: before }
  const digits = cost.join('')
  const closing = recent.length > 0 && digits.startsWith(String(before + dialog.price)) && !digits.startsWith(String(before))
  if (closing) sold.push(sale)
  return { state: { pending: closing ? null : sale, dialog: { ...dialog, at }, lastCost }, sold }
}
