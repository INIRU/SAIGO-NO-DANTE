'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VisualCandidates, VisualMatch, VisualReference } from '@/lib/vision/embedding-match'
import { corroboratedChoiceEvent, effectGiftIds, eventScreenEvidence, matchOcrCandidates, type EventScreenEvidence, type OcrCatalog, type OcrMatches,
  type OcrWord } from '@/lib/vision/ocr-match'
import { acquiredGiftFromPopup, acquisitionFloor, popupCandidateIds, popupHeaderEvidence, type PopupLabelRead } from '@/lib/vision/popup-evidence'
import type { RecipePopupEvidence } from '@/lib/planner/fusion'
import type { StableScene } from '@/lib/vision/scene-state'
import { isMobileDevice } from '@/lib/vision/device'
import { RECOGNITION_PROFILES, type RecognitionMode } from '@/lib/vision/recognition-profile'
import { DEFAULT_DETECTION, type DetectionSettings } from '@/lib/vision/detection-settings'
import { AssistSampleRecorder } from '@/lib/vision/assist-samples'
import { AssistReportTally, sendAssistReport, type ReportAction } from '@/lib/vision/assist-report'
import { EMPTY_SALE_STATE, isSellWindow, readSaleStep, sellCost, sellGiftId } from '@/lib/vision/sell-evidence'
import { readSkillExchange, type SkillExchangeRead } from '@/lib/vision/skill-exchange'
import { acquisitionSeq, acquisitionsToRelease, continuesFusionDialog, dialogForResult, dialoglessFusionResult, fusionAnchors,
  fusionConfirmation, fusionDialogClosed, fusionMaterials, onFusionScreen, showsFusionTitle,
  fusionWheelAnchors, fusionWheelCrop, fusionWheelResultBox, isFusionSelectionScreen, wheelBandMatch, WHEEL_BAND_MIN, WHEEL_BAND_SIZE,
  type FusionAnchors, type FusionDialogEvidence, type FusionRead, type SeenDialog, type WheelAnchors,
  type FusionSlotRead } from '@/lib/vision/fusion-evidence'
import { confirmsExploration, explorationFloor, explorationThemeMatch, themeSelectionHeaderFloor, type ExplorationObservation,
  type ExplorationThemeReference } from '@/lib/vision/exploration-match'
import { acquisitionPlate, darkPopupPlate, detectGiftPopupLabel, popupCaptureAction, popupIconSignature, popupLabelColor, popupPriority, popupQuality,
  POPUP_SETTLE_MS, samePopupEpisode, type PopupLabelBox, type PopupObservation } from '@/lib/vision/popup-detect'

type CaptureStatus = 'idle' | 'requesting' | 'loading' | 'running' | 'unsupported' | 'error'
export interface ScenePrediction { label: string; confidence: number }
type OcrStatus = 'idle' | 'loading' | 'running' | 'error'
export interface OcrCandidates extends OcrMatches, EventScreenEvidence { observedAt: number; expiresAt: number; floor: number | null }
/** Worker jobs running now, and queued popup frames counted once per frame (text and image copies listed separately). */
export interface CaptureQueueStatus { analyzing: number; frames: number; text: number; image: number }
const IDLE_QUEUE: CaptureQueueStatus = { analyzing: 0, frames: 0, text: 0, image: 0 }
/** Text reader actually serving capture: GPU PP-OCR once loaded, otherwise Tesseract (also while PP-OCR loads). */
export interface OcrEngineStatus { engine: 'paddle' | 'tesseract'; adapter: string; loading: boolean; reason?: string }
interface OcrLane { worker: Worker; ready: boolean; inFlight: boolean; activeRequest: number; engine: OcrEngineStatus | null }
/** OCR workers of one capture: one lane object shared by popups and screen reads, or one worker per lane. */
interface OcrPool { popup: OcrLane; screen: OcrLane; lanes: OcrLane[]; started: boolean }
/** Materials confirmed in one fusion confirmation dialog (slot by slot; unconfirmed slots are left out). */
export interface FusionEvidence extends FusionDialogEvidence { token: string }
/**
 * A crop of the selection wheel: `origin` is its corner in the captured frame of `frameSize`. Identical-looking crops are
 * kept once (`at` first seen, `lastAt` last seen), so the ring holds distinct wheel states rather than repeats.
 */
interface WheelFrame { frame: ImageBitmap; at: number; lastAt: number; signature: Uint8Array; band: Float32Array | null;
  origin: { x: number; y: number }; scale: number; frameSize: { width: number; height: number }; anchors?: WheelAnchors;
  reads: Partial<Record<number, FusionRead>>; shown?: boolean }
/** Slot reads from the scene worker: an icon with its score and lead, a blank slot, or nothing; null unless `size` long. */
function parseFusionSlots(raw: unknown, size: number): FusionSlotRead[] | null {
  if (!Array.isArray(raw) || raw.length !== size) return null
  return raw.map((slot): FusionSlotRead => {
    if (slot && (slot as { blank?: unknown }).blank === true) return { blank: true }
    const read = slot as { id?: unknown; score?: unknown; margin?: unknown } | null
    return read && typeof read.id === 'string' && typeof read.score === 'number' && Number.isFinite(read.score) &&
      typeof read.margin === 'number' && Number.isFinite(read.margin) ? { id: read.id, score: read.score, margin: read.margin } : null
  })
}
// Distinct states kept (animations make many); crops at most WHEEL_CROP_WIDTH wide (about 1 MB each).
const WHEEL_FRAMES = 16
const WHEEL_KEEP_MS = 4000
const WHEEL_CROP_WIDTH = 640
/** Wheel states read per dialog and how long after an earlier dialog a crop may belong to a new one. */
const WHEEL_READS = 6
const WHEEL_AFTER_DIALOG_MS = 800
/** The dialog can already be up this long before OCR first sees it (the late states below). */
const WHEEL_BEFORE_DIALOG_MS = 450
/**
 * Reading order of the wheel states before a dialog (or a result without one) first seen at `end`: the newest state
 * certainly before it, then the late states oldest first (the complete wheel, often up only ~0.3 s, comes before the
 * dialog's own opening frames), then older states.
 */
