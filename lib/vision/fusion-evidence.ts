/**
 * Evidence for a completed E.G.O gift fusion. The game's confirmation dialog ("선택한 기프트 N/M … 조합하시겠습니까?")
 * shows the chosen materials in a fixed row of M slots: 3 in a normal shop, 5 in a special shop. Only materials
 * identified in those slots are ever removed.
 */
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from './popup-evidence'

const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, '')

/**
 * The fusion screen's "E.G.O 기프트 합성" title, also read under its dialog and result popups. The E.G.O prefix (OCR often
 * reads O as 0) keeps the shop's two-line "기프트 / 합성" button out.
 */
export const showsFusionTitle = (text: string) => /E\.?G\.?[O0]\.?기프트합성/i.test(normalized(text))

/** How long a read of that title keeps the fusion screen on after the capture it came from. */
export const FUSION_TITLE_KEEP_MS = 4000

/**
 * Whether the fusion screen is up: the scene classifier says so, or OCR read its title (captured at `titleAt`) moments ago.
 * The classifier learned the default brown UI and may miss the screen in another UI theme (black); the text is the same.
 */
export function onFusionScreen(label: string | null, titleAt: number, now: number): boolean {
  return label === 'fusion' || now - titleAt < FUSION_TITLE_KEEP_MS
}

export type FusionCapacity = 3 | 5
export interface FusionConfirmation { count: number; capacity: FusionCapacity }

/**
 * Selected materials and shop capacity when the fusion confirmation dialog is on screen, otherwise null. Anything but
 * 1 ≤ N ≤ M with M = 3 or 5 is a misread and never a fusion.
 */
export function fusionConfirmation(text: string): FusionConfirmation | null {
  const screen = normalized(text)
  if (!/조합하시겠습니까/.test(screen)) return null
  // GPU OCR orders lines by position, so the "N/M" line may come before or after "선택한 기프트".
  const match = /선택한기프트(\d+)\/(\d+)/.exec(screen) ?? /(\d+)\/(\d+)선택한기프트/.exec(screen)
  if (!match) return null
  const count = Number(match[1]), capacity = Number(match[2])
  if (capacity !== 3 && capacity !== 5) return null
  return count >= 1 && count <= capacity ? { count, capacity } : null
}

/**
 * Material slot centers and icon side of each dialog on a 1920×1080 game frame, measured on real recordings: the
 * normal shop's three larger slots and the special shop's five. Both dialogs share the header and question lines.
 */
const SLOT_LAYOUTS: Record<FusionCapacity, { centersX: number[]; centerY: number; side: number }> = {
  3: { centersX: [373, 697, 1021], centerY: 458, side: 180 },
  5: { centersX: [296, 490, 686, 880, 1074], centerY: 464, side: 100 },
}
const layoutFor = (count: number, capacity: number) =>
  (capacity === 3 || capacity === 5) && Number.isInteger(count) && count >= 1 && count <= capacity ? SLOT_LAYOUTS[capacity] : null

/** Slot crops for 1 ≤ count ≤ capacity (3 or 5) on a letterboxed 16:9 frame, otherwise null. */
export function fusionSlotRegions(width: number, height: number, count: number, capacity: number): { x: number; y: number; size: number }[] | null {
  const layout = layoutFor(count, capacity)
  if (!layout) return null
  const scale = Math.min(width / 1920, height / 1080)
  const left = (width - 1920 * scale) / 2, top = (height - 1080 * scale) / 2
  return layout.centersX.slice(0, count).map(x =>
    ({ x: left + x * scale, y: top + layout.centerY * scale, size: layout.side * scale }))
}

export interface TextBox { left: number; top: number; width: number; height: number }
export interface FusionAnchors { header: TextBox; question: TextBox }

/**
 * The dialog's own text lines, found by OCR: the "선택한 기프트" header and the "…조합하시겠습니까?" question.
 * Null unless both are single lines (GPU OCR); word-level reads use the frame layout instead.
 */
