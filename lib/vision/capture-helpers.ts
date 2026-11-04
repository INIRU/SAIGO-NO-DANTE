/**
 * The Assist capture hook's pure parts (lib/hooks/useAssistCapture.ts): parsing the scene worker's answers (fusion slots,
 * shop shelf, visual matches), the fusion wheel's frame bookkeeping, the frame task timing, the text reader's failure and
 * rebuild policy, and the device checks. No React and no state: each can be tested on its own.
 */
import type { VisualMatch } from '@/lib/vision/embedding-match'
import { type PopupLabelRead } from '@/lib/vision/popup-evidence'
import type { ShopSlotRead } from '@/lib/vision/shop-shelf'
import { isMobileDevice, webgpuBlock, type GpuBlock } from '@/lib/vision/device'
import { type SkillExchangeRead } from '@/lib/vision/skill-exchange'
import { wheelBandMatch, WHEEL_BAND_MIN, WHEEL_BAND_SIZE, type FusionRead, type WheelAnchors, type FusionSlotRead } from '@/lib/vision/fusion-evidence'
import { type ExplorationObservation } from '@/lib/vision/exploration-match'
import { type PopupLabelBox } from '@/lib/vision/popup-detect'

/**
 * A crop of the selection wheel: `origin` is its corner in the captured frame of `frameSize`. Identical-looking crops are
 * kept once (`at` first seen, `lastAt` last seen), so the ring holds distinct wheel states rather than repeats.
 */
export interface WheelFrame { frame: ImageBitmap; at: number; lastAt: number; signature: Uint8Array; band: Float32Array | null;
  origin: { x: number; y: number }; scale: number; frameSize: { width: number; height: number }; anchors?: WheelAnchors;
  reads: Partial<Record<number, FusionRead>>; shown?: boolean }
/** Slot reads from the scene worker: an icon with its score and lead, a blank slot, or nothing; null unless `size` long. */
export function parseFusionSlots(raw: unknown, size: number): FusionSlotRead[] | null {
  if (!Array.isArray(raw) || raw.length !== size) return null
  return raw.map((slot): FusionSlotRead => {
    if (slot && (slot as { blank?: unknown }).blank === true) return { blank: true }
    const read = slot as { id?: unknown; score?: unknown; margin?: unknown } | null
    return read && typeof read.id === 'string' && typeof read.score === 'number' && Number.isFinite(read.score) &&
      typeof read.margin === 'number' && Number.isFinite(read.margin) ? { id: read.id, score: read.score, margin: read.margin } : null
  })
}
// Distinct states kept (animations make many); crops at most WHEEL_CROP_WIDTH wide (about 1 MB each). A slow GPU reads the
// result popup 3-4 s after it was captured and the result animation adds new states meanwhile, so the states just before the
// result must outlive both (16 states / 4 s dropped them before the result arrived, 2026-09-28 replays).
export const WHEEL_FRAMES = 40
export const WHEEL_KEEP_MS = 8000
export const WHEEL_CROP_WIDTH = 640
/** Wheel states read per dialog and how long after an earlier dialog a crop may belong to a new one. */
export const WHEEL_READS = 6
export const WHEEL_AFTER_DIALOG_MS = 800
/** The dialog can already be up this long before OCR first sees it (the late states below). */
export const WHEEL_BEFORE_DIALOG_MS = 450
/**
 * Reading order of the wheel states before a dialog (or a result without one) first seen at `end`: the newest state
 * certainly before it, then the late states oldest first (the complete wheel, often up only ~0.3 s, comes before the
 * dialog's own opening frames), then older states.
 */
