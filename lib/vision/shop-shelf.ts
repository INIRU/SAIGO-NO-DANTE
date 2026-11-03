import type { FusionSlotRead } from './fusion-evidence'

/**
 * Where the game draws its 1920×1080 UI in a captured frame: scaled by the width and centred vertically (measured
 * 2026-11-03 at 1280×720, 1366×768, 1920×1080, 1440×1080, 1680×1050, 1300×1000, 1920×823 and 1920×540: every shop slot
 * lands on the same 1920×1080 position). Below 16:9 that is the smaller-side fit; above it the UI's top and bottom run out
 * of the frame. `titleBar`: the height of a window's title bar at the top of the capture, outside the game.
 */
export function gameUiTransform(width: number, height: number, titleBar = 0): { scale: number; left: number; top: number } {
  const scale = width / 1920
  return { scale, left: 0, top: titleBar + (height - titleBar - 1080 * scale) / 2 }
}

/**
 * A window share's title bar: the leading rows of the capture that are bright (row mean luminance over 150), from the
 * mean of each row. Real window captures carry one (white, "LimbusCompany" and three buttons); the game never starts
 * with a bright strip. Under 8 rows or over 6% of the frame it is taken as none.
 */
export function titleBarRows(rowMeans: readonly number[], height: number): number {
  let rows = 0
  while (rows < rowMeans.length && rowMeans[rows] > 150) rows++
  return rows >= 8 && rows <= height * 0.06 ? rows : 0
}

/** The shop's eight shelf slots at 1920×1080: centres of the gift icons, two rows of four (icon side 66). */
const SHELF_X = [937, 1167.8, 1398, 1628.8]
const SHELF_Y = [395.6, 625.6]
const SHELF_ICON = 66

export interface ShelfRegion { x: number; y: number; size: number }

/** The shelf slots in frame pixels, left to right then top to bottom (the game's order on the shelf). */
export function shopShelfRegions(width: number, height: number, titleBar = 0): ShelfRegion[] {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  return SHELF_Y.flatMap(y => SHELF_X.map(x => ({ x: left + x * scale, y: top + y * scale, size: SHELF_ICON * scale })))
}

/** The band over a slot where a bought one shows 구매 완료 (orange text), in frame pixels. */
export function shopSoldBand(region: ShelfRegion): { x: number; y: number; width: number; height: number } {
  const unit = region.size / SHELF_ICON
  return { x: region.x - 60 * unit, y: region.y - 78 * unit, width: 120 * unit, height: 26 * unit }
}

/**
 * Share of the band's pixels in the 구매 완료 orange (RGBA). Sold slots measured 0.16–0.24 (5th–95th percentile, 249
 * slots), slots on sale 0 (894 slots), so anything over 0.05 is sold.
 */
export function soldMark(pixels: Uint8ClampedArray): number {
  let orange = 0
  const count = pixels.length / 4
  for (let at = 0; at < pixels.length; at += 4) {
    const r = pixels[at], g = pixels[at + 1], b = pixels[at + 2]
    if (r > 170 && g > 100 && g < 210 && b < 90) orange++
  }
  return count ? orange / count : 0
}
export const SHOP_SOLD_MIN = 0.05

export interface ShopSlotRead { index: number; blank: boolean; sold: boolean; read: FusionSlotRead }
export interface ShopShelf { slots: ShopSlotRead[]; observedAt: number }

/** A slot read the shop's prescripts can rely on: the classifier's strong-read bar (0.85, lead 0.25). */
export function shelfGift(slot: ShopSlotRead): string | null {
  const read = slot.read
  return !slot.blank && read && 'id' in read && read.score >= 0.85 && read.margin >= 0.25 ? read.id : null
}