export function fusionAnchors(words: { text: string; left: number; top: number; width: number; height: number }[]): FusionAnchors | null {
  const header = words.find(word => { const text = normalized(word.text); return text.startsWith('선택한기프트') && !text.includes('조합') })
  const question = words.find(word => normalized(word.text).includes('조합하시겠습니까'))
  return header && question ? { header, question } : null
}

/** Dialog text positions at 1920×1080: question line center x and width, header center y and its distance to the question. */
const QUESTION_CENTER_X = 960, QUESTION_WIDTH = 704, HEADER_CENTER_Y = 284, HEADER_TO_QUESTION = 476

/**
 * Slots placed from the dialog text, so a window title bar, scaling or an off-centre game view does not move the crops.
 * Scale comes from the header-to-question distance, cross-checked with the question width; if they disagree the
 * anchors are not trusted (null).
 */
export function fusionSlotRegionsFromAnchors(anchors: FusionAnchors, count: number, capacity: number): { x: number; y: number; size: number }[] | null {
  const layout = layoutFor(count, capacity)
  if (!layout) return null
  const headerY = anchors.header.top + anchors.header.height / 2
  const questionX = anchors.question.left + anchors.question.width / 2
  const questionY = anchors.question.top + anchors.question.height / 2
  const scale = (questionY - headerY) / HEADER_TO_QUESTION
  const widthScale = anchors.question.width / QUESTION_WIDTH
  if (!(scale > 0.2) || Math.abs(scale - widthScale) > 0.2 * scale) return null
  return layout.centersX.slice(0, count).map(x => ({ x: questionX + (x - QUESTION_CENTER_X) * scale,
    y: headerY + (layout.centerY - HEADER_CENTER_Y) * scale, size: layout.side * scale }))
}

/**
 * The selection wheel of the fusion screen (before the dialog): the chosen materials sit around the result box, three
 * positions in a normal shop, five in a special shop. They stay up while the player picks, unlike the ~1 s dialog.
 * Centers and icon side measured on 1920×1080 recordings; the owned-gift list on the right is never read.
 */
const WHEEL_LAYOUTS: Record<FusionCapacity, { centers: [number, number][]; side: number }> = {
  3: { centers: [[544, 308], [337, 515], [751, 515]], side: 98 },
  5: { centers: [[554, 316], [357, 388], [746, 388], [357, 543], [746, 543]], side: 98 },
}
/** Screen text positions at 1920×1080: the "E.G.O 기프트 합성" title (center, width) and the "소원 빌기" label center. */
const TITLE_CENTER_X = 959, TITLE_CENTER_Y = 158, TITLE_WIDTH = 422, WISH_CENTER_Y = 757.5
/** Part of the 1920×1080 game view that holds every wheel position of both layouts, with room for the icon search. */
const WHEEL_BOX = { left: 250, top: 220, right: 840, bottom: 640 }

/**
 * The fusion selection screen alone: not its confirmation dialog, the starlight prompt ("별빛을 5 소모하여 … 증가시키겠습니까?")
 * or any other question over it, nor an acquisition popup.
 */
export function isFusionSelectionScreen(text: string): boolean {
  const screen = normalized(text)
  // Only the acquisition popup's own sentence excludes the screen: a shared full screen also shows the companion's
  // "이번 층 획득 가능 기프트" and "획득 …" notices, which must not hide the wheel (replay 2026-09-24: 1/30 materials).
  return /기프트합성/.test(screen) && /소원빌기|예상결과/.test(screen) && !/겠습니까|획득했습니다/.test(screen)
}

export interface WheelAnchors { title: TextBox; wish: TextBox }

/** The selection screen's title and "소원 빌기" lines, found by OCR; null unless both are single lines. */
export function fusionWheelAnchors(words: { text: string; left: number; top: number; width: number; height: number }[]): WheelAnchors | null {
  const title = words.find(word => { const text = normalized(word.text); return text.includes('기프트합성') && text.length <= 12 })
  const wish = words.find(word => normalized(word.text).startsWith('소원빌기'))
  return title && wish ? { title, wish } : null
}

