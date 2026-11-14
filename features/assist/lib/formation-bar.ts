import type { ShelfRegion } from './shop-shelf'

/**
 * The Mirror Dungeon's bottom bar: the twelve deployed Identities, left to right in deployment order. At 1920×1080 the
 * slots are 147 px squares centred at these x, 101.5 px above the bottom; the bar keeps to the bottom edge and scales with
 * the width (labelled at 1280×720, 1440×1080 and 1920×1080, 2026-11-04).
 */
const BAR_X = [149.5, 264.5, 379.5, 494.5, 609.5, 725.5, 840.5, 955.5, 1070.5, 1185.5, 1301.5, 1416.5]
const BAR_FROM_BOTTOM = 101.5
const BAR_SIDE = 147

/**
 * The twelve slots in frame pixels (a window's title bar is above and does not move them). `shift`: the bar's offset in
 * UI units on this screen (the shop's bar is at 0; the formation screen before a fight draws it about 16 to the right,
 * measured 2026-11-04 on a real 1529-wide windowed capture), found by `formationBarShift`.
 */
export function formationBarRegions(width: number, height: number, shift = 0): ShelfRegion[] {
  const scale = width / 1920
  return BAR_X.map(x => ({ x: (x + shift) * scale, y: height - BAR_FROM_BOTTOM * scale, size: BAR_SIDE * scale }))
}

/** Each slot's hexagonal frame is orange and 91 wide (the shop's at 1920: 103 to 194 around 148.5); its edges are this far out. */
const BAR_HEX_HALF = 45.5
/** The rows of the bar's frames, measured up from the bottom edge (UI units): the frames span 148 to 73 above it. */
export const BAR_BAND = { top: 150, bottom: 70 } as const
/** The frames' orange (RGB): bright red, middling green, little blue. */
export const isBarOrange = (r: number, g: number, b: number) => r > 190 && g > 60 && g < 130 && b < 90

/**
 * The bar's horizontal shift on this screen, in UI units: the one (−30 to 40) that puts the most orange on the twelve
 * frames' outer edges and the least just outside them (a frame's inside can be orange too). `orange[x]`: how many pixels
 * of frame column x in the bar's band are frame orange. Within 8 of the shop's place it is the shop's (0): the shop
 * samples measure −1 to 5 and read right at 0; the formation screen before a fight measures 16.
 */
export function formationBarShift(orange: ArrayLike<number>, width: number): number {
  const scale = width / 1920
  const near = (x: number) => { const at = Math.round(x * scale); let most = 0; for (let d = -2; d <= 2; d++) most = Math.max(most, orange[at + d] ?? 0); return most }
  let best = 0, bestScore = -Infinity
  for (let shift = -30; shift <= 40; shift++) {
    let score = 0
    for (const x of BAR_X) score += near(x + shift - BAR_HEX_HALF) + near(x + shift + BAR_HEX_HALF) - near(x + shift - BAR_HEX_HALF - 10) - near(x + shift + BAR_HEX_HALF + 10)
    if (score > bestScore) { bestScore = score; best = shift }
  }
  return Math.abs(best) <= 8 ? 0 : best
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
function normalised(rgb: ArrayLike<number>): Float32Array {
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

interface PortraitRead { id: string; art: string; score: number; margin: number }

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
const PORTRAIT_MIN_SCORE = 0.6
const PORTRAIT_MIN_MARGIN = 0.05
export const portraitId = (read: PortraitRead | null) => read && read.score >= PORTRAIT_MIN_SCORE && read.margin >= PORTRAIT_MIN_MARGIN ? read.id : null

export interface FormationRead { ids: (string | null)[]; observedAt: number }
