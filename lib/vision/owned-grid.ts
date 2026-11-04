import { gameUiTransform, type ShelfRegion } from './shop-shelf'
import type { FusionSlotRead } from './fusion-evidence'
import { isStrongRead } from './strong-read'

/**
 * The sell window's owned list at 1920×1080: five columns of 88 px slots (left edges below), rows 160 px apart, scrolled
 * inside the list's view (y 326–744). Measured on labelled sell screens of eight window sizes, 2026-11-04.
 */
const GRID_X = [980, 1118, 1256, 1393, 1531]
const GRID_SIDE = 88
const GRID_PITCH = 160
const GRID_VIEW = [326, 744] as const

/** The view's column strips in frame pixels: where the rows are looked for. */
export function ownedGridStrips(width: number, height: number, titleBar = 0) {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  return GRID_X.map(x => ({ x: left + x * scale, y: top + GRID_VIEW[0] * scale, width: GRID_SIDE * scale, height: (GRID_VIEW[1] - GRID_VIEW[0]) * scale }))
}

/** How many pixels of each row of a strip (RGBA, `width` wide) are the slots' hazard yellow or their price coins'. */
export function yellowRows(pixels: Uint8ClampedArray, width: number): number[] {
  const rows = pixels.length / 4 / width
  return Array.from({ length: rows }, (_, row) => {
    let count = 0
    for (let at = row * width * 4, end = at + width * 4; at < end; at += 4) {
      const r = pixels[at], g = pixels[at + 1], b = pixels[at + 2]
      if (r > 170 && g > 110 && b < 90 && r - b > 110) count++
    }
    return count
  })
}

/**
 * The scroll: where a row's top lies (0–159, in 1920×1080 pixels from the view's top) from the yellow of the view's rows
 * (`profile`, one value per 1920×1080 pixel down the view). A slot's striped rim fills its first 28 pixels and its price
 * coin 105–132 below its top, so the offset is where those bands hold the most yellow. On labelled screens it lands within
 * 5 pixels of the truth, about 3 above it, which is added back.
 */
export function ownedGridOffset(profile: readonly number[]): number {
  let best = 0, bestScore = -1
  for (let offset = 0; offset < GRID_PITCH; offset++) {
    let score = 0
    for (let top = offset - GRID_PITCH; top < profile.length; top += GRID_PITCH)
      for (const [from, to] of [[0, 28], [105, 132]])
        for (let y = Math.max(0, top + from); y < Math.min(profile.length, top + to); y++) score += profile[y]
    if (score > bestScore) { best = offset; bestScore = score }
  }
  return (best + 3) % GRID_PITCH
}

/** The slots wholly inside the view at that scroll, in frame pixels, left to right then top to bottom. */
export function ownedGridRegions(width: number, height: number, offset: number, titleBar = 0): ShelfRegion[] {
  const { scale, left, top } = gameUiTransform(width, height, titleBar)
  const regions: ShelfRegion[] = []
  for (let row = GRID_VIEW[0] + offset - GRID_PITCH; row + GRID_SIDE <= GRID_VIEW[1]; row += GRID_PITCH) {
    if (row < GRID_VIEW[0]) continue
    for (const x of GRID_X) regions.push({ x: left + (x + GRID_SIDE / 2) * scale, y: top + (row + GRID_SIDE / 2) * scale, size: GRID_SIDE * scale })
  }
  return regions
}

export interface OwnedGridRead { gifts: string[]; observedAt: number }

/** The gifts an owned-list read names for certain: the classifier's strong-read bar (0.85, lead 0.25), blanks left out. */
export function ownedGridGifts(reads: readonly (FusionSlotRead | null)[]): string[] {
  return reads.flatMap(read => read && 'id' in read && isStrongRead(read) ? [read.id] : [])
}