/** Frame → game-view transform from the selection screen text, or the letterboxed 16:9 layout without it. */
function wheelTransform(width: number, height: number, anchors?: WheelAnchors | null) {
  if (anchors) {
    const titleX = anchors.title.left + anchors.title.width / 2, titleY = anchors.title.top + anchors.title.height / 2
    const scale = (anchors.wish.top + anchors.wish.height / 2 - titleY) / (WISH_CENTER_Y - TITLE_CENTER_Y)
    if (scale > 0.2 && Math.abs(scale - anchors.title.width / TITLE_WIDTH) <= 0.2 * scale) {
      return (x: number, y: number) => ({ x: titleX + (x - TITLE_CENTER_X) * scale, y: titleY + (y - TITLE_CENTER_Y) * scale, scale })
    }
  }
  const scale = Math.min(width / 1920, height / 1080)
  const left = (width - 1920 * scale) / 2, top = (height - 1080 * scale) / 2
  return (x: number, y: number) => ({ x: left + x * scale, y: top + y * scale, scale })
}

/** Every wheel position of a 3- or 5-slot shop (filled or empty) in frame pixels, or null for any other capacity. */
export function fusionWheelRegions(width: number, height: number, capacity: number, anchors?: WheelAnchors | null) {
  if (capacity !== 3 && capacity !== 5) return null
  const at = wheelTransform(width, height, anchors)
  return WHEEL_LAYOUTS[capacity].centers.map(([x, y]) => {
    const point = at(x, y)
    return { x: point.x, y: point.y, size: WHEEL_LAYOUTS[capacity].side * point.scale }
  })
}

/** The frame rectangle kept of each selection-screen capture: only the wheel area, clamped to the frame. */
export function fusionWheelCrop(width: number, height: number, anchors?: WheelAnchors | null) {
  const at = wheelTransform(width, height, anchors)
  const topLeft = at(WHEEL_BOX.left, WHEEL_BOX.top), bottomRight = at(WHEEL_BOX.right, WHEEL_BOX.bottom)
  const x = Math.max(0, Math.floor(topLeft.x)), y = Math.max(0, Math.floor(topLeft.y))
  return { x, y, width: Math.max(1, Math.min(width, Math.ceil(bottomRight.x)) - x),
    height: Math.max(1, Math.min(height, Math.ceil(bottomRight.y)) - y) }
}

/**
 * The result box in the middle of the wheel: its square plate (rivets, hazard ring) is on every selection screen and on no
 * dialog, popup or prompt over it. A grey WHEEL_BAND_SIZE² sample of the box (with room for a small shift) is compared on
 * the plate's outer edge only, where the box content (?, predicted result, flashes) never reaches.
 */
const WHEEL_RESULT_BOX = { x: 550, y: 518, half: 110 }
export const WHEEL_BAND_SIZE = 44
/** Selection screens measured ≥ 0.97 against another selection screen's box, dialogs/popups/prompts ≤ 0.27. */
export const WHEEL_BAND_MIN = 0.6

/** The square to sample for the result-box check, in frame pixels. */
export function fusionWheelResultBox(width: number, height: number, anchors?: WheelAnchors | null) {
  const at = wheelTransform(width, height, anchors)
  const center = at(WHEEL_RESULT_BOX.x, WHEEL_RESULT_BOX.y)
  return { x: center.x, y: center.y, size: 2 * WHEEL_RESULT_BOX.half * center.scale }
}

/**
 * How well a result-box sample matches a reference sample from a screen read as the selection screen: normalized
 * correlation over the 2-sample outer ring of a 40² window, best over shifts of up to 2 samples each way.
 */