export function wheelReadOrder(states: WheelFrame[], end: number, lateMs: number): WheelFrame[] {
  const settled = states.filter(item => item.at <= end - lateMs).sort((first, second) => second.at - first.at)
  const late = states.filter(item => item.at > end - lateMs).sort((first, second) => first.at - second.at)
  return [...settled.slice(0, 1), ...late, ...settled.slice(1)].slice(0, WHEEL_READS)
}
/** Wheel states taken for a result without a seen dialog: last seen within this before the result popup. */
export const DIALOGLESS_WHEEL_MS = 3000
/** How long the shop capacity of a dialog is assumed for later dialog-less results of the same session. */
export const CAPACITY_KEEP_MS = 15 * 60_000
/** A 16×9 grey signature of a crop (analysis only, never shown), for telling a changed wheel from the same one. */
export const wheelSignature = (() => {
  let context: OffscreenCanvasRenderingContext2D | null = null
  return (frame: ImageBitmap) => {
    context ??= new OffscreenCanvas(16, 9).getContext('2d', { willReadFrequently: true })
    if (!context) return new Uint8Array(0)
    context.drawImage(frame, 0, 0, 16, 9)
    const pixels = context.getImageData(0, 0, 16, 9).data
    const grey = new Uint8Array(16 * 9)
    for (let index = 0; index < grey.length; index++) grey[index] = (pixels[index * 4] + pixels[index * 4 + 1] + pixels[index * 4 + 2]) / 3
    return grey
  }
})()
/**
 * A crop that shows the selection screen (its result box matches the reference), not something over the wheel. Once it
 * has matched a reference it stays accepted when a later reference is taken.
 */
export const showsWheel = (item: WheelFrame, reference: Float32Array | null) => {
  if (!item.shown) item.shown = !!reference && !!item.band && wheelBandMatch(item.band, reference) >= WHEEL_BAND_MIN
  return item.shown
}
/** A grey WHEEL_BAND_SIZE² sample of the wheel's result box inside a crop (square at `left`, `top` of side `side`). */
export const resultBoxBand = (() => {
  let context: OffscreenCanvasRenderingContext2D | null = null
  return (frame: ImageBitmap, left: number, top: number, side: number) => {
    context ??= new OffscreenCanvas(WHEEL_BAND_SIZE, WHEEL_BAND_SIZE).getContext('2d', { willReadFrequently: true })
    if (!context || side <= 0) return null
    context.drawImage(frame, left, top, side, side, 0, 0, WHEEL_BAND_SIZE, WHEEL_BAND_SIZE)
    const pixels = context.getImageData(0, 0, WHEEL_BAND_SIZE, WHEEL_BAND_SIZE).data
    const grey = new Float32Array(WHEEL_BAND_SIZE * WHEEL_BAND_SIZE)
    for (let index = 0; index < grey.length; index++) grey[index] = (pixels[index * 4] + pixels[index * 4 + 1] + pixels[index * 4 + 2]) / 3
    return grey
  }
})()
/**
 * Crops placed from the same screen text, within OCR jitter (a crop taken before the selection screen was read is placed
 * from the frame, so a static wheel is taken again once the text is known).
 */
export const sameAnchors = (first?: WheelAnchors, second?: WheelAnchors) => {
  if (!first || !second) return first === second
  const center = (box: WheelAnchors['title']) => [box.left + box.width / 2, box.top + box.height / 2]
  return [[first.title, second.title], [first.wish, second.wish]].every(([a, b]) => {
    const [ax, ay] = center(a), [bx, by] = center(b)
    return Math.abs(ax - bx) <= 6 && Math.abs(ay - by) <= 6
  })
}
/** How long a result on the fusion screen waits for its dialog's evidence (1.5 s while one is read, 1 s otherwise). */
export const FUSION_HOLD_MS = 1500
export const SCREEN_HOLD_MS = 1000
/**
 * A worker that answers a read with an error keeps running; that frame is skipped. Only this many failed reads in a row
 * (or a crashed worker) retire the lane. When no lane is left, OCR is rebuilt after each of these waits; it used to stay
 * off for the rest of the capture after a single error.
 */
export const OCR_READ_FAILURES = 3
/**
 * Scene reads that may fail in a row (a GPU busy with the game, a frame closed mid-copy) before the capture stops with
 * an error; a single failure used to end the whole screen share.
 */
export const SCENE_READ_FAILURES = 5
export const OCR_REBUILD_MS = [5_000, 20_000, 60_000]
/**
 * New workers that then read for this long without dying get the rebuilds back: a run of hours could spend all three and
 * read nothing for the rest of it (floors 13-15 went unread, 2026-11-04). The GPU models' retries work the same way.
 */
