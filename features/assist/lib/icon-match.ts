import type { PopupLabelBox } from './popup-detect'

/**
 * One catalog icon, sampled at `size` px, in two zero-mean, unit-length RGB vectors over the same pixels (`mask`):
 * `vector`, the icon as the game draws it on its black slot (colors times alpha) over its drawn area grown by 1 px, so
 * the outline counts; and `inner`, only the colors of its opaque pixels. `pixels` lists the masked pixels (y·size+x) in
 * vector order, opaque ones first: `inner` covers the first `innerCount` values.
 * Plain white icons (the leaves 9750) have almost nothing inside to correlate but a clear outline; dark icons (9169,
 * 9107) have a faint outline but distinct colors. A placement scores the better of the two.
 */
export interface IconTemplate { id: string; size: number; pixels: Int32Array; vector: Float32Array; count: number
  inner: Float32Array; innerCount: number }

/** Accepted only when clearly ahead of every other icon; measured wrong matches stayed below these. */
const ICON_MATCH_MIN = 0.8
const ICON_MATCH_MARGIN = 0.2
const DRAWN = 32
const OPAQUE = 160

/** Zero-mean, unit-length copy of `values`. */
const unit = (values: number[]) => {
  const out = new Float32Array(values.length)
  const mean = values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
  let norm = 0
  for (let index = 0; index < values.length; index++) { out[index] = values[index] - mean; norm += out[index] * out[index] }
  norm = Math.sqrt(norm) || 1
  for (let index = 0; index < out.length; index++) out[index] /= norm
  return out
}

export function iconTemplate(id: string, rgba: Uint8ClampedArray, size: number): IconTemplate {
  const drawn = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && rgba[(y * size + x) * 4 + 3] > DRAWN
  const opaque: number[] = [], ring: number[] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!(drawn(x, y) || drawn(x - 1, y) || drawn(x + 1, y) || drawn(x, y - 1) || drawn(x, y + 1))) continue
    const pixel = y * size + x
    ;(rgba[pixel * 4 + 3] > OPAQUE ? opaque : ring).push(pixel)
  }
  const pixels = Int32Array.from([...opaque, ...ring])
  const channels = (list: ArrayLike<number>, value: (pixel: number, channel: number) => number) =>
    Array.from(list).flatMap(pixel => [0, 1, 2].map(channel => value(pixel, channel)))
  const vector = unit(channels(pixels, (pixel, channel) => rgba[pixel * 4 + channel] * rgba[pixel * 4 + 3] / 255))
  const inner = unit(channels(opaque, (pixel, channel) => rgba[pixel * 4 + channel]))
  return { id, size, pixels, vector, count: vector.length, inner, innerCount: inner.length }
}

/** Byte offsets of a template's pixels (vector order) inside a square RGBA query of `querySize`, cached per query size. */
const offsetCache = new WeakMap<IconTemplate, Map<number, Int32Array>>()
function opaqueOffsets(template: IconTemplate, querySize: number): Int32Array {
  let bySize = offsetCache.get(template)
  if (!bySize) { bySize = new Map(); offsetCache.set(template, bySize) }
  let offsets = bySize.get(querySize)
  if (!offsets) {
    offsets = template.pixels.map(pixel => (Math.floor(pixel / template.size) * querySize + pixel % template.size) * 4)
    bySize.set(querySize, offsets)
  }
  return offsets
}

/**
 * Masked zero-mean normalized correlation of a template placed at (left, top) in a square RGBA query: the better of its
 * outline and inner correlations, accumulated in one pass (the opaque pixels come first and carry both).
 */