export function wheelBandMatch(sample: ArrayLike<number>, reference: ArrayLike<number>): number {
  const size = WHEEL_BAND_SIZE, window = size - 4
  const ring: number[] = []
  for (let y = 0; y < window; y++) for (let x = 0; x < window; x++) if (y < 2 || y >= window - 2 || x < 2 || x >= window - 2) ring.push(y * size + x)
  const values = (source: ArrayLike<number>, dx: number, dy: number) => {
    const out = ring.map(at => source[at + dy * size + dx])
    const mean = out.reduce((total, value) => total + value, 0) / out.length
    return out.map(value => value - mean)
  }
  const target = values(reference, 2, 2)
  const targetNorm = Math.sqrt(target.reduce((total, value) => total + value * value, 0))
  let best = -1
  for (let dy = 0; dy <= 4; dy++) for (let dx = 0; dx <= 4; dx++) {
    const candidate = values(sample, dx, dy)
    const norm = Math.sqrt(candidate.reduce((total, value) => total + value * value, 0))
    if (!norm || !targetNorm) continue
    best = Math.max(best, candidate.reduce((total, value, index) => total + value * target[index], 0) / (norm * targetNorm))
  }
  return best
}

/** A slot's top icon (accepted or not) with its lead over the runner-up, a blank (empty, black) slot, or nothing. */
export type FusionSlotRead = { id: string; score: number; margin: number } | { blank: true } | null
/** One read of a dialog frame (slots in dialog order) or of a wheel frame (wheel positions). */
export interface FusionRead { view: 'dialog' | 'wheel'; slots: FusionSlotRead[]; observedAt: number }

const identified = (slot: FusionSlotRead): slot is { id: string; score: number; margin: number } => !!slot && 'id' in slot

/**
 * The five vestiges (어두운·아스라한·빛나는·찬란한·달의 잔영) share one bottle and differ only by grade, so a slot never tells
 * them apart (0.04–0.07 leads in the 2026-09-26 samples). They are never recorded in the inventory, so a fusion only needs
 * to know that a slot holds a vestige: all five read as FUSION_VESTIGE_ID, and one fusion may use several.
 */
export const FUSION_VESTIGE_ID = '9991'
export const vestigeGroup = (id: string) => AUTO_ACQUIRE_EXCLUDED_GIFT_IDS.has(id) ? FUSION_VESTIGE_ID : id
/** One read is enough when the icon is well above acceptance, or far ahead of every other icon (0 wrong on labelled frames). */
const strongRead = (slot: { score: number; margin: number }) =>
  (slot.score >= 0.85 && slot.margin >= 0.25) || (slot.score >= 0.75 && slot.margin >= 0.3)
const acceptedRead = (slot: { score: number; margin: number }) => slot.score >= 0.8 && slot.margin >= 0.2
/**
 * Only as one half of a wheel + dialog agreement, two independent renderings of the same material. Thin, dark icons
 * (e.g. the rose 9159) read 0.67–0.74 in both views; on labelled frames no non-empty slot read this high was wrong.
 */
const weakRead = (slot: { score: number; margin: number }) => slot.score >= 0.65 && slot.margin >= 0.1

/**
 * The material in each slot of one view, or null. Accepted reads must agree (a different accepted material leaves the
 * slot unknown); a slot confirms with one strong read, accepted reads in two frames, a weak read of a material the
 * other view also shows (`corroborated`), or, on the wheel only (`repeatedWeak`), the same weak read in two states.
 */