export const OCR_STABLE_MS = 5 * 60_000
/** The rebuild budget after a read at `now` by workers built at `builtAt` (null: the first ones). */
export function ocrRebuildsAfterRead(spent: number, builtAt: number | null, now: number): number {
  return spent && builtAt !== null && now - builtAt >= OCR_STABLE_MS ? 0 : spent
}
/** What a worker's error answer to the read in flight does to its lane: skip the frame, or retire the lane once reads keep failing. */
export function ocrErrorAction(failuresBefore: number): 'skip' | 'retire' {
  return failuresBefore + 1 < OCR_READ_FAILURES ? 'skip' : 'retire'
}
/**
 * A confirmed acquisition; floor is null when the floor it was gained on is uncertain (inventory only). `capturedAt` is when
 * its frame was captured, `episode` the popup's number in order of appearance on screen.
 */
/** A worker's shelf answer: eight slot reads, each blank, sold and its classifier read (or null when unread). */
export function parseShopShelf(value: unknown): ShopSlotRead[] | null {
  if (!Array.isArray(value) || value.length !== 8) return null
  return value.every(slot => slot && typeof slot === 'object' && typeof slot.blank === 'boolean' && typeof slot.sold === 'boolean' &&
    Number.isInteger(slot.index)) ? value as ShopSlotRead[] : null
}

export interface PopupAcquisition { giftId: string; token: string; floor: number | null; observedAt: number; capturedAt?: number; episode?: number }
/** A shop sale confirmed by the cost afterwards; capturedAt is when its confirmation dialog was on screen. */
export interface GiftSale { giftId: string; token: string; capturedAt: number }
/** Shop skill replacement window on screen: its sinner and current skill counts. */
export type SkillExchangeView = SkillExchangeRead & { seenAt: number }
/**
 * Exploration banner seen twice with the same floor and pack, or once with an exact pack name under the current or next
 * floor; only a candidate until the run state validates it.
 */
export interface FloorThemeObservation extends ExplorationObservation { token: string }
export interface PopupFrame { frame: ImageBitmap; box: PopupLabelBox; requestId: number; episode: number }
export interface PopupPending {
  floor: number
  capturedAt: number
  episode: number
  quality: number
  readyAt: number
  retry: boolean
  priority: number
  /** Its popup was already confirmed from another frame; it no longer holds back later popups. */
  settled?: boolean
  ocr?: { header: string; labels: PopupLabelRead[]; body: string; lexiconId: string | null }
  icon?: VisualMatch[]
}

/** Screen recognition targets desktop game PCs; phones and tablets are refused before any capture starts. */
export function mobileBlocked(): boolean {
  return typeof navigator !== 'undefined' && isMobileDevice(navigator as Parameters<typeof isMobileDevice>[0])
}

// Asked once per page: turning graphics acceleration on takes a browser restart, which loads the page again.
let gpuCheck: Promise<GpuBlock | null> | null = null
export function gpuBlocked(): Promise<GpuBlock | null> {
  return gpuCheck ??= webgpuBlock(navigator as Parameters<typeof webgpuBlock>[0])
}

export function canCapture(): boolean {
  return !mobileBlocked() && typeof navigator !== 'undefined' && typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

export function validMatches(value: unknown): value is VisualMatch[] {
  return Array.isArray(value) && value.every(match => match && typeof match.id === 'string' &&
    typeof match.score === 'number' && Number.isFinite(match.score) && match.score >= -1 && match.score <= 1)
}

export type OpenFrame = { source: HTMLVideoElement | VideoFrame; width: number; height: number; release: () => void }
export type FrameTask = { ms: number; last: number; work: () => void; live: () => boolean }
/** Runs a timer's work unless it ran within its interval (timer ticks and frame arrivals share one clock). */
export function runFrameTask(task: FrameTask, now = performance.now()): boolean {
  if (!task.live() || now - task.last < task.ms - 5) return false
  task.last = now
  task.work()
  return true
}