export function templateScore(template: IconTemplate, query: Uint8ClampedArray, querySize: number, left: number, top: number): number {
  if (template.count < 30) return 0
  const offsets = opaqueOffsets(template, querySize)
  const vector = template.vector, inner = template.inner, opaque = template.innerCount / 3
  const base = (top * querySize + left) * 4
  let dot = 0, sum = 0, squares = 0, innerDot = 0
  let pixel = 0, index = 0
  for (; pixel < opaque; pixel++, index += 3) {
    const at = base + offsets[pixel]
    const red = query[at], green = query[at + 1], blue = query[at + 2]
    dot += vector[index] * red + vector[index + 1] * green + vector[index + 2] * blue
    innerDot += inner[index] * red + inner[index + 1] * green + inner[index + 2] * blue
    sum += red + green + blue
    squares += red * red + green * green + blue * blue
  }
  const innerSum = sum, innerSquares = squares
  for (; pixel < offsets.length; pixel++, index += 3) {
    const at = base + offsets[pixel]
    const red = query[at], green = query[at + 1], blue = query[at + 2]
    dot += vector[index] * red + vector[index + 1] * green + vector[index + 2] * blue
    sum += red + green + blue
    squares += red * red + green * green + blue * blue
  }
  const variance = squares - sum * sum / template.count
  const outline = variance > 1e-6 ? dot / Math.sqrt(variance) : 0
  if (template.innerCount < 30) return outline
  const innerVariance = innerSquares - innerSum * innerSum / template.innerCount
  return Math.max(outline, innerVariance > 1e-6 ? innerDot / Math.sqrt(innerVariance) : 0)
}

/** Center and side of the gift artwork above an acquisition plate, from the plate's glow-free width. */
export function popupArtworkRegion(label: PopupLabelBox) {
  const unit = Math.min(label.height, label.width / 2.17)
  return { x: label.x + label.width * 0.52, y: label.y + label.height - unit * 2.38, size: unit * 1.33 }
}

/** Only acquisition-plate proportions are matched; other saturated boxes are UI noise. */
export function plateShaped(label: PopupLabelBox): boolean {
  const ratio = label.width / label.height
  return ratio >= 1.8 && ratio <= 2.45
}

/**
 * Best-matching icons for the artwork above a plate. `sample(centerX, centerY, span, size)` returns a size×size RGBA
 * crop; a coarse pass over every icon keeps a shortlist that is refined at full template size.
 */
export function rankIcons(sample: (x: number, y: number, span: number, size: number) => Uint8ClampedArray,
  label: PopupLabelBox, coarse: IconTemplate[], fine: Map<string, IconTemplate>, tiny?: IconTemplate[]): { id: string; score: number }[] {
  return rankIconsInRegion(sample, popupArtworkRegion(label), coarse, fine, tiny)
}

/**
 * Best score of a template over the placements in a square query: a grid every `stride` px, then the positions around
 * the best grid point down to 1 px. Coarser grids than 2 px lose sharp peaks (measured on real dialog frames).
 */
function peakScore(template: IconTemplate, query: Uint8ClampedArray, querySize: number, stride: number): number {
  const last = querySize - template.size
  let best = -1, bestLeft = 0, bestTop = 0
  for (let top = 0; top <= last; top += stride) for (let left = 0; left <= last; left += stride) {
    const score = templateScore(template, query, querySize, left, top)
    if (score > best) { best = score; bestLeft = left; bestTop = top }
  }
  for (let step = stride >> 1; step >= 1; step >>= 1) {
    const centerLeft = bestLeft, centerTop = bestTop
    for (let dy = -step; dy <= step; dy += step) for (let dx = -step; dx <= step; dx += step) {
      const left = centerLeft + dx, top = centerTop + dy
      if ((!dx && !dy) || left < 0 || top < 0 || left > last || top > last) continue
      const score = templateScore(template, query, querySize, left, top)
      if (score > best) { best = score; bestLeft = left; bestTop = top }
    }
  }
  return best
}

/**
 * Best-matching icons for a square artwork region (center and side in frame pixels), e.g. a fusion material slot.
 * With `tiny` templates (every icon at a small size) one pass at a single scale keeps the `prefilter` best icons for the
 * three-scale coarse pass, which is where nearly all the time went. Icons in `always` (a fusion's held gifts) skip that
 * cut: the small pass once dropped a held vial (9111) and let an unheld lookalike lead (2026-09-23 replay).
 */
