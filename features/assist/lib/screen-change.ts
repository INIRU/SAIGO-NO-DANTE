/**
 * A screen change worth reading at once: the mean grey difference of two 32×18 thumbnails of the capture. A dialog that
 * is up for under a second (fusion and sale confirmations) can fall between timed reads; the read starts when it
 * appears instead (screencast work segments video by frame differencing the same way: SeeAction, ICSE 2025).
 *
 * Measured on labelled Mirror Dungeon runs recorded at ~9 frames a second (2026-11-04): every dialog appearing (14)
 * differed by 5.8 or more; 96% of other frame pairs by 0, and 2.8% by more than 4.
 */
export const SCREEN_CHANGE = 4
export const THUMB_WIDTH = 32, THUMB_HEIGHT = 18

/** Grey levels (0-255) of an RGBA thumbnail. */
export function greyThumb(rgba: ArrayLike<number>): Float32Array {
  const grey = new Float32Array(rgba.length / 4)
  for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return grey
}

/** Mean absolute difference of two thumbnails of the same size (Infinity when they are not). */
export function thumbDifference(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}
