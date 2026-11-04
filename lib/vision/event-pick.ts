import type { ChoiceBox } from './ocr-match'

/**
 * Which ? room option was clicked, from where the cursor was while the choice list was up. A quick click can be over
 * before the next screen read, so the list's buttons (placed from their text lines) and the cursor (read every ~150 ms)
 * are kept, and when the list goes the last button the cursor was on is taken (the click leaves it there). Whether the
 * button was down is not used: at the 10 to 20 px a shared window leaves the cursor, the two pictures are told apart
 * badly (a resting cursor read as pressed in the live test, 2026-11-04).
 *
 * Measured on the game's choice list at 1920×1080 (2026-11-04): a button is 733×173 (the last one cut by the list's
 * scroll), its name line starts 77 px right of and 51 px below its top-left; the UI scales with min(width / 1920,
 * height / 1080).
 */
export interface ChoiceBand { choiceId: string; left: number; top: number; right: number; bottom: number }
export interface CursorSample { at: number; x: number; y: number; pressed: boolean }
/** `list`: the game left the taken option alone on screen (its result page); `cursor`: where the cursor clicked or rested. */
export interface EventPick { choiceId: string; at: number; via: 'list' | 'cursor' }

/** The result page's header (the list shows "선택지" over it): one option under it is the option taken. */
export const RESULT_HEADERS: ReadonlySet<string> = new Set(['결과', 'Result', 'Results', '結果'])

/**
 * One box per text line: an option with several result rows has a row (a choice id) each with the same name, read from
 * the same line; the first stands for them (any row names the option).
 */
export function distinctBoxes(boxes: readonly ChoiceBox[]): ChoiceBox[] {
  return boxes.filter((box, i) => !boxes.slice(0, i).some(other => Math.abs(other.left - box.left) < 2 && Math.abs(other.top - box.top) < 2))
}

/** Buttons in the frame's pixels from their name lines (`boxes` in the OCR frame's pixels, `ocrScale` = OCR / frame). */
export function choiceBands(boxes: readonly ChoiceBox[], width: number, height: number, ocrScale = 1): ChoiceBand[] {
  const s = Math.min(width / 1920, height / 1080)
  return boxes.map(box => {
    const left = box.left / ocrScale - 77 * s, top = box.top / ocrScale - 51 * s
    return { choiceId: box.choiceId, left, top, right: left + 733 * s, bottom: top + 173 * s }
  })
}

export interface PickState {
  /** `choiceId` null: the cursor was off every button then (passing over one on the way to another is no pick). */
  bands: ChoiceBand[]; shownAt: number; hits: { choiceId: string | null; at: number; pressed: boolean }[]; misses: number
  /** One option of the list read alone this many times in a row (the game keeps only the taken one). */
  alone?: { choiceId: string; reads: number }
}
export const EMPTY_PICK: PickState = { bands: [], shownAt: 0, hits: [], misses: 0 }

/**
 * A read with choices on screen. A list of other choices starts over. One option read alone is the option taken: at once
 * under the result page's header (`options`: the event has that many readable options; a quick click can bring the
 * result page before any read of the whole list), else, after the whole list was read, when read alone twice in a row
 * (one read may drop a line).
 */
export function listShown(state: PickState, bands: readonly ChoiceBand[], at: number, { resultPage = false, options = 0 } = {}): { state: PickState; pick: EventPick | null } {
  if (!bands.length) return { state, pick: null }
  const same = state.bands.length > 0 && bands.some(band => state.bands.some(old => old.choiceId === band.choiceId))
  // the list slides in one option at a time: a lone option is the one taken only under the result header, or after the
  // whole list was read (one option of several, read twice in a row while sliding in, was taken for the pick)
  if (bands.length === 1 && options > 1 && resultPage) return { state: EMPTY_PICK, pick: { choiceId: bands[0].choiceId, at, via: 'list' } }
  if (bands.length === 1 && same && state.bands.length > 1) {
    const reads = state.alone?.choiceId === bands[0].choiceId ? state.alone.reads + 1 : 1
    if (reads >= 2) return { state: EMPTY_PICK, pick: { choiceId: bands[0].choiceId, at, via: 'list' } }
    return { state: { ...state, alone: { choiceId: bands[0].choiceId, reads }, misses: 0 }, pick: null }
  }
  return { state: { bands: [...bands], shownAt: at, hits: same ? state.hits : [], misses: 0 }, pick: null }
}

/** A cursor reading while a list shown in the last 3 s is up: the button it is on, or none. */
export function cursorSeen(state: PickState, sample: CursorSample): PickState {
  if (!state.bands.length || sample.at - state.shownAt > 3000) return state
  const band = state.bands.find(item => sample.x >= item.left && sample.x <= item.right && sample.y >= item.top && sample.y <= item.bottom)
  return { ...state, hits: [...state.hits.slice(-40), { choiceId: band?.choiceId ?? null, at: sample.at, pressed: sample.pressed }] }
}

/**
 * A read without the list (`gone`: the list left the screen, e.g. the screen changed). Two such reads in a row, or a
 * screen change, settle it: the pick and a fresh state.
 */
export function listMissing(state: PickState, at: number, gone = false): { state: PickState; pick: EventPick | null } {
  if (!state.bands.length && !state.alone) return { state, pick: null }
  if (!gone && state.misses < 1) return { state: { ...state, misses: state.misses + 1 }, pick: null }
  // the result page read once (its option alone) before the room went on: that option, before the cursor
  if (state.alone) return { state: EMPTY_PICK, pick: { choiceId: state.alone.choiceId, at, via: 'list' } }
  // where the cursor was last: a button, or off them all (then an option without a readable line may have been clicked)
  const last = state.hits.at(-1)
  return { state: EMPTY_PICK, pick: last?.choiceId ? { choiceId: last.choiceId, at, via: 'cursor' } : null }
}