function viewMaterials(reads: FusionRead[], size: number, corroborated: ReadonlyMap<string, number>, repeatedWeak: boolean): (string | null)[] {
  return Array.from({ length: size }, (_, index) => {
    const seen = reads.map(read => ({ slot: read.slots[index], at: read.observedAt })).filter(item => identified(item.slot))
      .map(item => ({ slot: item.slot as { id: string; score: number; margin: number }, at: item.at }))
    const accepted = seen.filter(item => acceptedRead(item.slot) || strongRead(item.slot))
    const ids = new Set(accepted.map(item => item.slot.id))
    if (ids.size > 1) return null
    if (ids.size === 1) {
      const [id] = ids
      if (accepted.some(item => strongRead(item.slot)) || new Set(accepted.map(item => item.at)).size >= 2 || corroborated.has(id)) return id
      return null
    }
    const weakReads = seen.filter(item => weakRead(item.slot))
    const weak = new Set(weakReads.map(item => item.slot.id))
    if (weak.size !== 1) return null
    const [id] = weak
    // Across views (independent renderings: the dialog is larger and never under the cursor) one read must lead by
    // CROSS_VIEW_MARGIN.
    const other = corroborated.get(id)
    if (other !== undefined && (weakReads.some(item => item.slot.margin >= CROSS_VIEW_MARGIN) || other >= CROSS_VIEW_MARGIN)) return id
    // Within the wheel, repeats share the same rendering and occlusion (the orb 9203 under the cursor read as 9769 at
    // 0.80 / 0.16 in consecutive states): the same weak icon must lead by REPEAT_MARGIN in two states ≥ 250 ms apart.
    const times = weakReads.filter(item => item.slot.margin >= REPEAT_MARGIN).map(item => item.at)
    return repeatedWeak && times.length >= 2 && Math.max(...times) - Math.min(...times) >= 250 ? id : null
  })
}

/**
 * Leads a weak read needs to count. On every live wheel read of the labelled clips, score ≥ 0.65 with margin ≥ 0.20 was
 * never a wrong gift (90 reads) and ≥ 0.15 was twice (of 205), never with the same gift read in the dialog.
 */
const REPEAT_MARGIN = 0.2
const CROSS_VIEW_MARGIN = 0.15

/** Materials a view shows at least weakly (top icon clearly ahead) with their largest lead, for the other view. */
function weaklySeen(reads: FusionRead[]): Map<string, number> {
  const seen = new Map<string, number>()
  for (const slot of reads.flatMap(read => read.slots.filter(identified).filter(weakRead))) seen.set(slot.id, Math.max(seen.get(slot.id) ?? 0, slot.margin))
  return seen
}

/**
 * Materials of one confirmation dialog (`count` selected, shop `capacity`), from its wheel reads (taken before the
 * dialog) and its dialog reads. The two views are combined as a multiset (a material seen in both counts once); if
 * together they name more than `count` materials, the wheel frames showed another selection (changed or cancelled
 * before) and only the dialog's own materials are kept. Unknown slots are simply left out.
 */
export function fusionMaterials(reads: FusionRead[], count: number, capacity: number): string[] {
  // A gift is selected once: a read naming one gift in two slots is of something else (a texture read as the same icon).
  // Vestiges are the exception: a player holds several and fuses them together.
  const plausible = reads.filter(read => {
    const ids = read.slots.filter(identified).filter(weakRead).map(slot => slot.id).filter(id => id !== FUSION_VESTIGE_ID)
    return new Set(ids).size === ids.length
  })
  const wheelReads = plausible.filter(read => read.view === 'wheel'), dialogReads = plausible.filter(read => read.view === 'dialog')
  const wheel = viewMaterials(wheelReads, capacity, weaklySeen(dialogReads), true).filter((id): id is string => id !== null)
  const dialog = viewMaterials(dialogReads, count, weaklySeen(wheelReads), false).filter((id): id is string => id !== null)
  const combined = [...wheel]
  for (const id of new Set(dialog)) {
    const missing = dialog.filter(item => item === id).length - combined.filter(item => item === id).length
    for (let index = 0; index < missing; index++) combined.push(id)
  }
  return combined.length <= count ? combined : dialog.length <= count ? dialog : []
}

/**
 * Evidence of one confirmation dialog: the confirmed materials, first read, last time the dialog was on screen and, if
 * seen, when it had closed without a result (a later screen showing neither the dialog nor an acquisition popup).
 */