export function rankIconsInRegion(sample: (x: number, y: number, span: number, size: number) => Uint8ClampedArray,
  art: { x: number; y: number; size: number }, coarse: IconTemplate[], fine: Map<string, IconTemplate>, tiny?: IconTemplate[],
  prefilter = 40, always?: ReadonlySet<string>): { id: string; score: number }[] {
  if (!coarse.length) return []
  if (tiny?.length && coarse.length > prefilter) {
    const querySize = Math.round(tiny[0].size * 1.5)
    const query = sample(art.x, art.y, art.size * 1.5, querySize)
    const keep = new Set(tiny.map(template => ({ id: template.id, score: peakScore(template, query, querySize, 2) }))
      .sort((left, right) => right.score - left.score).slice(0, prefilter).map(item => item.id))
    coarse = coarse.filter(template => keep.has(template.id) || always?.has(template.id))
  }
  const best = new Map<string, number>()
  const coarseSize = coarse[0].size
  for (const scale of [0.9, 1, 1.1]) {
    const querySize = Math.round(coarseSize * 1.5)
    const query = sample(art.x, art.y, art.size * 1.5 / scale, querySize)
    for (const template of coarse) {
      const score = peakScore(template, query, querySize, 2)
      if (score > (best.get(template.id) ?? -1)) best.set(template.id, score)
    }
  }
  const shortlist = [...best].sort((left, right) => right[1] - left[1]).slice(0, 8)
  // The fine queries depend only on the template size, so each is sampled once for the whole shortlist.
  const fineQueries = new Map<number, Uint8ClampedArray[]>()
  const ranked = shortlist.map(([id, coarseScore]) => {
    const template = fine.get(id)
    if (!template) return { id, score: coarseScore }
    const querySize = Math.round(template.size * 1.4)
    let queries = fineQueries.get(template.size)
    if (!queries) {
      queries = [0.92, 0.97, 1, 1.03, 1.08].map(scale => sample(art.x, art.y, art.size * 1.4 / scale, querySize))
      fineQueries.set(template.size, queries)
    }
    let score = -1
    for (const query of queries) score = Math.max(score, peakScore(template, query, querySize, 1))
    return { id, score }
  })
  // Shortlisted icons without a fine template keep their coarse score only for ranking the runner-up.
  return ranked.sort((left, right) => right.score - left.score)
}

/** The single icon clearly ahead of all others, or null. */
export function acceptedIcon(ranked: { id: string; score: number }[]): { id: string; score: number } | null {
  const [first, second] = ranked
  return first && first.score >= ICON_MATCH_MIN && first.score - (second?.score ?? -1) >= ICON_MATCH_MARGIN ? first : null
}

/**
 * A fusion material slot read. Materials can only be gifts the player holds (or vestiges), so when the best catalog icon
 * is held, its margin is measured against the other held gifts only: an unheld lookalike no longer holds it back. When an
 * unheld icon is best, the catalog read stands, so an incomplete inventory never turns a slot into a held lookalike.
 */
export function heldSlotRead(all: { id: string; score: number }[], held: { id: string; score: number }[]) {
  const [first, second] = all
  if (!first) return null
  const [best, runnerUp] = held
  if (best?.id === first.id) return { id: best.id, score: best.score, margin: best.score - (runnerUp?.score ?? -1) }
  return { id: first.id, score: first.score, margin: first.score - (second?.score ?? -1) }
}

/** A ranking (best first) with look-alike icons of one kind merged under one id, each group at its best score. */
export function mergeRankedGroups(ranked: { id: string; score: number }[], group: (id: string) => string) {
  const merged = new Map<string, number>()
  for (const item of ranked) {
    const id = group(item.id)
    if (!merged.has(id)) merged.set(id, item.score)
  }
  return [...merged].map(([id, score]) => ({ id, score }))
}
