import type { ShelfRegion } from './shop-shelf'

/**
 * The Mirror Dungeon's bottom bar: the twelve deployed Identities, left to right in deployment order. At 1920×1080 the
 * slots are 147 px squares centred at these x, 101.5 px above the bottom; the bar keeps to the bottom edge and scales with
 * the width (labelled at 1280×720, 1440×1080 and 1920×1080, 2026-11-04).
 */
const BAR_X = [149.5, 264.5, 379.5, 494.5, 609.5, 725.5, 840.5, 955.5, 1070.5, 1185.5, 1301.5, 1416.5]
const BAR_FROM_BOTTOM = 101.5
const BAR_SIDE = 147

/** The twelve slots in frame pixels (a window's title bar is above and does not move them). */
export function formationBarRegions(width: number, height: number): ShelfRegion[] {
  const scale = width / 1920
  return BAR_X.map(x => ({ x: x * scale, y: height - BAR_FROM_BOTTOM * scale, size: BAR_SIDE * scale }))
}

/**
 * public/models/assist-scene/portrait-index.json (pipeline: portrait_index.py): every Identity's profile art (normal, and
 * gacksung for uptie 3 and up) as the bar shows it. A slot shows the whole profile at the middle `1 - 2 × inset` of its
 * square; `mask` lists the pixels compared (a disc of the face, above the HP / SP numbers) of that, at `side` px.
 */
export interface PortraitIndex { side: number; inset: number; mask: number[]; keys: { id: string; art: string }[]; refs: Float32Array }

export function decodePortraitIndex(value: unknown): PortraitIndex | null {
  const raw = value as { side?: unknown; inset?: unknown; mask?: unknown; entries?: unknown }
  if (typeof raw?.side !== 'number' || typeof raw.inset !== 'number' || !Array.isArray(raw.mask) || !Array.isArray(raw.entries)) return null
  const mask = raw.mask.filter((item): item is number => Number.isInteger(item))
  const length = mask.length * 3
  const entries = raw.entries.filter((entry): entry is { id: string; art: string; px: string } =>
    typeof entry?.id === 'string' && typeof entry?.art === 'string' && typeof entry?.px === 'string')
  const refs = new Float32Array(entries.length * length)
  entries.forEach((entry, row) => {
    const bytes = Uint8Array.from(atob(entry.px), char => char.charCodeAt(0))
    if (bytes.length === length) refs.set(normalised(bytes), row * length)
  })
  return { side: raw.side, inset: raw.inset, mask, keys: entries.map(({ id, art }) => ({ id, art })), refs }
}

/** RGB values with each channel's mean taken away, scaled to length 1 (brightness and contrast left out). */
export function normalised(rgb: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgb.length)
  const mean = [0, 0, 0]
  for (let at = 0; at < rgb.length; at++) mean[at % 3] += rgb[at]
  for (let c = 0; c < 3; c++) mean[c] /= rgb.length / 3
  let norm = 0
  for (let at = 0; at < rgb.length; at++) { out[at] = rgb[at] - mean[at % 3]; norm += out[at] * out[at] }
  norm = Math.sqrt(norm) + 1e-6
  for (let at = 0; at < out.length; at++) out[at] /= norm
  return out
}

/** The compared pixels of a slot's sample (RGBA, side × side, of the slot's middle) as RGB. */
export function shownPixels(rgba: Uint8ClampedArray, mask: readonly number[]): Uint8Array {
  const out = new Uint8Array(mask.length * 3)
  mask.forEach((pixel, at) => { out[at * 3] = rgba[pixel * 4]; out[at * 3 + 1] = rgba[pixel * 4 + 1]; out[at * 3 + 2] = rgba[pixel * 4 + 2] })
  return out
}

export interface PortraitRead { id: string; art: string; score: number; margin: number }

/** The best Identity for a slot, with its correlation and its lead over the best other Identity. */
export function matchPortrait(index: PortraitIndex, rgb: ArrayLike<number>): PortraitRead | null {
  const length = index.mask.length * 3
  if (rgb.length !== length || !index.keys.length) return null
  const vector = normalised(rgb)
  const scores = index.keys.map((_, row) => {
    let sum = 0
    for (let at = 0, base = row * length; at < length; at++) sum += vector[at] * index.refs[base + at]
    return sum
  })
  let best = 0
  scores.forEach((score, row) => { if (score > scores[best]) best = row })
  let other = -1
  scores.forEach((score, row) => { if (index.keys[row].id !== index.keys[best].id && score > other) other = score })
  return { ...index.keys[best], score: scores[best], margin: scores[best] - other }
}

/**
 * The Identity a slot is read as, or null: a correlation of 0.6 and a lead of 0.05 over every other Identity. On the
 * labelled bar samples every right read scored over 0.63; the lead is what keeps two near-alike arts from being named.
 */
export const PORTRAIT_MIN_SCORE = 0.6
export const PORTRAIT_MIN_MARGIN = 0.05
export const portraitId = (read: PortraitRead | null) => read && read.score >= PORTRAIT_MIN_SCORE && read.margin >= PORTRAIT_MIN_MARGIN ? read.id : null

export interface FormationRead { ids: (string | null)[]; observedAt: number }
