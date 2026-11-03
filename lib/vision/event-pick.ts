import type { ChoiceBox } from './ocr-match'

/**
 * Which ? room option was clicked, from where the cursor was while the choice list was up. A quick click can be over
 * before the next screen read, so the list's buttons (placed from their text lines) and the cursor (read every ~150 ms)
 * are kept, and when the list goes the last press on a button, or else the last button the cursor rested on, is taken.
 *
 * Measured on the game's choice list at 1920×1080 (2026-11-04): a button is 733×173 (the last one cut by the list's
 * scroll), its name line starts 77 px right of and 51 px below its top-left; the UI scales with min(width / 1920,
 * height / 1080).
 */
export interface ChoiceBand { choiceId: string; left: number; top: number; right: number; bottom: number }
export interface CursorSample { at: number; x: number; y: number; pressed: boolean }
export interface EventPick { choiceId: string; at: number }

/** Buttons in the frame's pixels from their name lines (`boxes` in the OCR frame's pixels, `ocrScale` = OCR / frame). */
export function choiceBands(boxes: readonly ChoiceBox[], width: number, height: number, ocrScale = 1): ChoiceBand[] {
  const s = Math.min(width / 1920, height / 1080)
  return boxes.map(box => {
    const left = box.left / ocrScale - 77 * s, top = box.top / ocrScale - 51 * s
    return { choiceId: box.choiceId, left, top, right: left + 733 * s, bottom: top + 173 * s }
  })
}

export interface PickState { bands: ChoiceBand[]; shownAt: number; hits: { choiceId: string; at: number; pressed: boolean }[]; misses: number }
export const EMPTY_PICK: PickState = { bands: [], shownAt: 0, hits: [], misses: 0 }

/** A read with the list on screen: its buttons now (a list of other choices starts over). */
export function listShown(state: PickState, bands: readonly ChoiceBand[], at: number): PickState {
  if (!bands.length) return state
  const same = state.bands.length && bands.some(band => state.bands.some(old => old.choiceId === band.choiceId))
  return { bands: [...bands], shownAt: at, hits: same ? state.hits : [], misses: 0 }
}

/** A cursor reading: kept when it is on a button of the list shown in the last 3 s. */
export function cursorSeen(state: PickState, sample: CursorSample): PickState {
  if (!state.bands.length || sample.at - state.shownAt > 3000) return state
  const band = state.bands.find(item => sample.x >= item.left && sample.x <= item.right && sample.y >= item.top && sample.y <= item.bottom)
  return band ? { ...state, hits: [...state.hits.slice(-40), { choiceId: band.choiceId, at: sample.at, pressed: sample.pressed }] } : state
}

/**
 * A read without the list (`gone`: the list left the screen, e.g. the screen changed). Two such reads in a row, or a
 * screen change, settle it: the pick and a fresh state.
 */
export function listMissing(state: PickState, at: number, gone = false): { state: PickState; pick: EventPick | null } {
  if (!state.bands.length) return { state, pick: null }
  if (!gone && state.misses < 1) return { state: { ...state, misses: state.misses + 1 }, pick: null }
  const pressed = state.hits.filter(hit => hit.pressed)
  const last = (pressed.length ? pressed : state.hits).at(-1)
  return { state: EMPTY_PICK, pick: last ? { choiceId: last.choiceId, at } : null }
}