function wheelReadOrder(states: WheelFrame[], end: number, lateMs: number): WheelFrame[] {
  const settled = states.filter(item => item.at <= end - lateMs).sort((first, second) => second.at - first.at)
  const late = states.filter(item => item.at > end - lateMs).sort((first, second) => first.at - second.at)
  return [...settled.slice(0, 1), ...late, ...settled.slice(1)].slice(0, WHEEL_READS)
}
/** Wheel states taken for a result without a seen dialog: last seen within this before the result popup. */
const DIALOGLESS_WHEEL_MS = 3000
/** How long the shop capacity of a dialog is assumed for later dialog-less results of the same session. */
const CAPACITY_KEEP_MS = 15 * 60_000
/** A 16×9 grey signature of a crop (analysis only, never shown), for telling a changed wheel from the same one. */
const wheelSignature = (() => {
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
const showsWheel = (item: WheelFrame, reference: Float32Array | null) => {
  if (!item.shown) item.shown = !!reference && !!item.band && wheelBandMatch(item.band, reference) >= WHEEL_BAND_MIN
  return item.shown
}
/** A grey WHEEL_BAND_SIZE² sample of the wheel's result box inside a crop (square at `left`, `top` of side `side`). */
const resultBoxBand = (() => {
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
const sameAnchors = (first?: WheelAnchors, second?: WheelAnchors) => {
  if (!first || !second) return first === second
  const center = (box: WheelAnchors['title']) => [box.left + box.width / 2, box.top + box.height / 2]
  return [[first.title, second.title], [first.wish, second.wish]].every(([a, b]) => {
    const [ax, ay] = center(a), [bx, by] = center(b)
    return Math.abs(ax - bx) <= 6 && Math.abs(ay - by) <= 6
  })
}
const sameWheel = (first: Uint8Array, second: Uint8Array) => {
  if (!first.length || first.length !== second.length) return false
  let total = 0
  for (let index = 0; index < first.length; index++) total += Math.abs(first[index] - second[index])
  return total / first.length < 3
}
/** How long a result on the fusion screen waits for its dialog's evidence (1.5 s while one is read, 1 s otherwise). */
const FUSION_HOLD_MS = 1500
const SCREEN_HOLD_MS = 1000
/**
 * A confirmed acquisition; floor is null when the floor it was gained on is uncertain (inventory only). `capturedAt` is when
 * its frame was captured, `episode` the popup's number in order of appearance on screen.
 */
export interface PopupAcquisition { giftId: string; token: string; floor: number | null; observedAt: number; capturedAt?: number; episode?: number }
/** A shop sale confirmed by the cost afterwards; capturedAt is when its confirmation dialog was on screen. */
export interface GiftSale { giftId: string; token: string; capturedAt: number }
/** Shop skill replacement window on screen: its sinner and current skill counts. */
export type SkillExchangeView = SkillExchangeRead & { seenAt: number }
/** Exploration banner seen twice with the same floor and pack; only a candidate until the run state validates it. */
export interface FloorThemeObservation extends ExplorationObservation { token: string }
interface PopupFrame { frame: ImageBitmap; box: PopupLabelBox; requestId: number; episode: number }
interface PopupPending {
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
function mobileBlocked(): boolean {
  return typeof navigator !== 'undefined' && isMobileDevice(navigator as Parameters<typeof isMobileDevice>[0])
}

function canCapture(): boolean {
  return !mobileBlocked() && typeof navigator !== 'undefined' && typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

function validMatches(value: unknown): value is VisualMatch[] {
  return Array.isArray(value) && value.every(match => match && typeof match.id === 'string' &&
    typeof match.score === 'number' && Number.isFinite(match.score) && match.score >= -1 && match.score <= 1)
}

type OpenFrame = { source: HTMLVideoElement | VideoFrame; width: number; height: number; release: () => void }
type FrameTask = { ms: number; last: number; work: () => void; live: () => boolean }
/** Runs a timer's work unless it ran within its interval (timer ticks and frame arrivals share one clock). */
export function runFrameTask(task: FrameTask, now = performance.now()): boolean {
  if (!task.live() || now - task.last < task.ms - 5) return false
  task.last = now
  task.work()
  return true
}

export function useAssistCapture({ giftReferences = [], eventReferences = [], ocrCatalog, themeCatalog, language = 'ko', floor = null,
  mode = 'balanced', detection = DEFAULT_DETECTION, resolvePopup, samples = false }: {
  giftReferences?: VisualReference[]
  eventReferences?: VisualReference[]
  ocrCatalog?: OcrCatalog
  themeCatalog?: ExplorationThemeReference[]
  language?: 'ko' | 'en' | 'ja'
  floor?: number | null
  /** Recognition mode; changing it while capturing rebuilds only the OCR workers. */
  mode?: RecognitionMode
  /** Screens to read; a switched-off kind does no reading work at all. Read live, no rebuild. */
  detection?: DetectionSettings
  /**
   * Final say on a popup with its header read: its candidate gift ids and the fusion's materials read so far, the
   * recognizer's own verdict (null when it abstained) and whether the fusion screen is up; returns the gift or null.
   * Used for fixed-recipe fusions, whose result follows from their materials.
   */
  resolvePopup?: (evidence: RecipePopupEvidence, verdict: string | null, inFusion: boolean) => string | null
  /** Opt-in recognition samples (lib/vision/assist-samples.ts); read live. */
  samples?: boolean
} = {}) {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<CaptureStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<ScenePrediction | null>(null)
  const [visualCandidates, setVisualCandidates] = useState<(VisualCandidates & { floor: number | null }) | null>(null)
  const [ocrCandidates, setOcrCandidates] = useState<OcrCandidates | null>(null)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [popupAcquisitions, setPopupAcquisitions] = useState<PopupAcquisition[]>([])
  const [floorThemeObservation, setFloorThemeObservation] = useState<FloorThemeObservation | null>(null)
  const [queueStatus, setQueueStatus] = useState<CaptureQueueStatus>(IDLE_QUEUE)
  const [mobile, setMobile] = useState(false)
  // Image model backend the worker actually created (WebGPU only on a real adapter, otherwise WASM).
  const [inference, setInference] = useState<{ provider: 'webgpu' | 'wasm'; adapter: string } | null>(null)
  const [ocrEngine, setOcrEngine] = useState<OcrEngineStatus | null>(null)
  // OCR workers actually running now (a failed second worker drops this to 1).
  const [ocrWorkers, setOcrWorkers] = useState(0)
  // One entry per confirmation dialog (latest last): back-to-back fusions published in one tick each reach the run.
  const [fusionEvidence, setFusionEvidence] = useState<FusionEvidence[]>([])
  // Confirmed shop sales (capture time of the dialog), latest last.
  const [giftSales, setGiftSales] = useState<GiftSale[]>([])
  const [skillExchange, setSkillExchange] = useState<SkillExchangeView | null>(null)
  const saleState = useRef(EMPTY_SALE_STATE)
  const sellWindowAt = useRef(0)
  const skillWindowAt = useRef(0)
  // Fusion confirmation seen by OCR: slot icons are read from new captures for a few seconds.
  const fusionWanted = useRef<{ count: number; capacity: number; at: number; anchors?: FusionAnchors } | null>(null)
  // The confirmation dialog on screen now or last: its slot reads, when it was last seen and whether it was published.
  // `wheel`: the selection-screen crops taken just before it, owned by the dialog until read.
  // `dialogless`: built from the wheel alone for a result on the fusion screen whose dialog no screen read caught;
  // `undecided`: its shop capacity is not known yet (no dialog seen this session), decided once both layouts are read.
  // `firstAt`: capture time of its first frame (the dialog read, or the earliest wheel state of a dialog-less result).
  const fusionDialog = useRef<{ token: string; count: number; capacity: number; firstAt: number; lastSeenAt: number; closedAt?: number; reads: FusionRead[];
    wheel: WheelFrame[]; published: boolean; dialogless?: boolean; undecided?: boolean; seen?: SeenDialog } | null>(null)
  const fusionRequest = useRef<{ requestId: number; at: number; count: number; token: string; view: FusionRead['view'] } | null>(null)
  // The selection wheel stays up while materials are picked but may be complete for only ~0.3 s before the dialog opens:
  // on the fusion screen small crops of it are kept every 150 ms (at most WHEEL_FRAMES, none older than WHEEL_KEEP_MS)
  // and only read once a dialog asks for them.
  const wheelFrames = useRef<WheelFrame[]>([])
  const wheelTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // A wheel state read ahead of any dialog while the scene worker is idle (the complete wheel may be up for ~0.3 s).
  const wheelRequest = useRef<{ requestId: number; state: WheelFrame; capacity: number } | null>(null)
  const wheelAnchors = useRef<{ anchors: WheelAnchors; at: number } | null>(null)
  // Capture time of the latest OCR read showing the fusion screen's title: the fusion screen in any UI theme.
  const fusionTitleAt = useRef(0)
  // The result box of a crop taken while OCR read the selection screen: other crops count as the wheel only if their box
  // matches it (a dialog, popup or prompt over the wheel reads as confident nonsense). Browser memory only.
  const wheelReference = useRef<Float32Array | null>(null)
  // When a confirmation dialog was last on screen: wheel crops from before it belong to that earlier fusion.
  const lastDialogAt = useRef(0)
  // Capture time of the latest screen read showing the selection screen or an acquisition popup without the dialog.
  const dialogBreakAt = useRef(0)
  // Dialogs seen recently and the acquisition each was the result of; a result no seen dialog explains (its dialog was up
  // ~0.3 s, between screen reads) is kept until the next screen read decides it.
  const seenDialogs = useRef<SeenDialog[]>([])
  const dialoglessResults = useRef<{ capturedAt: number }[]>([])
  // Recent screen reads (fusion screen or not) and the shop capacity of the latest dialog this session.
  const screenReads = useRef<{ at: number; fusion: boolean }[]>([])
  const lastCapacity = useRef<{ capacity: number; at: number } | null>(null)
  // During a fusion scene, a copy of each full-frame OCR capture, so a dialog OCR finds is read from that same frame.
  const fusionFrame = useRef<{ frame: ImageBitmap; at: number } | null>(null)
  const fusionFrameToRead = useRef<{ frame: ImageBitmap; at: number; count: number; capacity: number; anchors?: FusionAnchors } | null>(null)
  const latestLabel = useRef<string | null>(null)
  const heldAcquisitions = useRef<PopupAcquisition[]>([])
  const heldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileRef = useRef(RECOGNITION_PROFILES[mode])
  profileRef.current = RECOGNITION_PROFILES[mode]
  const detectionRef = useRef(detection)
  detectionRef.current = detection
  const rebuildOcr = useRef<(() => void) | null>(null)
  // Exploration floor read in two separate captures, even when its pack name could not be read.
  const [observedFloor, setObservedFloor] = useState<number | null>(null)
  // Classifier label held by two consecutive confident predictions; one-off misclassifications do not switch it.
  const [scene, setScene] = useState<StableScene | null>(null)
  // Floor named by a pack selection header ("N층 테마팩 선택") on the latest full-frame read.
  const [themeSelectionFloor, setThemeSelectionFloor] = useState<{ floor: number; observedAt: number } | null>(null)
  const sceneCandidate = useRef<{ label: string; at: number; count: number } | null>(null)
  const references = useRef({ giftReferences, eventReferences })
  const resolvePopupRef = useRef(resolvePopup)
  resolvePopupRef.current = resolvePopup
  references.current = { giftReferences, eventReferences }
  const ocrReferences = useRef(ocrCatalog)
  ocrReferences.current = ocrCatalog
  const themeReferences = useRef(themeCatalog)
  themeReferences.current = themeCatalog
  const currentFloor = useRef(floor)
  currentFloor.current = floor
  // Opt-in samples: the recorder follows the switch from the frame reader; its metadata is read when a sample is sent.
  const sampleRecorder = useRef<AssistSampleRecorder | null>(null)
  // With the same consent: read/held counts per action and the user's inventory edits, one random session per capture.
  const reportTally = useRef<AssistReportTally | null>(null)
  const samplesRef = useRef(samples)
  samplesRef.current = samples
  const sampleState = useRef({ prediction, mode, detection, inference, ocrEngine, floor })
  sampleState.current = { prediction, mode, detection, inference, ocrEngine, floor }
  const readSampleContext = () => {
    const { prediction, mode, detection, inference, ocrEngine, floor } = sampleState.current
    return { scene: prediction && { label: prediction.label.slice(0, 40), confidence: prediction.confidence }, mode, detection, inference,
      ocr: ocrEngine && { engine: ocrEngine.engine, adapter: ocrEngine.adapter.slice(0, 80) }, dpr: window.devicePixelRatio,
      userAgent: navigator.userAgent.slice(0, 400), build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, floor,
      session: reportTally.current?.session }
  }
  const readReportContext = () => ({ build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, mode: sampleState.current.mode,
    ocr: sampleState.current.ocrEngine?.engine.slice(0, 20) ?? null })
  /** An action Assist finished reading: counted for the report, and its sample group kept (failure) or discarded. */
  const settleSample = (key: string, action: ReportAction, failure: Parameters<AssistSampleRecorder['end']>[1]) => {
    reportTally.current?.settle(action, !failure)
    sampleRecorder.current?.end(key, failure)
  }
  const flushReport = () => {
    const report = reportTally.current?.take()
    if (report) sendAssistReport(report)
  }
  const generation = useRef(0)
  const stream = useRef<MediaStream | null>(null)
  const worker = useRef<Worker | null>(null)
  const ocrPool = useRef<OcrPool | null>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const ocrTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const exploreTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // Newest frame from the track reader. A hidden or covered tab (the game in front) runs timers about once a second and may
  // stop painting <video>; frames from the track keep arriving, so reads take them from here and the reader drives the timers' work.
  const latestFrame = useRef<VideoFrame | null>(null)
  const frameTasks = useRef<FrameTask[]>([])
  /** A copy of the newest captured frame (the track's, or the video element's before the reader starts); release it after use. */
  const openFrame = (): OpenFrame | null => {
    const frame = latestFrame.current
    if (frame) {
      const copy = frame.clone()
      return { source: copy, width: copy.displayWidth, height: copy.displayHeight, release: () => copy.close() }
    }
    const element = video.current
    if (!element || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !element.videoWidth) return null
    return { source: element, width: element.videoWidth, height: element.videoHeight, release: () => {} }
  }
  const hasFrame = () => latestFrame.current !== null ||
    (video.current !== null && video.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
  const grabBitmap = async () => {
    const frame = openFrame()
    if (!frame) throw new Error('No captured frame')
    try { return await createImageBitmap(frame.source) } finally { frame.release() }
  }
  /** setInterval whose work the frame reader also runs; either caller runs it at most once per \`ms\`, and it stops with its timer. */
  const every = (slot: { current: ReturnType<typeof setInterval> | null }, ms: number, work: () => void) => {
    const task: FrameTask = { ms, last: 0, work, live: () => false }
    const id = setInterval(() => runFrameTask(task), ms)
    slot.current = id
    task.live = () => slot.current === id
    frameTasks.current.push(task)
  }
  const exploreCapture = useRef<{ at: number; requestId: number } | null>(null)
  const lastExploration = useRef<ExplorationObservation | null>(null)
  const lastFloorRead = useRef<{ floor: number; at: number } | null>(null)
  const popupReader = useRef<ReadableStreamDefaultReader<VideoFrame> | null>(null)
  const inFlight = useRef(false)
  const ocrRequestId = useRef(0)
  const ocrCapture = useRef<{ at: number; floor: number | null; width?: number; height?: number } | null>(null)
  const visualCapture = useRef<{ at: number; floor: number | null } | null>(null)
  const popupQueue = useRef<PopupFrame[]>([])
  const popupVisionQueue = useRef<PopupFrame[]>([])
  const popupPending = useRef(new Map<number, PopupPending>())
  // Reads of earlier frames from the same popup; frames differ in which evidence OCR and the icon matcher recover.
  const popupEvidence = useRef(new Map<number, { floor: number; headers: string[]; labels: PopupLabelRead[];
    icons: string[]; effects: string[]; lexicon: string[] }>())
  // Per gift: capture time and popup episode of its latest confirmed acquisition and that acquisition's number in this
  // capture session; and the capture times of recent acquisitions of any gift.
  const acquisitionSeen = useRef(new Map<string, { at: number; seq: number; episode: number }>())
  const acquisitionCaptures = useRef<{ giftId: string; at: number }[]>([])
  const lastPopup = useRef<(PopupObservation & { episode: number; floor: number; firstAt: number; attempts: number;
    capturedQuality: number; capturedAt: number }) | null>(null)
  const popupReadyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextEpisode = useRef(0)
  const ocrReady = useRef(false)

  const cleanup = useCallback(() => {
    generation.current++
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    if (ocrTimer.current) clearInterval(ocrTimer.current)
    ocrTimer.current = null
    if (popupTimer.current) clearInterval(popupTimer.current)
    popupTimer.current = null
    if (exploreTimer.current) clearInterval(exploreTimer.current)
    exploreTimer.current = null
    if (statusTimer.current) clearInterval(statusTimer.current)
    statusTimer.current = null
    exploreCapture.current = null
    lastExploration.current = null
    lastFloorRead.current = null
    sceneCandidate.current = null
    fusionWanted.current = null
    for (const item of fusionDialog.current?.wheel ?? []) item.frame.close()
    fusionDialog.current = null
    fusionRequest.current = null
    if (wheelTimer.current) clearInterval(wheelTimer.current)
    wheelTimer.current = null
    frameTasks.current = []
    latestFrame.current?.close()
    latestFrame.current = null
    sampleRecorder.current?.close()
    sampleRecorder.current = null
    flushReport()
    reportTally.current = null
    for (const item of wheelFrames.current) item.frame.close()
    wheelFrames.current = []
    wheelRequest.current = null
    wheelAnchors.current = null
    fusionTitleAt.current = 0
    wheelReference.current = null
    lastDialogAt.current = 0
    dialogBreakAt.current = 0
    dialoglessResults.current = []
    seenDialogs.current = []
    screenReads.current = []
    lastCapacity.current = null
    fusionFrame.current?.frame.close()
    fusionFrame.current = null
    fusionFrameToRead.current?.frame.close()
    fusionFrameToRead.current = null
    latestLabel.current = null
    if (heldTimer.current) clearTimeout(heldTimer.current)
    heldTimer.current = null
    heldAcquisitions.current = []
    if (popupReadyTimer.current) clearTimeout(popupReadyTimer.current)
    popupReadyTimer.current = null
    const reader = popupReader.current
    popupReader.current = null
    if (reader) void reader.cancel().catch(() => {})
    for (const item of popupQueue.current) item.frame.close()
    popupQueue.current = []
    for (const item of popupVisionQueue.current) item.frame.close()
    popupVisionQueue.current = []
    popupPending.current.clear()
    popupEvidence.current.clear()
    acquisitionSeen.current.clear()
    acquisitionCaptures.current = []
    lastPopup.current = null
    nextEpisode.current = 0
    ocrReady.current = false
    worker.current?.terminate()
    worker.current = null
    rebuildOcr.current = null
    for (const lane of ocrPool.current?.lanes ?? []) {
      const closing = lane.worker
      closing.postMessage({ type: 'dispose' })
      closing.onmessage = event => { if (event.data?.type === 'disposed') closing.terminate() }
      setTimeout(() => closing.terminate(), 1500)
    }
    ocrPool.current = null
    if (stream.current) {
      for (const track of stream.current.getTracks()) {
        track.onended = null
        track.stop()
      }
    }
    stream.current = null
    if (video.current) {
      video.current.pause()
      video.current.srcObject = null
    }
    video.current = null
    inFlight.current = false
    ocrRequestId.current++
    ocrCapture.current = null
    visualCapture.current = null
  }, [])

  const stop = useCallback(() => {
    cleanup()
    setStatus('idle')
    setError(null)
    setPrediction(null)
    setVisualCandidates(null)
    setOcrCandidates(null)
    setOcrStatus('idle')
    setPopupAcquisitions([])
    setFloorThemeObservation(null)
    setQueueStatus(IDLE_QUEUE)
    setInference(null)
    setOcrEngine(null)
    setOcrWorkers(0)
    setFusionEvidence([])
    setGiftSales([]); setSkillExchange(null)
    saleState.current = EMPTY_SALE_STATE
    setObservedFloor(null)
    setScene(null)
    setThemeSelectionFloor(null)
  }, [cleanup])

  useEffect(() => {
    setSupported(canCapture())
    setMobile(mobileBlocked())
    return cleanup
  }, [cleanup])

  // Closing, reloading or leaving the tab while the screen is connected asks first (the browser's own prompt):
  // a closed tab loses the capture, which needs a new screen share.
  useEffect(() => {
    if (status !== 'loading' && status !== 'running') return
    const confirmLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', confirmLeave)
    return () => window.removeEventListener('beforeunload', confirmLeave)
  }, [status])

  useEffect(() => {
    if (!visualCandidates) return
    const observedAt = visualCandidates.observedAt
    const timeout = setTimeout(() => {
      setVisualCandidates(current => current?.observedAt === observedAt ? null : current)
    }, Math.max(0, visualCandidates.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [visualCandidates])

  useEffect(() => {
    if (!ocrCandidates) return
    const observedAt = ocrCandidates.observedAt
    const timeout = setTimeout(() => {
      setOcrCandidates(current => current?.observedAt === observedAt ? null : current)
    }, Math.max(0, ocrCandidates.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [ocrCandidates])

  // Only the worker count needs new workers; cadence, detection size and popup frames are read live from the profile.
  const workerCount = RECOGNITION_PROFILES[mode].ocrWorkers
  useEffect(() => {
    const pool = ocrPool.current
    if (pool && rebuildOcr.current && pool.lanes.length !== workerCount) rebuildOcr.current()
  }, [workerCount])

  const start = useCallback(async () => {
    cleanup()
    setPrediction(null)
    setVisualCandidates(null)
    setOcrCandidates(null)
    setOcrStatus('idle')
    setPopupAcquisitions([])
    setFloorThemeObservation(null)
    setQueueStatus(IDLE_QUEUE)
    setInference(null)
    setOcrEngine(null)
    setOcrWorkers(0)
    setFusionEvidence([])
    setGiftSales([]); setSkillExchange(null)
    saleState.current = EMPTY_SALE_STATE
    setObservedFloor(null)
    setScene(null)
    setThemeSelectionFloor(null)
    setError(null)
    if (mobileBlocked() || !canCapture()) {
      setStatus('unsupported')
      return
    }
    const run = generation.current
    setStatus('requesting')
    let display: MediaStream
    try {
        display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60 } }, audio: false })
    } catch (reason) {
      if (run !== generation.current) return
      setError(reason instanceof Error ? reason.message : 'Screen sharing unavailable')
      setStatus('error')
      return
    }
    if (run !== generation.current) {
      display.getTracks().forEach(track => track.stop())
      return
    }

    try {
      stream.current = display
      const track = display.getVideoTracks()[0]
      if (!track) throw new Error('No screen video track')
      track.onended = stop
      const element = document.createElement('video')
      element.muted = true
      element.playsInline = true
      element.srcObject = display
      video.current = element
      await element.play()
      if (run !== generation.current) return

      setStatus('loading')
      const vision = new Worker('/models/assist-scene/scene-worker.js', { type: 'module' })
      worker.current = vision
      const fail = (message: string) => {
        if (run !== generation.current) return
        cleanup()
        setPrediction(null)
        setVisualCandidates(null)
        setOcrCandidates(null)
        setOcrStatus('idle')
        setPopupAcquisitions([])
        setFloorThemeObservation(null)
        setQueueStatus(IDLE_QUEUE)
        setInference(null)
        setOcrEngine(null)
        setOcrWorkers(0)
        setFusionEvidence([])
        setGiftSales([]); setSkillExchange(null)
        saleState.current = EMPTY_SALE_STATE
        setObservedFloor(null)
        setScene(null)
        setThemeSelectionFloor(null)
        setError(message)
        setStatus('error')
      }
      const publishAcquisition = (evidence: PopupAcquisition) => setPopupAcquisitions(items =>
        items.some(item => item.token === evidence.token) ? items : [...items.slice(-15), evidence])
      const publishFusion = (evidence: FusionEvidence) => setFusionEvidence(items =>
        [...items.filter(item => item.token !== evidence.token).slice(-7), evidence])
      /** Later sightings of a published dialog (last seen, closed) update its entry. */
      const updateFusion = (token: string, change: Partial<FusionEvidence>) => setFusionEvidence(items =>
        items.some(item => item.token === token) ? items.map(item => item.token === token ? { ...item, ...change } : item) : items)
      /**
       * On a fusion screen the result popup can be confirmed before the confirmation dialog's materials are; the gift is
       * held briefly so it reaches the run together with that evidence. Never dropped: released on evidence, on the
       * dialog read ending, or after the wait. Released in capture order: a gift waits (briefly) while a popup captured
       * before it is still being read.
       */
      const releaseHeld = () => {
        if (heldTimer.current) clearTimeout(heldTimer.current)
        heldTimer.current = null
        const unsettled = [...popupPending.current.values()].filter(pending => !pending.settled).map(pending => pending.episode)
        const { release, keep } = acquisitionsToRelease(heldAcquisitions.current, unsettled, Date.now())
        heldAcquisitions.current = keep
        if (run !== generation.current) return
        for (const item of release) publishAcquisition(item)
        if (keep.length) heldTimer.current = setTimeout(() => { if (fusionWanted.current) scheduleRelease(); else releaseHeld() }, 200)
      }
      /**
       * Wheel states already read ahead (for this capacity) join the dialog's reads at once; the rest stay queued. If that
       * already names every material, the dialog is finished before any of its own frames is read.
       */
      const takeWheelReads = (dialog: NonNullable<typeof fusionDialog.current>) => {
        if (dialog.undecided) return
        dialog.wheel = dialog.wheel.filter(item => {
          const read = item.reads[dialog.capacity]
          if (!read) return true
          dialog.reads.push(read)
          item.frame.close()
          return false
        })
        if (fusionMaterials(dialog.reads, dialog.count, dialog.capacity).length === dialog.count) finishFusionDialog()
      }
      /**
       * The shop capacity of a result without a seen dialog before any dialog this session: the layout whose reads name more
       * materials (the 3- and 5-slot positions nearly coincide, so both name the same icons when both find them). Decided
       * as soon as the states read so far name two materials, or with whatever was read (`force`).
       */
      const decideCapacity = (dialog: NonNullable<typeof fusionDialog.current>, force: boolean) => {
        if (!dialog.undecided) return
        const named = (size: number) => fusionMaterials(dialog.wheel.flatMap(item => item.reads[size] ? [item.reads[size]!] : []), size, size).length
        const three = named(3), five = named(5)
        if (!force && Math.max(three, five) < 2) return
        dialog.capacity = five > three ? 5 : 3
        dialog.count = dialog.capacity
        dialog.undecided = false
        takeWheelReads(dialog)
      }
      /**
       * Ends the reads of the current dialog: its confirmed materials are published (all of them, or the slots confirmed
       * before the dialog closed), then any held result is released after them.
       */
      const finishFusionDialog = () => {
        const dialog = fusionDialog.current
        if (dialog && !dialog.published) decideCapacity(dialog, true)
        if (dialog && !dialog.published && run === generation.current) {
          dialog.published = true
          const materials = fusionMaterials(dialog.reads, dialog.count, dialog.capacity)
          // The fusion's frame group is uploaded only when its materials could not all be read.
          settleSample('fusion', 'fusion', materials.length < dialog.count ? { reason: dialog.dialogless ? 'fusion-dialogless' : 'fusion-materials', candidates: materials } : null)
          // Dated by the dialog's own first frame: wheel reads come from before it, possibly before the previous result.
          if (materials.length) publishFusion({ materials, observedAt: dialog.firstAt, lastSeenAt: dialog.lastSeenAt,
            closedAt: dialog.closedAt, token: dialog.token })
        }
        fusionWanted.current = null
        fusionFrameToRead.current?.frame.close()
        fusionFrameToRead.current = null
        for (const item of dialog?.wheel.splice(0) ?? []) item.frame.close()
        releaseHeld()
      }
      const scheduleRelease = () => {
        if (heldTimer.current) clearTimeout(heldTimer.current)
        // Short: evidence that comes later still applies to the recorded result (CompanionPanel's late fusion step).
        const wait = fusionWanted.current ? FUSION_HOLD_MS : SCREEN_HOLD_MS
        const oldest = heldAcquisitions.current[0]?.observedAt ?? Date.now()
        heldTimer.current = setTimeout(() => {
          if (fusionWanted.current && Date.now() - oldest < FUSION_HOLD_MS) scheduleRelease()
          else if (fusionWanted.current) finishFusionDialog()
          else releaseHeld()
        }, Math.max(100, wait - (Date.now() - oldest)))
      }
      const emitAcquisition = (evidence: PopupAcquisition) => {
        // The result of a seen dialog, or possibly of one up too briefly for any screen read: decided by the next read.
        if (evidence.capturedAt !== undefined) {
          const dialog = dialogForResult(seenDialogs.current, evidence.capturedAt)
          if (dialog) dialog.resultAt = evidence.capturedAt
          else if (wheelFrames.current.some(item => item.at < evidence.capturedAt! && item.lastAt >= evidence.capturedAt! - DIALOGLESS_WHEEL_MS &&
            showsWheel(item, wheelReference.current))) {
            dialoglessResults.current = [...dialoglessResults.current.slice(-3), { capturedAt: evidence.capturedAt }]
          }
        }
        heldAcquisitions.current.push(evidence)
        if (onFusionScreen(latestLabel.current, fusionTitleAt.current, Date.now()) || fusionWanted.current) {
          scheduleRelease()
          return
        }
        releaseHeld()
      }
      // Materials read so far on the confirmation dialog this popup follows, for telling look-alike recipe results apart.
      const popupDialogMaterials = (capturedAt: number) => {
        const dialog = fusionDialog.current
        return dialog && dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000
          ? fusionMaterials(dialog.reads, dialog.count, dialog.capacity) : []
      }
      const finishPopup = (requestId: number) => {
        const pending = popupPending.current.get(requestId)
        if (!pending?.ocr || !pending.icon) return
        popupPending.current.delete(requestId)
        // A later read of a popup already decided: nothing to add, and its (often mid-fade) frame must not count as a
        // hard case either (these were most "unresolved" samples: the gift had been recorded from an earlier frame).
        if (pending.settled) return
        // A dispatched frame already passed the queue expiry; a floor change since capture must not lose the gift.
        const catalog = ocrReferences.current
        if (!catalog) return
        const merged = popupEvidence.current.get(pending.episode) ??
          { floor: pending.floor, headers: [], labels: [], icons: [], effects: [], lexicon: [] }
        merged.headers.push(pending.ocr.header)
        merged.labels.push(...pending.ocr.labels)
        if (pending.ocr.lexiconId) merged.lexicon.push(pending.ocr.lexiconId)
        if (pending.icon[0]) merged.icons.push(pending.icon[0].id)
        merged.effects.push(...effectGiftIds(pending.ocr.body, catalog))
        popupEvidence.current.delete(pending.episode)
        popupEvidence.current.set(pending.episode, merged)
        for (const episode of popupEvidence.current.keys()) {
          if (popupEvidence.current.size <= 8) break
          popupEvidence.current.delete(episode)
        }
        // Frames of one popup must agree: two different icons, names, or effect owners abstain.
        const icons = [...new Set(merged.icons)]
        const effects = [...new Set(merged.effects)]
        const header = merged.headers.join('\n')
        const verdict = icons.length > 1 ? null : acquiredGiftFromPopup({ header, labels: merged.labels, iconGiftId: icons[0] ?? null,
          effectGiftIds: effects, gifts: catalog.gifts })
        const resolve = resolvePopupRef.current
        const inFusion = onFusionScreen(latestLabel.current, fusionTitleAt.current, Date.now()) ||
          (fusionWanted.current !== null && Date.now() - fusionWanted.current.at < 20_000)
        // Lexicon names below the acceptance bar only help pick a recipe result, and those come only from fusion.
        const giftId = resolve && popupHeaderEvidence(header)
          ? resolve({ ...popupCandidateIds({ header, labels: merged.labels, iconGiftIds: icons, effectGiftIds: effects,
            lexiconGiftIds: inFusion ? [...new Set(merged.lexicon)] : [], gifts: catalog.gifts }),
            materials: popupDialogMaterials(pending.capturedAt) }, verdict, inFusion)
          : verdict
        if (!giftId) {
          // Every frame of a real gift popup read and none named the gift: a hard case worth a sample. Only with the
          // "acquired" header read: without it, 64 of 90 uploaded samples showed no acquisition at all (gift info and
          // purchase dialogs, skill windows, boss banners).
          const last = lastPopup.current
          if (popupHeaderEvidence(header) &&
            ![...popupPending.current.values()].some(other => other.episode === pending.episode) &&
            (last?.episode !== pending.episode || last.attempts >= profileRef.current.popupAttempts))
            settleSample('popup:' + pending.episode, 'popup', { reason: 'popup-unresolved', candidates: [...icons, ...effects] })
          return
        }
        settleSample('popup:' + pending.episode, 'popup', null)
        popupEvidence.current.delete(pending.episode)
        for (const queue of [popupQueue, popupVisionQueue]) {
          queue.current = queue.current.filter(item => {
            if (item.episode !== pending.episode) return true
            item.frame.close()
            popupPending.current.delete(item.requestId)
            return false
          })
        }
        if (lastPopup.current?.episode === pending.episode) lastPopup.current.attempts = Number.MAX_SAFE_INTEGER
        for (const other of popupPending.current.values()) if (other.episode === pending.episode) other.settled = true
        const observedAt = Date.now()
        // One token per acquisition, decided in capture time: every frame of one popup, or the same gift captured again
        // within seconds with no fusion dialog or other popup between, is the same popup (an undone gift is not re-added
        // from that screen); otherwise it is a new acquisition, e.g. a material a blessing returns fusion after fusion.
        const seen = acquisitionSeen.current.get(giftId)
        const boundaries = [...seenDialogs.current.map(dialog => dialog.firstAt),
          ...acquisitionCaptures.current.filter(item => item.giftId !== giftId).map(item => item.at)]
        const seq = acquisitionSeq(seen, pending.episode, pending.capturedAt, boundaries)
        acquisitionSeen.current.set(giftId, { at: pending.capturedAt, seq, episode: pending.episode })
        acquisitionCaptures.current = [...acquisitionCaptures.current.slice(-15), { giftId, at: pending.capturedAt }]
        const evidence = { giftId, token: `${run}:${giftId}:${seq}`, observedAt, capturedAt: pending.capturedAt,
          episode: pending.episode, floor: acquisitionFloor(merged.floor, lastFloorRead.current?.floor ?? null) }
        emitAcquisition(evidence)
      }
      const dropPopup = (requestId: number) => {
        for (const queue of [popupQueue, popupVisionQueue]) {
          queue.current = queue.current.filter(item => {
            if (item.requestId !== requestId) return true
            item.frame.close()
            return false
          })
        }
        popupPending.current.delete(requestId)
      }
      const popupStale = (pending: PopupPending | undefined) => !pending || Date.now() - pending.capturedAt > 8000
      const takePopup = (queue: { current: PopupFrame[] }): PopupFrame | null => {
        let best: PopupFrame | null = null
        let bestPriority = -1
        for (const item of [...queue.current]) {
          const pending = popupPending.current.get(item.requestId)
          if (!pending || popupStale(pending)) {
            dropPopup(item.requestId)
            continue
          }
          if (pending.readyAt <= Date.now() && pending.priority > bestPriority) {
            best = item
            bestPriority = pending.priority
          }
        }
        if (best) queue.current = queue.current.filter(other => other !== best)
        return best
      }
      const flushVisionPopup = () => {
        if (inFlight.current || worker.current !== vision) return
        const item = takePopup(popupVisionQueue)
        if (!item) return
        inFlight.current = true
        vision.postMessage({ type: 'popup-icon', ...item }, [item.frame])
      }
      let flushOcrPopup = () => {}
      // An image-identified event asks for prompt full-frame OCR so its choices are read while they are shown.
      let eventHintAt = 0
      let promptEventOcr = () => {}
      // Likewise, a map scene asks for the exploration banner before it scrolls away.
      let explorationHintAt = 0
      let promptExplore = () => {}
      const flushPopups = () => {
        flushOcrPopup()
        flushVisionPopup()
        if (popupReadyTimer.current) clearTimeout(popupReadyTimer.current)
        popupReadyTimer.current = null
        // Ready frames wait for a worker result; only frames still settling need a wake-up.
        const now = Date.now()
        let next = Infinity
        for (const item of [...popupQueue.current, ...popupVisionQueue.current]) {
          const readyAt = popupPending.current.get(item.requestId)?.readyAt ?? 0
          if (readyAt > now) next = Math.min(next, readyAt)
        }
        if (next === Infinity || run !== generation.current) return
        popupReadyTimer.current = setTimeout(() => {
          popupReadyTimer.current = null
          if (run === generation.current) flushPopups()
        }, next - now)
      }
      /** A popup that ended or was replaced will not produce a sharper frame, so its pending frame is sent now. */
      const releasePopupEpisode = (episode: number) => {
        const now = Date.now()
        let changed = false
        for (const pending of popupPending.current.values()) {
          if (pending.episode === episode && pending.readyAt > now) { pending.readyAt = now; changed = true }
        }
        if (changed) flushPopups()
      }
      /** Stale frames go first; a full queue then gives up its lowest-priority, weakest frame to a better one. */
      const makePopupRoom = (priority: number, quality: number) => {
        for (const item of [...popupQueue.current, ...popupVisionQueue.current]) {
          if (popupStale(popupPending.current.get(item.requestId))) dropPopup(item.requestId)
        }
        while (popupQueue.current.length >= 8 || popupVisionQueue.current.length >= 8) {
          const full = popupQueue.current.length >= 8 ? popupQueue.current : popupVisionQueue.current
          let weakest: number | null = null
          let weakestPriority = priority
          let weakestQuality = quality
          for (const item of full) {
            const pending = popupPending.current.get(item.requestId)
            const itemPriority = pending?.priority ?? -1
            const itemQuality = pending?.quality ?? 0
            if (itemPriority < weakestPriority || (itemPriority === weakestPriority && itemQuality < weakestQuality)) {
              weakest = item.requestId
              weakestPriority = itemPriority
              weakestQuality = itemQuality
            }
          }
          if (weakest === null) return false
          dropPopup(weakest)
        }
        return true
      }
      const sampleCanvas = new OffscreenCanvas(480, 270)
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
      let sampling = false
      const samplePopup = async (source: HTMLVideoElement | VideoFrame) => {
        const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.displayWidth
        const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.displayHeight
        const floorAtCapture = currentFloor.current
        if (sampling || !detectionRef.current.gifts || !ocrReady.current || !source || !sampleContext ||
          (source instanceof HTMLVideoElement && source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) ||
          sourceWidth <= 0 || sourceHeight <= 0 || floorAtCapture === null) return
        sampling = true
        let frame: ImageBitmap | null = null
        let iconFrame: ImageBitmap | null = null
        try {
          sampleCanvas.height = Math.max(60, Math.round(480 * sourceHeight / sourceWidth))
          sampleContext.drawImage(source, 0, 0, sampleCanvas.width, sampleCanvas.height)
          const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height)
          const found = detectGiftPopupLabel(pixels) ?? darkPopupPlate(pixels)
          // Only the acquisition popup's place: other colored plates would spend OCR and icon reads for nothing.
          const label = found && acquisitionPlate(found, sampleCanvas.width, sampleCanvas.height) ? found : null
          const now = Date.now()
          const previous = lastPopup.current
          if (!label) {
            if (previous) {
              releasePopupEpisode(previous.episode)
              if (now - previous.at > 400) lastPopup.current = null
            }
            return
          }
          const observation: PopupObservation = { signature: popupIconSignature(pixels, label),
            color: popupLabelColor(pixels, label), box: label, at: now }
          const same = previous && samePopupEpisode(previous, observation) ? previous : null
          if (previous && !same) releasePopupEpisode(previous.episode)
          const state = same ? Object.assign(same, observation) : { ...observation, episode: ++nextEpisode.current,
            floor: floorAtCapture, firstAt: now, attempts: 0, capturedQuality: 0, capturedAt: 0 }
          lastPopup.current = state
          const quality = popupQuality(observation)
          const queued = popupQueue.current.find(item => item.episode === state.episode &&
            popupVisionQueue.current.some(other => other.requestId === item.requestId))
          const action = popupCaptureAction({ quality, at: now, attempts: state.attempts, maxAttempts: profileRef.current.popupAttempts,
            queuedQuality: queued ? popupPending.current.get(queued.requestId)?.quality ?? null : null,
            capturedQuality: state.capturedQuality, capturedAt: state.capturedAt })
          if (action === 'skip') return
          frame = await createImageBitmap(source)
          iconFrame = await createImageBitmap(frame)
          if (run !== generation.current || !ocrPool.current ||
            lastPopup.current !== state || (action === 'enqueue' && state.attempts >= profileRef.current.popupAttempts)) return
          const box = { x: label.x * frame.width / sampleCanvas.width, y: label.y * frame.height / sampleCanvas.height,
            width: label.width * frame.width / sampleCanvas.width, height: label.height * frame.height / sampleCanvas.height }
          if (action === 'replace') {
            // Either worker may have taken the pending pair while bitmaps were being copied.
            const pending = queued && popupPending.current.get(queued.requestId)
            const queuedVision = queued && popupVisionQueue.current.find(item => item.requestId === queued.requestId)
            if (!queued || !pending || !queuedVision || !popupQueue.current.includes(queued)) return
            queued.frame.close()
            queuedVision.frame.close()
            queued.frame = frame
            queued.box = box
            queuedVision.frame = iconFrame
            queuedVision.box = box
            pending.capturedAt = now
            pending.quality = quality
            pending.priority = popupPriority(label, pending.retry)
          } else {
            const retry = state.attempts > 0
            const priority = popupPriority(label, retry)
            if (!makePopupRoom(priority, quality)) return
            const requestId = ++ocrRequestId.current
            sampleRecorder.current?.begin('popup:' + state.episode)
            popupPending.current.set(requestId, { floor: floorAtCapture, capturedAt: now, episode: state.episode,
              quality, readyAt: state.firstAt + POPUP_SETTLE_MS, retry, priority })
            popupQueue.current.push({ frame, box, requestId, episode: state.episode })
            popupVisionQueue.current.push({ frame: iconFrame, box, requestId, episode: state.episode })
            state.attempts++
          }
          state.capturedQuality = quality
          state.capturedAt = now
          frame = null
          iconFrame = null
          flushPopups()
        } catch { /* A missed frame leaves the current run available for manual correction. */ }
        finally { frame?.close(); iconFrame?.close(); sampling = false }
      }
      // OCR lanes: popups (gift acquisition) and screen reads (event/pack full frame, exploration banner). One worker serves
      // both in performance mode; balanced and quality run one worker per lane so neither blocks the other.
      let recognizedAt = 0
      let exploredAt = 0
      let bannerRecent = false
      let lastScreenAt = 0
      const buildOcrPool = () => {
        const profile = profileRef.current
        const makeLane = (): OcrLane => ({ worker: new Worker('/models/assist-ocr/ocr-worker.js', { type: 'module' }), ready: false,
          inFlight: false, activeRequest: 0, engine: null })
        const first = makeLane()
        const pool: OcrPool = profile.ocrWorkers === 2 ? (() => { const second = makeLane(); return { popup: first, screen: second, lanes: [first, second], started: false } })()
          : { popup: first, screen: first, lanes: [first], started: false }
        ocrPool.current = pool
        setOcrWorkers(pool.lanes.length)
        setOcrStatus('loading')
        const alive = (lane: OcrLane) => run === generation.current && ocrPool.current === pool && pool.lanes.includes(lane)
        const publishEngine = () => {
          const engines = pool.lanes.map(lane => lane.engine)
          if (engines.some(engine => !engine)) { setOcrEngine(engines.find(Boolean) ?? null); return }
          const all = engines as OcrEngineStatus[]
          const paddle = all.every(engine => engine.engine === 'paddle')
          setOcrEngine({ engine: paddle ? 'paddle' : 'tesseract', adapter: paddle ? all[0].adapter : '', loading: all.some(engine => engine.loading),
            ...(all.find(engine => engine.reason)?.reason ? { reason: all.find(engine => engine.reason)!.reason } : {}) })
        }
        const dropInFlight = (lane: OcrLane) => {
          if (lane.inFlight && popupPending.current.has(lane.activeRequest)) popupPending.current.delete(lane.activeRequest)
          if (lane === pool.screen) { ocrCapture.current = null; exploreCapture.current = null }
          lane.inFlight = false
          lane.activeRequest = 0
        }
        const disposeLane = (lane: OcrLane) => {
          lane.worker.onmessage = null
          lane.worker.onerror = null
          lane.worker.postMessage({ type: 'dispose' })
          setTimeout(() => lane.worker.terminate(), 1500)
        }
        const ocrFail = (lane: OcrLane) => {
          if (!alive(lane)) return
          const other = pool.lanes.find(item => item !== lane && item.ready)
          if (other) {
            // Two workers and one failed: the other takes both lanes (performance-like) and the state shows one worker.
            dropInFlight(lane)
            disposeLane(lane)
            pool.lanes = [other]
            pool.popup = other
            pool.screen = other
            setOcrWorkers(1)
            publishEngine()
            flushOcrPopup()
            return
          }
          if (ocrTimer.current) clearInterval(ocrTimer.current)
          ocrTimer.current = null
          if (exploreTimer.current) clearInterval(exploreTimer.current)
          exploreTimer.current = null
          exploreCapture.current = null
          lastExploration.current = null
          lastFloorRead.current = null
          setFloorThemeObservation(null)
          setObservedFloor(null)
          ocrReady.current = false
          for (const item of popupQueue.current) item.frame.close()
          popupQueue.current = []
          for (const item of popupVisionQueue.current) item.frame.close()
          popupVisionQueue.current = []
          popupPending.current.clear()
          popupEvidence.current.clear()
          for (const item of pool.lanes) disposeLane(item)
          if (ocrPool.current === pool) ocrPool.current = null
          ocrRequestId.current++
          setOcrCandidates(null)
          setOcrStatus('error')
          setOcrEngine(null)
          setOcrWorkers(0)
          setFusionEvidence([])
          setGiftSales([]); setSkillExchange(null)
          saleState.current = EMPTY_SALE_STATE
        }
        flushOcrPopup = () => {
          const lane = pool.popup
          if (!alive(lane) || lane.inFlight || !lane.ready) return
          const item = takePopup(popupQueue)
          if (!item) return
          lane.inFlight = true
          lane.activeRequest = item.requestId
          lane.worker.postMessage({ type: 'popup', ...item }, [item.frame])
        }
        const recognize = async () => {
          const lane = pool.screen
          const now = Date.now()
          const profile = profileRef.current
          // A fusion confirmation dialog is often up for about a second: read the fusion screen more often.
          // The classifier may miss the fusion screen (read as the shop, or another UI theme): its title read recently counts too.
          // The sell window counts too: its confirmation dialog is up for only 0.5-0.7 s. So does the skill replacement window.
          const fusionScreen = onFusionScreen(latestLabel.current, fusionTitleAt.current, now) ||
            now - sellWindowAt.current < 3000 || now - skillWindowAt.current < 3000
          const want = detectionRef.current
          // Gifts alone still read the screen at the idle rate: only OCR finds the fusion and sell screens when the classifier misses them.
          if (!want.events && !want.themes && !want.gifts) return
          const interval = fusionScreen ? Math.min(400, profile.recognizeMs.event)
            : now - eventHintAt < 5000 ? profile.recognizeMs.event : profile.recognizeMs.idle
          // With one shared worker, queued popups go first, but only for one extra interval.
          const shared = pool.popup === pool.screen
          if (!alive(lane) || lane.inFlight || !lane.ready || now - recognizedAt < interval ||
            (shared && popupQueue.current.length && now - recognizedAt < interval * 2) || !hasFrame()) return
          recognizedAt = now
          lane.inFlight = true
          const requestId = ++ocrRequestId.current
          lane.activeRequest = requestId
          try {
            // Capture time is taken before the copy, so every read of this frame is dated by when it was on screen.
            const at = Date.now()
            const frame = await grabBitmap()
            if (!alive(lane)) { frame.close(); return }
            ocrCapture.current = { at, floor: currentFloor.current, width: frame.width, height: frame.height }
            // The fusion screen belongs to the shop and may be classified either way; one copy at a time, closed on the next.
            if (latestLabel.current === 'shop' || latestLabel.current === null || onFusionScreen(latestLabel.current, fusionTitleAt.current, at)) {
              const copy = await createImageBitmap(frame)
              fusionFrame.current?.frame.close()
              fusionFrame.current = { frame: copy, at }
            }
            lane.worker.postMessage({ type: 'recognize', requestId, frame, detSide: profile.fullFrameDetSide,
              grid: profile.fullFrameGrid, tileScale: profile.fullFrameTileScale }, [frame])
          } catch {
            ocrFail(lane)
          }
        }
        // The exploration banner is Korean; other OCR languages cannot read it. Right after a banner was read it is read
        // again sooner while that map screen is still up.
        const explore = async () => {
          const lane = pool.screen
          const now = Date.now()
          const profile = profileRef.current
          const base = bannerRecent ? profile.exploreMs.recent : profile.exploreMs.idle
          const delay = now - explorationHintAt < 3000 ? Math.min(base, profile.exploreMs.recent) : base
          const shared = pool.popup === pool.screen
          // With one shared worker, popups go first, but a steady stream of detections must not starve the banner.
          if (!alive(lane) || !detectionRef.current.themes || language !== 'ko' || !themeReferences.current?.length || lane.inFlight || !lane.ready || now - exploredAt < delay ||
            (shared && popupQueue.current.length && delay >= profile.exploreMs.idle && now - exploredAt < delay * 2) ||
            !hasFrame()) return
          exploredAt = now
          lane.inFlight = true
          const requestId = ++ocrRequestId.current
          lane.activeRequest = requestId
          try {
            const frame = await grabBitmap()
            if (!alive(lane)) { frame.close(); return }
            exploreCapture.current = { at: Date.now(), requestId }
            lane.worker.postMessage({ type: 'explore', requestId, frame }, [frame])
          } catch {
            ocrFail(lane)
          }
        }
        promptEventOcr = () => { void recognize() }
        promptExplore = () => { void explore() }
        const handle = (lane: OcrLane) => (event: MessageEvent<{ type: string; requestId?: number; text?: string; words?: OcrWord[];
          floorText?: string; themeReads?: OcrWord[][]; engine?: string; adapter?: string; loading?: boolean; reason?: string;
          header?: string; label?: string; labelWords?: OcrWord[]; labels?: PopupLabelRead[]; body?: string; lexicon?: { id?: unknown } | null }>) => {
          if (!alive(lane)) return
          const result = event.data
          const mine = result.requestId === lane.activeRequest && lane.inFlight
          if (result.type === 'backend') {
            lane.engine = { engine: result.engine === 'paddle' ? 'paddle' : 'tesseract',
              adapter: result.engine === 'paddle' && typeof result.adapter === 'string' ? result.adapter.slice(0, 60) : '',
              loading: result.engine !== 'paddle' && result.loading === true,
              ...(typeof result.reason === 'string' ? { reason: result.reason.slice(0, 40) } : {}) }
            publishEngine()
          } else if (result.type === 'ready') {
            lane.ready = true
            // Older worker bundles never report a backend; they only read with Tesseract.
            lane.engine ??= { engine: 'tesseract', adapter: '', loading: false }
            publishEngine()
            if (lane === pool.popup) { ocrReady.current = true; setOcrStatus('running'); flushOcrPopup() }
            if (lane === pool.screen && !pool.started) {
              pool.started = true
              if (ocrTimer.current) clearInterval(ocrTimer.current)
              if (exploreTimer.current) clearInterval(exploreTimer.current)
              every(ocrTimer, 250, () => { void recognize() })
              every(exploreTimer, 300, () => { void explore() })
              void recognize()
            }
          } else if (result.type === 'result' && mine && typeof result.text === 'string' && Array.isArray(result.words)) {
            lane.inFlight = false
            const capture = ocrCapture.current
            ocrCapture.current = null
            // A read of an older frame never replaces a newer one (results can arrive out of order after a rebuild).
            if (capture && capture.at > lastScreenAt && capture.floor === currentFloor.current && Date.now() < capture.at + 6000) {
              lastScreenAt = capture.at
              const document = { text: result.text, words: result.words }
              const matches = ocrReferences.current ? { ...matchOcrCandidates(document, ocrReferences.current),
                ...eventScreenEvidence(document, ocrReferences.current) }
                : { gifts: [], events: [], choices: [], scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }
              const want = detectionRef.current
              setOcrCandidates({ ...matches, ...(want.gifts ? {} : { gifts: [] }),
                ...(want.events ? {} : { events: [], choices: [], scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }),
                observedAt: capture.at, expiresAt: capture.at + 6000, floor: capture.floor })
              const headerFloor = themeSelectionHeaderFloor(result.text)
              if (headerFloor !== null && want.themes) setThemeSelectionFloor({ floor: headerFloor, observedAt: capture.at })
              if (want.gifts) readSale(result.text, result.words, capture)
              readSkillWindow(result.text, capture.at)
              const confirmation = fusionConfirmation(result.text)
              const fusionScreen = showsFusionTitle(result.text)
              if (fusionScreen) {
                sampleRecorder.current?.begin('fusion')
                fusionTitleAt.current = Math.max(fusionTitleAt.current, capture.at)
                // The PiP and scene consumers follow the same fusion decision as the reader, whatever the classifier said.
                setScene(current => current?.label === 'fusion' || current?.label === 'gift_acquired' ? current : { label: 'fusion', since: capture.at })
              }
              screenReads.current = [...screenReads.current.filter(item => capture.at - item.at < 10_000), { at: capture.at, fusion: fusionScreen }]
              // A result with no dialog seen (dialoglessFusionResult): its materials come from the wheel states before it,
              // read like a dialog's, with the capacity of this session's earlier dialog.
              for (const pending of dialoglessResults.current.filter(item => item.capturedAt < capture.at)) {
                // A dialog still being read (an earlier fusion) finishes first; the result waits for a later screen read.
                if (fusionDialog.current && !fusionDialog.current.published && capture.at - pending.capturedAt < 8000) continue
                dialoglessResults.current = dialoglessResults.current.filter(item => item !== pending)
                const previous = screenReads.current.filter(item => item.at < pending.capturedAt).at(-1)
                // A dialog seen only now (its read came late) may still explain the result.
                const late = dialogForResult(seenDialogs.current, pending.capturedAt)
                if (late) { late.resultAt = pending.capturedAt; continue }
                // The read after the result (the first one taken once it was captured) decides, even if evaluated later.
                const next = screenReads.current.find(item => item.at > pending.capturedAt) ?? { at: capture.at, fusion: fusionScreen }
                if (fusionDialog.current && !fusionDialog.current.published) continue
                if (!dialoglessFusionResult(pending.capturedAt, previous, next, false)) continue
                const after = lastDialogAt.current + WHEEL_AFTER_DIALOG_MS
                const wheel = wheelReadOrder(wheelFrames.current.filter(item => item.at < pending.capturedAt && item.lastAt > after &&
                  item.lastAt >= pending.capturedAt - DIALOGLESS_WHEEL_MS && showsWheel(item, wheelReference.current)), pending.capturedAt, 600)
                if (!wheel.length) continue
                // The session's shop capacity; before any dialog was seen, decided after reading the states in both layouts.
                const known = lastCapacity.current && capture.at - lastCapacity.current.at < CAPACITY_KEEP_MS ? lastCapacity.current.capacity : null
                const capacity = known ?? 3
                wheelFrames.current = wheelFrames.current.filter(item => !wheel.includes(item))
                for (const item of fusionDialog.current?.wheel.splice(0) ?? []) item.frame.close()
                fusionDialog.current = { token: `${run}:fusion:${pending.capturedAt}`, count: capacity, capacity, firstAt: Math.min(...wheel.map(item => item.at)),
                  lastSeenAt: Math.max(...wheel.map(item => item.lastAt)),
                  reads: [], wheel, published: false, dialogless: true, undecided: known === null }
                takeWheelReads(fusionDialog.current)
                fusionWanted.current = { count: capacity, capacity, at: Date.now() }
                lastDialogAt.current = Math.max(lastDialogAt.current, pending.capturedAt)
              }
              // OCR positions are on the reading canvas (at most 1920 px wide); the slot crops use full-size frames.
              const factor = capture.width ? capture.width / Math.min(capture.width, 1920) : 1
              const box = (rect: { left: number; top: number; width: number; height: number }) =>
                ({ left: rect.left * factor, top: rect.top * factor, width: rect.width * factor, height: rect.height * factor })
              if (isFusionSelectionScreen(result.text)) {
                // Where the wheel is on this capture (window title bar, scaling), for the crops kept from now on.
                const found = fusionWheelAnchors(result.words)
                if (found && (!wheelAnchors.current || capture.at >= wheelAnchors.current.at)) {
                  wheelAnchors.current = { anchors: { title: box(found.title), wish: box(found.wish) }, at: capture.at }
                }
                const shown = wheelFrames.current.find(item => item.at <= capture.at + 100 && capture.at <= item.lastAt + 200)
                if (shown?.band) wheelReference.current = shown.band
              }
              // The selection screen or an acquisition popup without the dialog: a dialog read after it is a new fusion.
              if (!confirmation && (isFusionSelectionScreen(result.text) || /획득했습니다/.test(result.text.normalize('NFKC').replace(/\s+/g, '')))) {
                dialogBreakAt.current = Math.max(dialogBreakAt.current, capture.at)
              }
              if (confirmation) {
                sampleRecorder.current?.begin('fusion')
                // The shop capacity (3 normal, 5 special) picks the dialog's slot layout.
                const { count, capacity } = confirmation
                const found = fusionAnchors(result.words)
                const anchors = found ? { header: box(found.header), question: box(found.question) } : undefined
                // The same dialog while it keeps being seen; rapid fusions reopen one with the same N/M within a second, so
                // a result or a screen without it captured in between starts a new one.
                const dialog = fusionDialog.current
                if (dialog && !dialog.dialogless && continuesFusionDialog({ ...dialog, resultAt: dialog.seen?.resultAt }, count, capacity, capture.at,
                  dialogBreakAt.current)) {
                  dialog.lastSeenAt = Math.max(dialog.lastSeenAt, capture.at)
                  if (dialog.seen) dialog.seen.lastSeenAt = dialog.lastSeenAt
                  const lastSeenAt = dialog.lastSeenAt
                  if (dialog.published) updateFusion(dialog.token, { lastSeenAt })
                } else {
                  // A new dialog takes the wheel crops captured before it and after the previous dialog, newest first.
                  const after = lastDialogAt.current + WHEEL_AFTER_DIALOG_MS
                  const wheel = wheelReadOrder(wheelFrames.current.filter(item => item.at < capture.at && item.lastAt > after &&
                    showsWheel(item, wheelReference.current)), capture.at, WHEEL_BEFORE_DIALOG_MS)
                  wheelFrames.current = wheelFrames.current.filter(item => {
                    if (wheel.includes(item)) return false
                    if (item.at < capture.at) { item.frame.close(); return false }
                    return true
                  })
                  // An earlier dialog still being read publishes what it has before this one replaces it.
                  if (fusionDialog.current && !fusionDialog.current.published) finishFusionDialog()
                  for (const item of fusionDialog.current?.wheel.splice(0) ?? []) item.frame.close()
                  const seen: SeenDialog = { firstAt: capture.at, lastSeenAt: capture.at }
                  seenDialogs.current = [...seenDialogs.current.filter(item => capture.at - item.lastSeenAt < 60_000).slice(-7), seen]
                  fusionDialog.current = { token: `${run}:fusion:${capture.at}`, count, capacity, firstAt: capture.at, lastSeenAt: capture.at, reads: [], wheel,
                    published: false, seen }
                  takeWheelReads(fusionDialog.current)
                }
                lastDialogAt.current = Math.max(lastDialogAt.current, capture.at)
                lastCapacity.current = { capacity, at: capture.at }
                if (!fusionDialog.current!.published) {
                  fusionWanted.current = { count, capacity, at: capture.at, anchors }
                  if (fusionFrame.current?.at === capture.at) {
                    fusionFrameToRead.current?.frame.close()
                    fusionFrameToRead.current = { ...fusionFrame.current, count, capacity, anchors }
                    fusionFrame.current = null
                  }
                }
              } else {
                // Closed without a result (e.g. cancelled): later acquisitions are not this dialog's result.
                const dialog = fusionDialog.current
                if (dialog && dialog.closedAt === undefined && fusionDialogClosed(result.text, capture.at, dialog.lastSeenAt)) {
                  const closedAt = capture.at
                  dialog.closedAt = closedAt
                  if (dialog.seen) dialog.seen.closedAt = closedAt
                  if (dialog.published) updateFusion(dialog.token, { closedAt })
                }
              }
            }
            flushOcrPopup()
          } else if (result.type === 'popupResult' && mine &&
            typeof result.header === 'string' && typeof result.label === 'string' && Array.isArray(result.labelWords)) {
            lane.inFlight = false
            const pending = popupPending.current.get(result.requestId!)
            // Older worker bundles send only the raw plate read and no effect panel.
            const labels = Array.isArray(result.labels) && result.labels.every(read => typeof read?.text === 'string' &&
              Array.isArray(read.words)) ? result.labels : [{ text: result.label, words: result.labelWords }]
            const body = typeof result.body === 'string' ? result.body : ''
            const lexiconId = typeof result.lexicon?.id === 'string' ? result.lexicon.id : null
            if (pending) { pending.ocr = { header: result.header, labels, body, lexiconId }; finishPopup(result.requestId!) }
            flushOcrPopup()
          } else if (result.type === 'exploreResult' && mine) {
            lane.inFlight = false
            const capture = exploreCapture.current
            exploreCapture.current = null
            const floorSeen = typeof result.floorText === 'string' ? explorationFloor(result.floorText) : null
            bannerRecent = floorSeen !== null
            const reads = Array.isArray(result.themeReads) ? result.themeReads.filter(Array.isArray).map(read =>
              read.filter(word => typeof word?.text === 'string')) : []
            const themeIds = themeReferences.current ? explorationThemeMatch(reads, themeReferences.current) : []
            if (capture && capture.requestId === result.requestId && floorSeen !== null) {
              const previous = lastFloorRead.current
              const elapsed = previous ? capture.at - previous.at : -1
              if (previous?.floor === floorSeen && elapsed >= 1000 && elapsed <= 60000) setObservedFloor(floorSeen)
              if (!previous || capture.at > previous.at) lastFloorRead.current = { floor: floorSeen, at: capture.at }
            }
            // Unreadable captures neither confirm nor break the chain; a different readable scene restarts it.
            if (capture && capture.requestId === result.requestId && floorSeen !== null && themeIds.length &&
              (!lastExploration.current || capture.at > lastExploration.current.observedAt)) {
              const observation = { floor: floorSeen, themeIds, observedAt: capture.at }
              if (confirmsExploration(lastExploration.current, observation)) {
                setFloorThemeObservation({ ...observation, token: `${floorSeen}:${themeIds.join('|')}` })
              }
              lastExploration.current = observation
            }
            flushOcrPopup()
          } else if (result.type === 'popupError' && mine) {
            lane.inFlight = false
            popupPending.current.delete(result.requestId!)
            flushOcrPopup()
          } else if (result.type === 'error' || (mine && (result.type === 'result' || result.type === 'popupResult'))) {
            ocrFail(lane)
          }
        }
        for (const lane of pool.lanes) {
          lane.worker.onmessage = handle(lane)
          lane.worker.onerror = () => ocrFail(lane)
          // Gift names let the GPU reader decode popup plates against the catalog (lexicon CTC).
          lane.worker.postMessage({ type: 'init', language,
            giftNames: (ocrReferences.current?.gifts ?? []).flatMap(gift => gift.texts[0] ? [{ id: gift.id, name: gift.texts[0] }] : []) })
        }
        /** Mode change while capturing: a new pool replaces this one; the screen share and scene worker are kept. */
        return () => {
          for (const lane of pool.lanes) { dropInFlight(lane); disposeLane(lane) }
          if (ocrPool.current === pool) ocrPool.current = null
          if (ocrTimer.current) clearInterval(ocrTimer.current)
          ocrTimer.current = null
          if (exploreTimer.current) clearInterval(exploreTimer.current)
          exploreTimer.current = null
          ocrReady.current = false
        }
      }
      if (ocrReferences.current && Object.values(ocrReferences.current).some(items => items.length > 0)) {
        try {
          let disposePool = buildOcrPool()
          rebuildOcr.current = () => {
            if (run !== generation.current) return
            disposePool()
            disposePool = buildOcrPool()
          }
        } catch {
          for (const lane of ocrPool.current?.lanes ?? []) lane.worker.terminate()
          ocrPool.current = null
          setOcrStatus('error')
        }
      }
      let inferredAt = 0
      const readFusionSlots = async () => {
        const wanted = fusionWanted.current
        if (!wanted || inFlight.current || !hasFrame()) return false
        if (Date.now() - wanted.at > 6000) {
          finishFusionDialog()
          return false
        }
        const dialog = fusionDialog.current
        if (dialog) takeWheelReads(dialog)
        if (dialog?.published) return false
        if (dialog) {
          // The wheel states go first: the selection is complete there even when the dialog closes before its slots fill.
          decideCapacity(dialog, false)
          const capacities = dialog.undecided ? [3, 5] : [dialog.capacity]
          const state = dialog.wheel.find(item => capacities.some(capacity => !item.reads[capacity]))
          if (state) return readWheelState(state, capacities.find(capacity => !state.reads[capacity])!)
          decideCapacity(dialog, true)
        }
        if (dialog?.dialogless) { finishFusionDialog(); return false }
        const retained = fusionFrameToRead.current
        if (!retained && fusionRequest.current && Date.now() - fusionRequest.current.at < 350) return false
        inFlight.current = true
        try {
          if (retained) {
            // The frame the dialog was read from goes first; later captures may already show the result.
            fusionFrameToRead.current = null
            if (run !== generation.current || !worker.current) { retained.frame.close(); inFlight.current = false; return true }
            const requestId = ++ocrRequestId.current
            fusionRequest.current = { requestId, at: retained.at, count: retained.count, token: fusionDialog.current?.token ?? '', view: 'dialog' }
            worker.current.postMessage({ type: 'fusion-slots', requestId, frame: retained.frame, count: retained.count, capacity: retained.capacity,
              anchors: retained.anchors }, [retained.frame])
            return true
          }
          const at = Date.now()
          const frame = await grabBitmap()
          if (run !== generation.current || !worker.current) { frame.close(); return true }
          const requestId = ++ocrRequestId.current
          fusionRequest.current = { requestId, at, count: wanted.count, token: fusionDialog.current?.token ?? '', view: 'dialog' }
          worker.current.postMessage({ type: 'fusion-slots', requestId, frame, count: wanted.count, capacity: wanted.capacity, anchors: wanted.anchors }, [frame])
        } catch { inFlight.current = false }
        return true
      }
      let wheelBusy = false
      /** Keeps a small crop of the selection wheel while the fusion screen is up (bounded ring, no inference here). */
      const sampleWheel = async () => {
        const now = Date.now()
        const pruned = wheelFrames.current.filter(item => now - item.lastAt <= WHEEL_KEEP_MS)
        for (const item of wheelFrames.current) if (!pruned.includes(item)) item.frame.close()
        wheelFrames.current = pruned
        if (wheelBusy || !onFusionScreen(latestLabel.current, fusionTitleAt.current, now)) return
        const source = openFrame()
        if (!source) return
        wheelBusy = true
        try {
          const frameSize = { width: source.width, height: source.height }
          const anchors = wheelAnchors.current?.anchors
          const crop = fusionWheelCrop(frameSize.width, frameSize.height, anchors)
          const scale = Math.min(1, WHEEL_CROP_WIDTH / crop.width)
          const frame = await createImageBitmap(source.source, crop.x, crop.y, crop.width, crop.height,
            scale < 1 ? { resizeWidth: Math.round(crop.width * scale), resizeHeight: Math.round(crop.height * scale), resizeQuality: 'high' } : undefined)
          if (run !== generation.current) { frame.close(); return }
          const signature = wheelSignature(frame)
          const box = fusionWheelResultBox(frameSize.width, frameSize.height, anchors)
          const band = resultBoxBand(frame, (box.x - box.size / 2 - crop.x) * scale, (box.y - box.size / 2 - crop.y) * scale, box.size * scale)
          const last = wheelFrames.current.at(-1)
          if (last && sameWheel(last.signature, signature) && last.origin.x === crop.x && last.origin.y === crop.y && sameAnchors(last.anchors, anchors)) {
            last.lastAt = now
            frame.close()
            return
          }
          wheelFrames.current.push({ frame, at: now, lastAt: now, signature, band, origin: { x: crop.x, y: crop.y }, scale, frameSize, anchors, reads: {} })
          sampleRecorder.current?.begin('fusion')
          while (wheelFrames.current.length > WHEEL_FRAMES) wheelFrames.current.shift()!.frame.close()
        } catch { /* A missed crop only thins the wheel history. */ } finally { source.release(); wheelBusy = false }
      }
      /** Reads one wheel state in one layout into its cache (a copy of its frame goes to the worker; it may be read again). */
      const readWheelState = async (state: WheelFrame, capacity: number) => {
        inFlight.current = true
        try {
          const frame = await createImageBitmap(state.frame)
          if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return true }
          const requestId = ++ocrRequestId.current
          wheelRequest.current = { requestId, state, capacity }
          worker.current.postMessage({ type: 'fusion-wheel', requestId, frame, capacity, origin: state.origin, scale: state.scale,
            frameSize: state.frameSize, anchors: state.anchors }, [frame])
        } catch {
          // A state whose frame is gone cannot be read; it counts as read (with nothing) so the queue moves on.
          state.reads[capacity] = { view: 'wheel', slots: [], observedAt: state.at }
          inFlight.current = false
        }
        return true
      }
      /** Reads the newest unread wheel state while the fusion screen is up and the worker has nothing else to do. */
      const preReadWheel = async () => {
        const now = Date.now()
        if (inFlight.current || popupVisionQueue.current.length || !worker.current || !onFusionScreen(latestLabel.current, fusionTitleAt.current, now)) return false
        // The shop capacity of this session when known; otherwise both layouts (the first fusion of a session).
        const capacities = lastCapacity.current && now - lastCapacity.current.at < CAPACITY_KEEP_MS ? [lastCapacity.current.capacity] : [3, 5]
        const after = lastDialogAt.current + WHEEL_AFTER_DIALOG_MS
        const state = [...wheelFrames.current].reverse().find(item => item.lastAt > after && capacities.some(capacity => !item.reads[capacity]) &&
          showsWheel(item, wheelReference.current))
        const capacity = state && capacities.find(item => !state.reads[item])
        if (!state || capacity === undefined) return false
        return readWheelState(state, capacity)
      }
      const capture = async () => {
        // A queued acquisition icon goes before any fusion read (those take a few hundred ms).
        if (popupVisionQueue.current.length && !inFlight.current) {
          flushVisionPopup()
          if (inFlight.current) return
        }
        const gifts = detectionRef.current.gifts
        if (gifts && fusionWanted.current && await readFusionSlots()) return
        if (gifts && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20 && await preReadWheel()) return
        // Popup icons go first, but scene inference still runs at least every 3s.
        if (inFlight.current || Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20 ||
          (popupVisionQueue.current.length && Date.now() - inferredAt < 3000) || !hasFrame()) return
        inferredAt = Date.now()
        inFlight.current = true
        try {
          const frame = await grabBitmap()
          if (run !== generation.current || !worker.current) {
            frame.close()
            return
          }
          visualCapture.current = { at: Date.now(), floor: currentFloor.current }
          worker.current.postMessage({ type: 'infer', frame }, [frame])
        } catch (reason) {
          if (run === generation.current) fail(reason instanceof Error ? reason.message : 'Frame capture failed')
        }
      }
      vision.onmessage = (event: MessageEvent<{ type: string; label?: string; confidence?: number; gifts?: unknown;
        events?: unknown; requestId?: number; message?: string; provider?: string; adapter?: string }>) => {
        if (run !== generation.current) return
        const result = event.data
        if (result.type === 'ready') {
          setInference({ provider: result.provider === 'webgpu' ? 'webgpu' : 'wasm',
            adapter: typeof result.adapter === 'string' ? result.adapter.slice(0, 60) : '' })
          setStatus('running')
          every(timer, 250, () => { void capture() })
          every(wheelTimer, 150, () => { void sampleWheel() })
          // Polled at a low rate from the real queues; React only re-renders when a count changes.
          statusTimer.current = setInterval(() => {
            if (run !== generation.current) return
            const text = popupQueue.current.length, image = popupVisionQueue.current.length
            const frames = new Set([...popupQueue.current, ...popupVisionQueue.current].map(item => item.requestId)).size
            const analyzing = Number(inFlight.current) + (ocrPool.current?.lanes.filter(lane => lane.inFlight).length ?? 0)
            setQueueStatus(current => current.analyzing === analyzing && current.frames === frames && current.text === text &&
              current.image === image ? current : { analyzing, frames, text, image })
          }, 500)
          const Processor = (globalThis as unknown as { MediaStreamTrackProcessor?: new (options: { track: MediaStreamTrack }) =>
            { readable: ReadableStream<VideoFrame> } }).MediaStreamTrackProcessor
          try {
            if (Processor) {
              const reader = new Processor({ track }).readable.getReader()
              popupReader.current = reader
              void (async () => {
                let lastSample = 0
                try {
                  while (run === generation.current) {
                    const { value, done } = await reader.read()
                    if (done) break
                    try {
                      latestFrame.current?.close()
                      latestFrame.current = value.clone()
                      if (samplesRef.current) {
                        reportTally.current ??= new AssistReportTally(readReportContext)
                        ;(sampleRecorder.current ??= new AssistSampleRecorder(readSampleContext)).offer(value)
                      } else if (sampleRecorder.current) { sampleRecorder.current.close(); sampleRecorder.current = null; reportTally.current = null }
                      const now = performance.now()
                      if (now - lastSample >= 33) { lastSample = now; await samplePopup(value) }
                      frameTasks.current = frameTasks.current.filter(task => task.live())
                      for (const task of frameTasks.current) runFrameTask(task)
                    } finally { value.close() }
                  }
                } catch { /* A failed frame reader falls back to the video element. */ }
                finally {
                  if (popupReader.current === reader) {
                    popupReader.current = null
                    latestFrame.current?.close()
                    latestFrame.current = null
                    popupTimer.current = setInterval(() => { if (video.current) void samplePopup(video.current) }, 50)
                  }
                  try { reader.releaseLock() } catch { /* Cancellation may still be settling. */ }
                }
              })()
            } else popupTimer.current = setInterval(() => { if (video.current) void samplePopup(video.current) }, 50)
          } catch {
            popupTimer.current = setInterval(() => { if (video.current) void samplePopup(video.current) }, 50)
          }
          void capture()
        } else if (result.type === 'prediction' && typeof result.label === 'string' &&
          typeof result.confidence === 'number' && Number.isFinite(result.confidence) &&
          result.confidence >= 0 && result.confidence <= 1 && validMatches(result.gifts) && validMatches(result.events)) {
          inFlight.current = false
          latestLabel.current = result.confidence >= 0.5 ? result.label : latestLabel.current
          setPrediction({ label: result.label, confidence: result.confidence })
          const capture = visualCapture.current
          visualCapture.current = null
          if (capture && capture.floor === currentFloor.current && Date.now() < capture.at + 3000) {
            const want = detectionRef.current
            setVisualCandidates({ gifts: want.gifts ? result.gifts : [], events: want.events ? result.events : [], observedAt: capture.at,
              expiresAt: capture.at + 3000, floor: capture.floor })
            if (result.confidence >= 0.5) {
              const candidate = sceneCandidate.current
              if (candidate?.label === result.label) candidate.count++
              else sceneCandidate.current = { label: result.label, at: capture.at, count: 1 }
              const held = sceneCandidate.current!
              // A recently read fusion title outranks the classifier (it learned the brown UI only); gift popups still show.
              const label = held.label !== 'gift_acquired' && onFusionScreen(null, fusionTitleAt.current, Date.now()) ? 'fusion' : held.label
              if (held.count >= 2) setScene(current => current?.label === label ? current : { label, since: held.at })
            }
            // Event screens and pack selection headers are read by full-frame OCR, so both ask for it promptly.
            // Fusion screens are read too: their confirmation dialog names how many materials are about to be consumed.
            const sure = result.confidence >= 0.5
            if ((want.events && (result.events.length || (sure && result.label === 'event'))) ||
              (sure && ((want.themes && result.label === 'theme_select') || (want.gifts && (result.label === 'fusion' || result.label === 'sell'))))) {
              eventHintAt = Date.now()
              promptEventOcr()
            } else if (want.themes && result.label === 'exploration' && sure) {
              explorationHintAt = Date.now()
              promptExplore()
            }
          }
          flushVisionPopup()
        } else if (result.type === 'fusion-slots' && wheelRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const { state, capacity } = wheelRequest.current!
          wheelRequest.current = null
          const slots = parseFusionSlots((result as { slots?: unknown }).slots, capacity)
          state.reads[capacity] = { view: 'wheel', slots: slots ?? [], observedAt: state.at }
          flushVisionPopup()
        } else if (result.type === 'fusion-slots' && fusionRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const request = fusionRequest.current!
          const slots = parseFusionSlots((result as { slots?: unknown }).slots, request.count)
          const dialog = fusionDialog.current
          if (slots && dialog && !dialog.published && dialog.token === request.token) {
            dialog.reads.push({ view: request.view, slots, observedAt: request.at })
            // Every material known, or the result is already on screen (the dialog closed) and no frame is left to read.
            if (fusionMaterials(dialog.reads, dialog.count, dialog.capacity).length === dialog.count ||
              (dialog.dialogless && !dialog.wheel.length) ||
              (heldAcquisitions.current.length && !fusionFrameToRead.current && !dialog.wheel.length)) finishFusionDialog()
          }
          flushVisionPopup()
        } else if (result.type === 'popup-icon' && Number.isSafeInteger(result.requestId) && validMatches(result.gifts)) {
          inFlight.current = false
          const pending = popupPending.current.get(result.requestId!)
          if (pending) { pending.icon = result.gifts; finishPopup(result.requestId!) }
          flushVisionPopup()
        } else if (result.type === 'prediction') {
          fail('Invalid scene prediction')
        } else if (result.type === 'error') {
          fail(result.message ?? 'Scene classification failed')
        }
      }
      vision.onerror = () => fail('Scene worker failed')
      vision.postMessage({ type: 'init', ...references.current })
    } catch (reason) {
      if (run !== generation.current) return
      cleanup()
      setPrediction(null)
      setVisualCandidates(null)
      setOcrCandidates(null)
      setOcrStatus('idle')
      setFloorThemeObservation(null)
      setQueueStatus(IDLE_QUEUE)
      setInference(null)
      setOcrEngine(null)
      setOcrWorkers(0)
      setFusionEvidence([])
      setGiftSales([]); setSkillExchange(null)
      saleState.current = EMPTY_SALE_STATE
      setObservedFloor(null)
      setScene(null)
      setThemeSelectionFloor(null)
      setError(reason instanceof Error ? reason.message : 'Screen sharing unavailable')
      setStatus('error')
    }
  }, [cleanup, stop, language])

  /** The skill replacement window stays shown until 1.5 s of reads without it, so one missed read does not flicker. */
  function readSkillWindow(text: string, at: number) {
    const read = readSkillExchange(text)
    if (read) skillWindowAt.current = at
    setSkillExchange(previous => {
      if (!read) return previous && at - previous.seenAt > 1500 ? null : previous
      // A read with misread counts keeps the last counts of the same sinner.
      return { sinner: read.sinner, current: read.current ?? (previous?.sinner === read.sinner ? previous.current : null), seenAt: at }
    })
  }

  /** Shop sales from one full-frame read; the decision is readSaleStep (lib/vision/sell-evidence.ts). */
  function readSale(text: string, words: OcrWord[], capture: { at: number; width?: number; height?: number }) {
    const scale = capture.width ? Math.min(1, 1920 / capture.width) : 1
    const cost = capture.width && capture.height ? sellCost(words, Math.round(capture.width * scale), Math.round(capture.height * scale)) : []
    if (isSellWindow(text)) sellWindowAt.current = capture.at
    const step = readSaleStep(saleState.current, { at: capture.at, text, cost,
      giftId: name => ocrReferences.current ? sellGiftId(name, ocrReferences.current.gifts) : null })
    saleState.current = step.state
    // One sale is one sample group: settled by a sale, uploaded when its dialog could not be read.
    if (step.state.dialog || isSellWindow(text)) sampleRecorder.current?.begin('sale')
    if (step.sold.length) settleSample('sale', 'sale', null)
    else if (!step.state.dialog && text.replace(/\s+/g, '').includes('판매하시겠')) settleSample('sale', 'sale', { reason: 'sale-unresolved' })
    if (step.sold.length) setGiftSales(items => [...items, ...step.sold.map(sale =>
      ({ giftId: sale.giftId, token: `sell:${sale.at}:${sale.giftId}`, capturedAt: sale.at }))].slice(-8))
  }

  // Reports also leave with the page and every 15 minutes of a long capture.
  useEffect(() => {
    const interval = setInterval(flushReport, 15 * 60_000)
    window.addEventListener('pagehide', flushReport)
    return () => { clearInterval(interval); window.removeEventListener('pagehide', flushReport) }
  }, [])
  /** The run's inventory changed; edits by hand (not inside CompanionPanel's automatic records) become report labels. */
  const reportInventoryChange = useCallback((before: readonly string[], after: readonly string[]) => {
    reportTally.current?.inventoryChanged(before, after)
  }, [])

  return { supported, status, error, prediction, visualCandidates, ocrCandidates, ocrStatus,
    popupAcquisitions, floorThemeObservation, observedFloor, scene, themeSelectionFloor, queueStatus, mobile, inference, ocrEngine,
    ocrWorkers, fusionEvidence, giftSales, skillExchange, start, stop, reportInventoryChange }
}

/**
 * Fresh screen evidence for the recorded floor: the one event whose choices or intro are shown (image or event text must
 * identify it first; its result page never opens a summary). How long a summary stays is decided by the scene.
 */
export function captureEvidence({ status, visualCandidates, ocrCandidates }: {
  status: CaptureStatus
  visualCandidates: (VisualCandidates & { floor: number | null }) | null
  ocrCandidates: OcrCandidates | null
}, floor: number | null, now: number) {
  const visual = status === 'running' && visualCandidates && visualCandidates.floor === floor && visualCandidates.expiresAt > now
    ? visualCandidates : null
  const ocr = status === 'running' && ocrCandidates && ocrCandidates.floor === floor && ocrCandidates.expiresAt > now
    ? ocrCandidates : null
  // Events named by their own text; shared art alone never names an event.
  const textEventIds = [...new Set([...(ocr?.events.map(item => item.id) ?? []), ...(ocr?.choiceEventIds ?? []),
    ...(ocr?.bodyEventIds ?? [])])]
  const corroboratedEventIds = [...(visual?.events.map(item => item.id) ?? []), ...textEventIds]
  const listedEventId = ocr ? corroboratedChoiceEvent({ choices: ocr.choices, scopedChoices: ocr.scopedChoices,
    outcomeEventIds: ocr.outcomeEventIds, corroboratedEventIds }) : null
  // Intro and narration pages: one text-identified event previews its known outcomes until its result page appears.
  const choiceEventId = listedEventId ?? (ocr && textEventIds.length === 1 && !ocr.outcomeEventIds.includes(textEventIds[0])
    ? textEventIds[0] : null)
  const eventChoiceEvidence = choiceEventId === null || !ocr ? null
    : { eventId: Number(choiceEventId), observedAt: ocr.observedAt, floor: ocr.floor }
  return { visualCandidates: visual, ocrCandidates: ocr, eventChoiceEvidence }
}