export interface FusionDialogEvidence { materials: string[]; observedAt: number; lastSeenAt: number; closedAt?: number }

/** Minimum time after the dialog was last seen for a screen without dialog or popup to mean it closed without a result. */
export const FUSION_CLOSED_AFTER_MS = 800

/**
 * Whether a screen read at `at` shows the dialog closed without a result. The result popup follows the dialog within
 * about 0.25 s of closing and the dialog closes within one read interval (0.4 s on the fusion screen) of being last
 * seen, so a read 0.8 s later without the dialog or an acquisition popup cannot fall in that gap.
 */
export function fusionDialogClosed(text: string, at: number, lastSeenAt: number): boolean {
  return at - lastSeenAt >= FUSION_CLOSED_AFTER_MS && !/조합하시겠습니까|획득/.test(normalized(text))
}

/**
 * Whether an acquisition is that dialog's result: the result popup follows the dialog at once (well under a second in
 * recordings), so a gift captured seconds after the dialog was last seen, or after the dialog closed without a result
 * (cancelled, then a purchase), is not.
 */
export function fusionResultFollows(evidence: FusionDialogEvidence, capturedAt: number | undefined): boolean {
  return capturedAt !== undefined && capturedAt >= evidence.observedAt && capturedAt - evidence.lastSeenAt <= 4000 &&
    (evidence.closedAt === undefined || capturedAt < evidence.closedAt)
}

/**
 * Whether an acquisition that no seen confirmation dialog explains was a fusion result: the dialog can be up for ~0.3 s,
 * between two screen reads. It counts only when the screen read just before it (at most 3 s earlier) and the first one
 * after it both show the fusion screen, since a purchase happens on the shop screen.
 */
export function dialoglessFusionResult(capturedAt: number, previous: { at: number; fusion: boolean } | undefined,
  next: { at: number; fusion: boolean }, explainedByDialog: boolean): boolean {
  return !explainedByDialog && next.at > capturedAt && next.fusion && !!previous && previous.fusion && previous.at < capturedAt &&
    capturedAt - previous.at <= 3000
}

/** A confirmation dialog as seen by screen reads, and the acquisition taken as its result, if any. */
export interface SeenDialog { firstAt: number; lastSeenAt: number; closedAt?: number; resultAt?: number }

/**
 * The seen dialog an acquisition captured at `capturedAt` is the result of: the latest one without a result yet that
 * opened before it and was last seen at most 4 s before it (and had not closed without a result), or null.
 */
export function dialogForResult(dialogs: SeenDialog[], capturedAt: number): SeenDialog | null {
  return dialogs.filter(dialog => dialog.resultAt === undefined && dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000 &&
    (dialog.closedAt === undefined || capturedAt < dialog.closedAt)).at(-1) ?? null
}

/**
 * Whether a confirmation dialog read in a frame captured at `at` is the dialog already being read rather than the next
 * fusion. Rapid fusions reopen a dialog with the same N/M within a second, so besides the same N/M seen within 2 s nothing
 * captured in between may show that dialog ended: its result popup (`resultAt`) or a screen read showing the selection
 * screen or an acquisition popup without the dialog (`breakAt`, the latest such capture).
 */
export function continuesFusionDialog(dialog: { count: number; capacity: number; lastSeenAt: number; closedAt?: number; resultAt?: number },
  count: number, capacity: number, at: number, breakAt: number): boolean {
  return dialog.closedAt === undefined && dialog.count === count && dialog.capacity === capacity && at - dialog.lastSeenAt < 2000 &&
    !(dialog.resultAt !== undefined && dialog.resultAt < at) && !(breakAt > dialog.lastSeenAt && breakAt < at)
}

/**
 * The fusion an acquisition captured at `capturedAt` belongs to: the latest one confirmed before it in capture time that it
 * may be the result of. Once that fusion is applied, later popups (e.g. a material a blessing returned) are extra results of
 * it and never reach back to an older fusion, so the caller checks whether the returned fusion was already applied.
 */
