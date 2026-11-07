/** Wheel events closer together than this are one gesture (a flick, or a trackpad's momentum). */
export const GESTURE_GAP_MS = 300

/** Who a wheel gesture scrolls: the page, or the panel it started over. */
export type WheelGesture = { owner: 'page' | 'panel'; last: number }

/**
 * A wheel gesture keeps the owner it started with: scrolling the page past a scrolling panel does not get caught in it, and a
 * gesture begun on the panel (the pointer resting there, after a pause) scrolls the panel.
 */
export function nextWheelGesture(previous: WheelGesture | null, now: number, overPanel: boolean): WheelGesture {
  if (previous && now - previous.last < GESTURE_GAP_MS) return { owner: previous.owner, last: now }
  return { owner: overPanel ? 'panel' : 'page', last: now }
}

/** A wheel delta in pixels (deltaMode 0 pixels, 1 lines, 2 pages). */
export function wheelPixels(delta: number, mode: number, pageHeight: number): number {
  return mode === 1 ? delta * 16 : mode === 2 ? delta * pageHeight : delta
}
