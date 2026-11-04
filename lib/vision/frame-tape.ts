/**
 * The capture's last seconds, kept so a moment the live reads missed can be read afterwards: a dialog up for a fraction
 * of a second, a result page left before it was read, a frame blurred by a quick click. Frames come every 100 ms
 * (a dialog shown that long is on one), scaled to TAPE_WIDTH and kept as JPEG in memory only (15 s are about 9 MB;
 * nothing is written to disk). Each carries a sharpness, so a re-read takes the clearest frame of each moment.
 */
export const TAPE_MS = 15_000
export const TAPE_EVERY_MS = 100
export const TAPE_WIDTH = 960

export interface TapeEntry { at: number; sharpness: number }

/**
 * Variance of the 4-neighbour Laplacian over grey levels: high for a sharp frame, low for one blurred by motion or a
 * transition (the same measure as the usual "variance of the Laplacian" blur test).
 */
export function sharpness(grey: ArrayLike<number>, width: number, height: number): number {
  let sum = 0, squares = 0, count = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    const value = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - width] - grey[i + width]
    sum += value; squares += value * value; count++
  }
  return count ? squares / count - (sum / count) ** 2 : 0
}

/**
 * Which kept frames to read again for [from, to]: the sharpest of each `bucketMs` slice of it, at most `max` of them
 * (the sharpest slices when there are more), in time order.
 */
export function pickFrames<T extends TapeEntry>(entries: readonly T[], from: number, to: number, max: number, bucketMs = 300): T[] {
  const best = new Map<number, T>()
  for (const entry of entries) {
    if (entry.at < from || entry.at > to) continue
    const slice = Math.floor((entry.at - from) / bucketMs)
    const held = best.get(slice)
    if (!held || entry.sharpness > held.sharpness) best.set(slice, entry)
  }
  return [...best.values()].sort((a, b) => b.sharpness - a.sharpness).slice(0, Math.max(0, max)).sort((a, b) => a.at - b.at)
}

/** Entries kept at `now`: the last TAPE_MS. */
export function keptEntries<T extends TapeEntry>(entries: readonly T[], now: number): T[] {
  return entries.filter(entry => now - entry.at <= TAPE_MS)
}