export function fusionForResult<T extends FusionDialogEvidence>(fusions: readonly T[], capturedAt: number | undefined): T | null {
  return fusions.filter(fusion => fusionResultFollows(fusion, capturedAt)).sort((first, second) => first.observedAt - second.observedAt).at(-1) ?? null
}

/**
 * Popups skipped because their gift was still listed that a fusion's removal made real acquisitions: a removed material
 * whose popup follows that fusion came back with the result (a blessing returning a material), once per removed copy.
 */
export function returnedMaterials<T extends { giftId: string; capturedAt?: number }>(fusion: FusionDialogEvidence, removed: readonly string[],
  listed: readonly T[]): T[] {
  const left = [...removed]
  return listed.filter(popup => {
    const index = left.indexOf(popup.giftId)
    if (index < 0 || !fusionResultFollows(fusion, popup.capturedAt)) return false
    left.splice(index, 1)
    return true
  })
}

/** How long apart two popups of one gift may be captured and still be the same popup (split into two episodes). */
export const SAME_ACQUISITION_MS = 5000

/**
 * The number of an acquisition of a gift confirmed from popup `episode` captured at `capturedAt`, given its latest earlier
 * one. Frames of one popup keep its number however late they are read; another episode is the same popup only if captured
 * within SAME_ACQUISITION_MS with nothing between that ends it: a fusion dialog opening or another gift's popup (`boundaries`,
 * capture times). A material a blessing returns fusion after fusion is a new acquisition each time.
 */
export function acquisitionSeq(seen: { at: number; seq: number; episode: number } | undefined, episode: number, capturedAt: number,
  boundaries: readonly number[]): number {
  if (!seen) return 1
  if (seen.episode === episode) return seen.seq
  const from = Math.min(seen.at, capturedAt), to = Math.max(seen.at, capturedAt)
  return to - from < SAME_ACQUISITION_MS && !boundaries.some(at => at > from && at < to) ? seen.seq : seen.seq + 1
}

/** Longest a confirmed acquisition waits for an earlier popup still being read. */
export const ACQUISITION_ORDER_WAIT_MS = 2500

/**
 * Confirmed acquisitions to publish now, in capture order (popup episodes are numbered as they appear on screen): OCR and
 * icon reads finish out of order, so one waits while a popup captured before it (`unsettled` episodes) is still being read,
 * at most ACQUISITION_ORDER_WAIT_MS after it was confirmed (`observedAt`). A material returned by one fusion then reaches
 * the run before the next fusion consumes it.
 */
export function acquisitionsToRelease<T extends { observedAt: number; episode?: number }>(held: readonly T[], unsettled: readonly number[],
  now: number): { release: T[]; keep: T[] } {
  const sorted = [...held].sort((first, second) => (first.episode ?? 0) - (second.episode ?? 0))
  const blocked = sorted.findIndex(item => item.episode !== undefined && now - item.observedAt < ACQUISITION_ORDER_WAIT_MS &&
    unsettled.some(episode => episode < item.episode!))
  return blocked < 0 ? { release: sorted, keep: [] } : { release: sorted.slice(0, blocked), keep: sorted.slice(blocked) }
}

/**
 * Materials to remove for a confirmed fusion, or null when the inventory cannot be reconciled with certainty.
 * Excluded ids (vestiges, never registered automatically) are skipped when absent; any other material that is not in
 * the inventory means the inventory is uncertain, so nothing is removed and only the result is acquired.
 */
export function fusionMaterialsToRemove(materials: string[], inventory: string[], excluded: ReadonlySet<string>): string[] | null {
  const remaining = [...inventory]
  const remove: string[] = []
  for (const id of materials) {
    const index = remaining.indexOf(id)
    if (index >= 0) { remaining.splice(index, 1); remove.push(id); continue }
    if (!excluded.has(id)) return null
  }
  return remove
}
