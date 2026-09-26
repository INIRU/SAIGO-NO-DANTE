import type { PopupLabelBox } from './popup-detect'

/** One catalog icon, sampled at `size` px: its opaque pixels as a zero-mean, unit-length RGB vector. */
export interface IconTemplate { id: string; size: number; mask: Uint8Array; vector: Float32Array; count: number }

/** Accepted only when clearly ahead of every other icon; measured wrong matches stayed below these. */
export const ICON_MATCH_MIN = 0.8
export const ICON_MATCH_MARGIN = 0.2
const OPAQUE = 160

export function iconTemplate(id: string, rgba: Uint8ClampedArray, size: number): IconTemplate {
  const mask = new Uint8Array(size * size)
  const values: number[] = []
  for (let pixel = 0; pixel < size * size; pixel++) {
    if (rgba[pixel * 4 + 3] <= OPAQUE) continue
    mask[pixel] = 1
    values.push(rgba[pixel * 4], rgba[pixel * 4 + 1], rgba[pixel * 4 + 2])
  }
  const mean = values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
  const vector = new Float32Array(values.length)
  let norm = 0
  for (let index = 0; index < values.length; index++) {
    vector[index] = values[index] - mean
    norm += vector[index] * vector[index]
  }
  norm = Math.sqrt(norm) || 1
  for (let index = 0; index < vector.length; index++) vector[index] /= norm
  return { id, size, mask, vector, count: values.length }
}

/** Byte offsets of a template's opaque pixels inside a square RGBA query of `querySize`, cached per query size. */
const offsetCache = new WeakMap<IconTemplate, Map<number, Int32Array>>()
function opaqueOffsets(template: IconTemplate, querySize: number): Int32Array {
  let bySize = offsetCache.get(template)
  if (!bySize) { bySize = new Map(); offsetCache.set(template, bySize) }
  let offsets = bySize.get(querySize)
  if (!offsets) {
    offsets = new Int32Array(template.count / 3)
    let index = 0
    for (let y = 0; y < template.size; y++) for (let x = 0; x < template.size; x++) {
      if (template.mask[y * template.size + x]) offsets[index++] = (y * querySize + x) * 4
    }
    bySize.set(querySize, offsets)
  }
  return offsets
}

/** Masked zero-mean normalized correlation of a template placed at (left, top) in a square RGBA query. */
export function templateScore(template: IconTemplate, query: Uint8ClampedArray, querySize: number, left: number, top: number): number {
  if (template.count < 30) return 0
  const offsets = opaqueOffsets(template, querySize)
  const vector = template.vector
  const base = (top * querySize + left) * 4
  let dot = 0, sum = 0, squares = 0
  for (let pixel = 0, index = 0; pixel < offsets.length; pixel++, index += 3) {
    const at = base + offsets[pixel]
    const red = query[at], green = query[at + 1], blue = query[at + 2]
    dot += vector[index] * red
    dot += vector[index + 1] * green
    dot += vector[index + 2] * blue
    sum += red + green + blue
    squares += red * red + green * green + blue * blue
  }
  const variance = squares - sum * sum / template.count
  return variance > 1e-6 ? dot / Math.sqrt(variance) : 0
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
  label: PopupLabelBox, coarse: IconTemplate[], fine: Map<string, IconTemplate>): { id: string; score: number }[] {
  return rankIconsInRegion(sample, popupArtworkRegion(label), coarse, fine)
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

/** Best-matching icons for a square artwork region (center and side in frame pixels), e.g. a fusion material slot. */
export function rankIconsInRegion(sample: (x: number, y: number, span: number, size: number) => Uint8ClampedArray,
  art: { x: number; y: number; size: number }, coarse: IconTemplate[], fine: Map<string, IconTemplate>): { id: string; score: number }[] {
  if (!coarse.length) return []
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
