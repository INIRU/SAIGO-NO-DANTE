'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VisualCandidates, VisualReference } from '@/lib/vision/embedding-match'
import { corroboratedChoiceEvent, effectGiftIds, eventScreenEvidence, matchOcrCandidates, type EventScreenEvidence, type OcrCatalog, type OcrMatches,
  type OcrWord } from '@/lib/vision/ocr-match'
import { acquiredGiftFromPopup, acquisitionFloor, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS, popupCandidateIds, popupHeaderEvidence, showsAcquiredHeader, type PopupLabelRead } from '@/lib/vision/popup-evidence'
import type { RecipePopupEvidence } from '@/lib/planner/fusion'
import type { ShopShelf } from '@/lib/vision/shop-shelf'
import type { OwnedGridRead } from '@/lib/vision/owned-grid'
import type { FormationRead } from '@/lib/vision/formation-bar'
import { gameTextPieces } from '@/lib/vision/text-normalize'
import { SCREEN_CHANGE, THUMB_HEIGHT, THUMB_WIDTH, greyThumb, thumbDifference } from '@/lib/vision/screen-change'
import { TAPE_EVERY_MS, TAPE_WIDTH } from '@/lib/vision/frame-tape'
import { EMPTY_PICK, RESULT_HEADERS, choiceBands, distinctBoxes, cursorSeen, listMissing, listShown, type CursorSample, type EventPick } from '@/lib/vision/event-pick'
import type { StableScene } from '@/lib/vision/scene-state'
import { cpuFallback, type GpuBlock } from '@/lib/vision/device'
import { RECOGNITION_PROFILES, type RecognitionMode } from '@/lib/vision/recognition-profile'
import { DEFAULT_DETECTION, type DetectionSettings } from '@/lib/vision/detection-settings'
import { AssistSampleRecorder } from '@/lib/vision/assist-samples'
import { AssistReportTally, sendAssistReport, type ReportAction } from '@/lib/vision/assist-report'
import { EMPTY_SALE_STATE, isSellWindow, readSaleStep, sellCost, sellGiftId, sellQuestion } from '@/lib/vision/sell-evidence'
import { readSkillExchange } from '@/lib/vision/skill-exchange'
import { acquisitionSeq, acquisitionsToRelease, continuesFusionDialog, dialogForResult, dialoglessFusionResult, fusionAnchors, fusionConfirmation, fusionDiagnosis, fusionDialogClosed, fusionMaterials, onFusionScreen, showsFusionTitle, fusionWheelAnchors, fusionWheelCrop, fusionWheelResultBox, isFusionSelectionScreen, wheelSelectionSize, emptyWheelResult, popupEndBefore, sameWheelSignature, type FusionAnchors, type FusionDialogEvidence, type FusionRead, type SeenDialog, type WheelAnchors } from '@/lib/vision/fusion-evidence'
import { BLESSING_SCENE, blessingSpent, onBlessingScreen, showsBlessingScreen } from '@/lib/vision/blessing-screen'
import { BONUS_PLACES, bonusCardThemes, offerKey, type ClearBonusCard, type ClearBonusOffer } from '@/lib/vision/clear-bonus'
import { onRunEndScreen, RUN_END_SCENE, showsRunEndScreen } from '@/lib/vision/run-end-screen'
import { isVerbose, plog } from '@/lib/vision/assist-log'
import { parseFusionSlots, WHEEL_FRAMES, WHEEL_KEEP_MS, WHEEL_CROP_WIDTH, WHEEL_AFTER_DIALOG_MS, WHEEL_BEFORE_DIALOG_MS, wheelReadOrder, DIALOGLESS_WHEEL_MS, CAPACITY_KEEP_MS, wheelSignature, showsWheel, resultBoxBand, sameAnchors, FUSION_HOLD_MS, SCREEN_HOLD_MS, OCR_READ_FAILURES, SCENE_READ_FAILURES, OCR_REBUILD_MS, OCR_STABLE_MS, ocrRebuildsAfterRead, ocrErrorAction, parseShopShelf, mobileBlocked, gpuBlocked, canCapture, validMatches, runFrameTask, type WheelFrame, type PopupAcquisition, type GiftSale, type SkillExchangeView, type FloorThemeObservation, type PopupFrame, type PopupPending, type OpenFrame, type FrameTask } from '@/lib/vision/capture-helpers'
export { OCR_READ_FAILURES, SCENE_READ_FAILURES, OCR_REBUILD_MS, OCR_STABLE_MS, ocrRebuildsAfterRead, ocrErrorAction, runFrameTask }
export type { PopupAcquisition, GiftSale, SkillExchangeView, FloorThemeObservation }
import { confirmsExploration, explorationFloor, explorationThemeReads, themeSelectionHeaderFloor, type ExplorationObservation,
  type ExplorationThemeReference } from '@/lib/vision/exploration-match'
import { acquisitionPlate, darkPopupPlate, detectGiftPopupLabel, popupCaptureAction, popupIconSignature, popupLabelColor, popupPriority, popupQuality, POPUP_SETTLE_MS, samePopupEpisode, type PopupObservation } from '@/lib/vision/popup-detect'

type CaptureStatus = 'idle' | 'requesting' | 'loading' | 'running' | 'unsupported' | 'error'
export interface ScenePrediction { label: string; confidence: number }
type OcrStatus = 'idle' | 'loading' | 'running' | 'error'
export interface OcrCandidates extends OcrMatches, EventScreenEvidence { observedAt: number; expiresAt: number; floor: number | null }
/** Worker jobs running now, and queued popup frames counted once per frame (text and image copies listed separately). */
export interface CaptureQueueStatus { analyzing: number; frames: number; text: number; image: number }
const IDLE_QUEUE: CaptureQueueStatus = { analyzing: 0, frames: 0, text: 0, image: 0 }
/** Text reader actually serving capture: GPU PP-OCR once loaded, otherwise Tesseract (also while PP-OCR loads). */
export interface OcrEngineStatus { engine: 'paddle' | 'tesseract'; adapter: string; loading: boolean; reason?: string }
/** `failures`: reads in a row the worker answered with an error (a failed frame, not a dead worker). */
/** `since`: when its current read was sent (a read never answered is given up after OCR_WATCHDOG_MS). */
interface OcrLane { worker: Worker; ready: boolean; inFlight: boolean; activeRequest: number; engine: OcrEngineStatus | null; failures: number; since: number }
/** A scene worker request or a text read with no answer for this long is given up (a stalled GPU must not stop reading for good). */
const SCENE_WATCHDOG_MS = 8000
const OCR_WATCHDOG_MS = 12000
/** OCR workers of one capture: one lane object shared by popups and screen reads, or one worker per lane. */
interface OcrPool { popup: OcrLane; screen: OcrLane; lanes: OcrLane[]; started: boolean }
/** Materials confirmed in one fusion confirmation dialog (slot by slot; unconfirmed slots are left out). */
export interface FusionEvidence extends FusionDialogEvidence { token: string }
// the cursor and the choice boxes come several times a second: kept only while the log is verbose
const FREQUENT = new Set(['cursor', 'bands', 'alone'])
const dlog = (kind: string, ...args: unknown[]) => plog(kind, args.length === 1 ? args[0] : args, FREQUENT.has(kind))
/** The cards with the pack names read for their places (unchanged cards keep their object; the array too when none changed). */
function named(cards: ClearBonusCard[], names: ReadonlyMap<number, string[]>): ClearBonusCard[] {
  let changed = false
  const next = cards.map(card => {
    const ids = names.get(card.place)
    if (!ids || card.themeIds?.join('|') === ids.join('|')) return card
    changed = true
    return { ...card, themeIds: ids }
  })
  return changed ? next : cards
}

export function useAssistCapture({ giftReferences = [], eventReferences = [], ocrCatalog, themeCatalog, language = 'ko', floor = null,
  mode = 'balanced', detection = DEFAULT_DETECTION, resolvePopup, completeFusion, samples = false, heldGiftIds = [], giftPrice }: {
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
  /** A gift's price by its id: a sale whose read price does not fit it (half to the whole price) is not taken. */
  giftPrice?: (giftId: string) => number | null | undefined
  /**
   * Final say on a popup with its header read: its candidate gift ids and the fusion's materials read so far, the
   * recognizer's own verdict (null when it abstained) and whether the fusion screen is up; returns the gift or null.
   * Used for fixed-recipe fusions, whose result follows from their materials.
   */
  resolvePopup?: (evidence: RecipePopupEvidence, verdict: string | null, inFusion: boolean) => string | null
  /**
   * All materials of a fusion whose dialog was read only in part, from its result: the fixed recipe with that many
   * ingredients containing the ones read, or null. Such a fusion counts as read and uploads no sample.
   */
  completeFusion?: (read: readonly string[], count: number, resultId: string) => string[] | null
  /** Opt-in recognition samples (lib/vision/assist-samples.ts); read live. */
  samples?: boolean
  /** The run's inventory: fusion material slots are measured against these gifts (and vestiges). Read live. */
  heldGiftIds?: readonly string[]
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
  // Set when there is no WebGPU to recognize with; capture is refused rather than run on the CPU.
  const [gpu, setGpu] = useState<GpuBlock | null>(null)
  // Image model backend the worker actually created (WebGPU only on a real adapter, otherwise WASM).
  const [inference, setInference] = useState<{ provider: 'webgpu' | 'wasm'; adapter: string } | null>(null)
  const [ocrEngine, setOcrEngine] = useState<OcrEngineStatus | null>(null)
  // OCR workers actually running now (a failed second worker drops this to 1).
  const [ocrWorkers, setOcrWorkers] = useState(0)
  // One entry per confirmation dialog (latest last): back-to-back fusions published in one tick each reach the run.
  const [fusionEvidence, setFusionEvidence] = useState<FusionEvidence[]>([])
  // Confirmed shop sales (capture time of the dialog), latest last.
  const [giftSales, setGiftSales] = useState<GiftSale[]>([])
  // The shop shelf as last read (eight slots by the game's layout), while the shop is on screen.
  const [shopShelf, setShopShelf] = useState<ShopShelf | null>(null)
  const shelfRequest = useRef<{ requestId: number; at: number } | null>(null)
  // The sell window's owned list, read like the shelf: the gifts it names for certain, for whoever counts what is held
  const [ownedGrid, setOwnedGrid] = useState<OwnedGridRead | null>(null)
  const gridRequest = useRef<{ requestId: number; at: number } | null>(null)
  // The bottom bar's Identities (the formation), read on the shop's screen every 2 s
  const [formation, setFormation] = useState<FormationRead | null>(null)
  // The Star Blessing screen's taken cards and their starlight, read every second while it shows; kept once two reads in a
  // row agree (a card under the cursor lights as if taken; the last steady read before 입장 is the one that counts)
  const [blessings, setBlessings] = useState<{ levels: number[]; spent: number; observedAt: number } | null>(null)
  const blessingRequest = useRef<{ requestId: number; at: number } | null>(null)
  const lastBlessingRead = useRef('')
  // The theme pack selection's CLEAR BONUS rows, read every second while it shows; kept once two reads in a row agree
  // (cards slide in). Pack names come from the screen's text reads, by card place.
  const [clearBonus, setClearBonus] = useState<ClearBonusOffer | null>(null)
  const bonusRequest = useRef<{ requestId: number; at: number } | null>(null)
  const lastBonusRead = useRef('')
  const bonusTitleBar = useRef(0)
  const bonusNames = useRef<{ names: Map<number, string[]>; at: number } | null>(null)
  const selectionHeader = useRef<number | null>(null)
  const formationRequest = useRef<{ requestId: number; at: number } | null>(null)
  // A ? room's choice list and the cursor over it (read every ~150 ms on the event screen): the option clicked
  const [eventPick, setEventPick] = useState<EventPick | null>(null)
  const pickState = useRef(EMPTY_PICK)
  const cursorSamples = useRef<CursorSample[]>([])
  const cursorRequest = useRef<{ requestId: number; at: number } | null>(null)
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
    wheel: WheelFrame[]; published: boolean; dialogless?: boolean; undecided?: boolean; seen?: SeenDialog; resultAt?: number } | null>(null)
  const fusionRequest = useRef<{ requestId: number; at: number; count: number; token: string; view: FusionRead['view'] } | null>(null)
  // The selection wheel stays up while materials are picked but may be complete for only ~0.3 s before the dialog opens:
  // on the fusion screen small crops of it are kept every 150 ms (at most WHEEL_FRAMES, none older than WHEEL_KEEP_MS)
  // and only read once a dialog asks for them.
  const wheelFrames = useRef<WheelFrame[]>([])
  const wheelTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // When the screen last changed enough to read it at once (a short-lived dialog), from 32×18 grey copies every 100 ms
  const changeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // The last seconds of the capture, kept by their own worker so a moment the live reads missed can be read again
  const tapeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const tape = useRef<Worker | null>(null)
  const screenChangedAt = useRef(0)
  // A wheel state read ahead of any dialog while the scene worker is idle (the complete wheel may be up for ~0.3 s).
  const wheelRequest = useRef<{ requestId: number; state: WheelFrame; capacity: number } | null>(null)
  const wheelAnchors = useRef<{ anchors: WheelAnchors; at: number } | null>(null)
  // Capture time of the latest OCR read showing the fusion screen's title: the fusion screen in any UI theme.
  const fusionTitleAt = useRef(0)
  // Capture time of the latest OCR read of the starlight screen (title and 입장): run_setup whatever its card colour.
  const blessingAt = useRef(0)
  const runEndAt = useRef(0)
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
  // Automatic rebuilds of the OCR workers after all of them failed, in this capture.
  const ocrRebuilds = useRef(0)
  // when the OCR workers in use were built after a failure (null: the first ones of this capture)
  const ocrBuiltAt = useRef<number | null>(null)
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
  const completeFusionRef = useRef(completeFusion)
  completeFusionRef.current = completeFusion
  references.current = { giftReferences, eventReferences }
  const ocrReferences = useRef(ocrCatalog)
  ocrReferences.current = ocrCatalog
  const giftPriceRef = useRef(giftPrice)
  giftPriceRef.current = giftPrice
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
  const heldRef = useRef(heldGiftIds)
  heldRef.current = heldGiftIds
  /** Gifts a fusion can use: held ones by catalog id (enhancement suffixes dropped) and the vestiges, never auto-recorded. */
  const fusionCandidates = () => [...new Set([...heldRef.current.map(key => String(parseInt(key, 10))).filter(id => id !== 'NaN'),
    ...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS])]
  const sampleState = useRef({ prediction, mode, detection, inference, ocrEngine, floor })
  sampleState.current = { prediction, mode, detection, inference, ocrEngine, floor }
  const readSampleContext = () => {
    const { prediction, mode, detection, inference, ocrEngine, floor } = sampleState.current
    return { scene: prediction && { label: prediction.label.slice(0, 40), confidence: prediction.confidence }, mode, detection, inference,
      ocr: ocrEngine && { engine: ocrEngine.engine, adapter: ocrEngine.adapter.slice(0, 80) }, dpr: window.devicePixelRatio,
      userAgent: navigator.userAgent.slice(0, 400), build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, floor,
      session: reportTally.current?.session, language }
  }
  const readReportContext = () => {
    const size = stream.current?.getVideoTracks()[0]?.getSettings()
    return { build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null, mode: sampleState.current.mode,
      ocr: sampleState.current.ocrEngine?.engine.slice(0, 20) ?? null, width: size?.width ?? null, height: size?.height ?? null, language }
  }
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
  // when the scene worker was last given a request (the watchdog frees `inFlight` if it never answers)
  const busySince = useRef(0)
  const markBusy = () => { inFlight.current = true; busySince.current = Date.now() }
  // a stop or a failure clears what the screen reading published
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
  // When each of the latest acquisition popups was last on screen: the wheel under a popup is not a fusion's selection.
  const popupEnds = useRef<number[]>([])
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
    if (changeTimer.current) clearInterval(changeTimer.current)
    if (tapeTimer.current) clearInterval(tapeTimer.current)
    tapeTimer.current = null
    tape.current?.terminate()
    tape.current = null
    changeTimer.current = null
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
    blessingAt.current = 0
    runEndAt.current = 0
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
    popupEnds.current = []
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
    setShopShelf(null); setOwnedGrid(null); setFormation(null); setEventPick(null); pickState.current = EMPTY_PICK; cursorSamples.current = []
    setGiftSales([]); setSkillExchange(null)
    saleState.current = EMPTY_SALE_STATE
    setObservedFloor(null)
    setScene(null)
    setThemeSelectionFloor(null)
    setBlessings(null); lastBlessingRead.current = ''; blessingRequest.current = null
    setClearBonus(null); lastBonusRead.current = ''; bonusRequest.current = null; bonusNames.current = null; selectionHeader.current = null
  }, [cleanup])

  const catalogFilled = Boolean(ocrCatalog && Object.values(ocrCatalog).some(items => items.length > 0))
  useEffect(() => {
    // connected before the catalog came: the text reader is built now (it never was)
    if (status === 'running' && catalogFilled && !ocrPool.current && ocrStatus === 'idle') { plog('reader-late-build', true); rebuildOcr.current?.() }
  }, [status, catalogFilled, ocrStatus])

  useEffect(() => {
    setSupported(canCapture())
    setMobile(mobileBlocked())
    let live = true
    if (canCapture()) void gpuBlocked().then(block => { if (live && block) setGpu(block) })
    return () => { live = false; cleanup() }
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
    ocrRebuilds.current = 0
    ocrBuiltAt.current = null
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
    setShopShelf(null); setOwnedGrid(null); setFormation(null); setEventPick(null); pickState.current = EMPTY_PICK; cursorSamples.current = []
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
    const block = await gpuBlocked()
    if (run !== generation.current) return
    setGpu(block)
    if (block) {
      setStatus('idle')
      return block
    }
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
      // Once the models are ready, a failed scene read skips that frame; only SCENE_READ_FAILURES in a row stop the capture.
      let visionReady = false
      let visionFailures = 0
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
        setShopShelf(null); setOwnedGrid(null); setFormation(null); setEventPick(null); pickState.current = EMPTY_PICK; cursorSamples.current = []
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
        // Without a dialog, the fullest wheel state says how many of the capacity's positions this fusion used.
        if (dialog.dialogless) dialog.count = Math.min(dialog.capacity, wheelSelectionSize(dialog.reads) || dialog.capacity)
        // Every state read and none held a selection: not a fusion (the bonus gift popup after one). Nothing is tallied,
        // published or uploaded, and the popup is released as a plain acquisition.
        if (dialog.dialogless && !dialog.published && !dialog.wheel.length && emptyWheelResult(dialog.reads, dialog.capacity)) {
          dialog.published = true
          sampleRecorder.current?.end('fusion', null)
          finishFusionDialog()
          return
        }
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
          let materials = fusionMaterials(dialog.reads, dialog.count, dialog.capacity)
          // The result popup held for this dialog (captured after it opened) completes a fixed-recipe fusion.
          const result = materials.length < dialog.count ? heldAcquisitions.current.find(item => (item.capturedAt ?? Infinity) >= dialog.firstAt) : undefined
          materials = (result && completeFusionRef.current?.(materials, dialog.count, result.giftId)) || materials
          // The fusion's frame group is uploaded only when its materials could not all be read.
          // With what was read of it (times, slots, wheel history), to find why a fusion that replays well was missed live.
          settleSample('fusion', 'fusion', materials.length < dialog.count ? { reason: dialog.dialogless ? 'fusion-dialogless' : 'fusion-materials', candidates: materials,
            diagnosis: fusionDiagnosis({ ...dialog, resultAt: dialog.resultAt ?? dialog.seen?.resultAt, wheelKnown: !!wheelReference.current,
              wheelKept: wheelFrames.current.length + dialog.wheel.length }) } : null)
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
            // Before the first read of the selection screen (a fusion within seconds of opening it on a slow GPU) the wheel's
            // look is unknown: the result waits for it below instead of being dropped.
            (!wheelReference.current || showsWheel(item, wheelReference.current)))) {
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
      const popupDialogCount = (capturedAt: number) => {
        const dialog = fusionDialog.current
        return dialog && dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000 ? dialog.count : undefined
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
            materials: popupDialogMaterials(pending.capturedAt), materialCount: popupDialogCount(pending.capturedAt) }, verdict, inFusion)
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
        markBusy()
        try { vision.postMessage({ type: 'popup-icon', ...item }, [item.frame]) } catch (error) { inFlight.current = false; item.frame.close(); plog('post-failed', String(error)) }
      }
      let flushOcrPopup = () => {}
      // An image-identified event asks for prompt full-frame OCR so its choices are read while they are shown.
      let eventHintAt = 0
      let promptEventOcr = () => {}
      // One kept frame read by whichever OCR lane is idle (set up with the lanes); null when none could read it
      let readTapeFrame: (frame: ImageBitmap) => Promise<{ text: string; words: OcrWord[] } | null> = async frame => { frame.close(); return null }
      let tapeRequest = 0
      // OCR reads of kept frames, answered by request id (not the live screen read's)
      const tapePending = new Map<number, (read: { text: string; words: OcrWord[] } | null) => void>()
      const tapeAnswers = new Map<number, (frames: { at: number; bitmap: ImageBitmap }[]) => void>()
      const takeTape = (from: number, to: number, max: number) => new Promise<{ at: number; bitmap: ImageBitmap }[]>(resolve => {
        const keeper = tape.current
        if (!keeper) return resolve([])
        const requestId = ++tapeRequest
        tapeAnswers.set(requestId, resolve)
        keeper.postMessage({ type: 'take', requestId, from, to, max })
        setTimeout(() => { if (tapeAnswers.delete(requestId)) resolve([]) }, 3000)
      })
      /**
       * A ? room left with nothing read of what was taken: its kept frames from the list on are read again, the sharpest
       * of each moment, for the option left alone under the result header or one option's result text.
       */
      let replaying = false
      const replayRoom = async (from: number, to: number) => {
        if (replaying || !ocrReferences.current) return
        replaying = true
        try {
          const frames = await takeTape(from, to, 6)
          let state = EMPTY_PICK
          let next = 0
          const closeRest = () => { for (const item of frames.slice(next)) item.bitmap.close() }
          for (const { at, bitmap } of frames) {
            next++
            const width = bitmap.width, height = bitmap.height
            const read = await readTapeFrame(bitmap)
            const catalog = ocrReferences.current
            if (!read || !catalog || run !== generation.current) continue
            const evidence = eventScreenEvidence({ text: read.text, words: read.words }, catalog)
            const named = (evidence.outcomeChoiceIds ?? []).map(id => catalog.choices.find(choice => choice.id === id)).filter(Boolean)
            if (named.length && new Set(named.map(choice => `${choice!.eventId}:${choice!.option}`)).size === 1) {
              dlog('replay', 'result text', named[0]!.id)
              setEventPick({ choiceId: named[0]!.id, at, via: 'text' })
              closeRest()
              return
            }
            const boxes = distinctBoxes((evidence.choiceBoxes ?? []).filter(box => box.left >= 0.45 * width && box.left <= 0.75 * width))
            const first = boxes.length ? catalog.choices.find(item => item.id === boxes[0].choiceId) : undefined
            const options = first ? new Set(catalog.choices.filter(item => item.eventId === first.eventId)
              .map(item => gameTextPieces(item.texts[0] ?? '').join('')).filter(text => [...text].length >= 4)).size : 0
            const shown = listShown(state, choiceBands(boxes, width, height), at,
              { resultPage: read.words.some(word => RESULT_HEADERS.has(word.text.trim())), options })
            state = shown.state
            if (shown.pick) { dlog('replay', 'option alone', shown.pick.choiceId); setEventPick(shown.pick); closeRest(); return }
          }
          dlog('replay', 'nothing in', frames.length, 'frames')
        } finally { replaying = false }
      }
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
      /** Notes when a popup that stayed past its fade-in was last on screen (a shorter one is a fragment of the next). */
      const endPopup = (popup: { firstAt: number; at: number }) => {
        if (popup.at - popup.firstAt > POPUP_SETTLE_MS) popupEnds.current = [...popupEnds.current.slice(-7), popup.at]
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
              if (now - previous.at > 400) { endPopup(previous); lastPopup.current = null }
            }
            return
          }
          const observation: PopupObservation = { signature: popupIconSignature(pixels, label),
            color: popupLabelColor(pixels, label), box: label, at: now }
          const same = previous && samePopupEpisode(previous, observation) ? previous : null
          if (previous && !same) { releasePopupEpisode(previous.episode); endPopup(previous) }
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
      // how long the last screen read took, capture to result: event and fusion screens are read as often as the GPU allows
      let screenReadMs = 1000
      let exploredAt = 0
      let bannerRecent = false
      let lastScreenAt = 0
      const buildOcrPool = () => {
        const profile = profileRef.current
        const makeLane = (): OcrLane => ({ worker: new Worker('/models/assist-ocr/ocr-worker.js', { type: 'module' }), ready: false,
          inFlight: false, activeRequest: 0, engine: null, failures: 0, since: 0 })
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
          setShopShelf(null); setOwnedGrid(null); setFormation(null); setEventPick(null); pickState.current = EMPTY_PICK; cursorSamples.current = []
          setGiftSales([]); setSkillExchange(null)
          saleState.current = EMPTY_SALE_STATE
          // Start over with new workers after a wait (the screen share and scene worker keep running meanwhile).
          const wait = OCR_REBUILD_MS[ocrRebuilds.current]
          if (wait !== undefined) {
            ocrRebuilds.current += 1
            setTimeout(() => { if (run === generation.current && !ocrPool.current) { ocrBuiltAt.current = Date.now(); rebuildOcr.current?.() } }, wait)
          }
        }
        flushOcrPopup = () => {
          const lane = pool.popup
          if (!alive(lane) || lane.inFlight || !lane.ready) return
          const item = takePopup(popupQueue)
          if (!item) return
          lane.inFlight = true
          lane.since = Date.now()
          lane.activeRequest = item.requestId
          try { lane.worker.postMessage({ type: 'popup', ...item }, [item.frame]) } catch (error) { dropInFlight(lane); item.frame.close(); plog('post-failed', String(error)) }
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
          // A read takes 70-110 ms on a desktop GPU (live test, 2026-11-04): the 0.7 s wait was most of the delay, so
          // a screen that needs it is read again after twice the last read's time (at least 0.25 s, at most as before)
          const quick = Math.max(250, 2 * screenReadMs)
          const interval = fusionScreen ? Math.min(400, profile.recognizeMs.event, quick)
            : now - eventHintAt < 5000 ? Math.min(profile.recognizeMs.event, quick) : profile.recognizeMs.idle
          // With one shared worker, queued popups go first, but only for one extra interval.
          const shared = pool.popup === pool.screen
          // a screen change since the last read starts one at once (still one at a time, 120 ms apart at least)
          const gap = screenChangedAt.current > recognizedAt ? 120 : interval
          for (const stuck of pool.lanes) if (alive(stuck) && stuck.inFlight && now - stuck.since > OCR_WATCHDOG_MS) {
            plog('ocr-watchdog', { ms: now - stuck.since, request: stuck.activeRequest })
            dropInFlight(stuck)
            stuck.failures += 1
            if (ocrErrorAction(stuck.failures) !== 'skip') { ocrFail(stuck); return }
          }
          if (!alive(lane) || lane.inFlight || !lane.ready || now - recognizedAt < gap ||
            (shared && popupQueue.current.length && now - recognizedAt < interval * 2) || !hasFrame()) return
          recognizedAt = now
          lane.inFlight = true
          lane.since = now
          const requestId = ++ocrRequestId.current
          lane.activeRequest = requestId
          let taken: ImageBitmap | null = null
          try {
            // Capture time is taken before the copy, so every read of this frame is dated by when it was on screen.
            const at = Date.now()
            const frame = taken = await grabBitmap()
            if (!alive(lane)) { frame.close(); return }
            ocrCapture.current = { at, floor: currentFloor.current, width: frame.width, height: frame.height }
            // The fusion screen belongs to the shop and may be classified either way; one copy at a time, closed on the next.
            if (latestLabel.current === 'shop' || latestLabel.current === null || onFusionScreen(latestLabel.current, fusionTitleAt.current, at)) {
              const copy = await createImageBitmap(frame)
              if (!alive(lane)) { copy.close(); frame.close(); return }
              fusionFrame.current?.frame.close()
              fusionFrame.current = { frame: copy, at }
            }
            lane.worker.postMessage({ type: 'recognize', requestId, frame, detSide: profile.fullFrameDetSide,
              grid: profile.fullFrameGrid, tileScale: profile.fullFrameTileScale }, [frame])
          } catch (error) {
            // this frame could not be taken or sent (the track between frames): skip it, the lane stays
            taken?.close()
            if (alive(lane)) dropInFlight(lane)
            plog('ocr-frame-skipped', String(error))
          }
        }
        // The exploration banner, read in the game language. Right after a banner was read it is read again sooner while
        // that map screen is still up.
        const explore = async () => {
          const lane = pool.screen
          const now = Date.now()
          const profile = profileRef.current
          const base = bannerRecent ? profile.exploreMs.recent : profile.exploreMs.idle
          const delay = now - explorationHintAt < 3000 ? Math.min(base, profile.exploreMs.recent) : base
          const shared = pool.popup === pool.screen
          // The banner is on the map only. On the shop, fusion, sell and skill windows the screen lane belongs to the full-frame
          // read: a fusion or sell dialog is up for about a second, and on a slow GPU one banner read took that whole window.
          const shopScreen = latestLabel.current === 'shop' || onFusionScreen(latestLabel.current, fusionTitleAt.current, now) ||
            now - sellWindowAt.current < 3000 || now - skillWindowAt.current < 3000
          // With one shared worker, popups go first, but a steady stream of detections must not starve the banner.
          if (!alive(lane) || shopScreen || !detectionRef.current.themes || !themeReferences.current?.length || lane.inFlight || !lane.ready || now - exploredAt < delay ||
            (shared && popupQueue.current.length && delay >= profile.exploreMs.idle && now - exploredAt < delay * 2) ||
            !hasFrame()) return
          exploredAt = now
          lane.inFlight = true
          lane.since = now
          const requestId = ++ocrRequestId.current
          lane.activeRequest = requestId
          let taken: ImageBitmap | null = null
          try {
            const frame = taken = await grabBitmap()
            if (!alive(lane)) { frame.close(); return }
            exploreCapture.current = { at: Date.now(), requestId }
            lane.worker.postMessage({ type: 'explore', requestId, frame }, [frame])
          } catch (error) {
            taken?.close()
            if (alive(lane)) dropInFlight(lane)
            plog('ocr-frame-skipped', String(error))
          }
        }
        promptEventOcr = () => { void recognize() }
        readTapeFrame = async frame => {
          // the popup lane when it is idle, else the screen lane; up to 2 s for one to be free
          const until = Date.now() + 2000
          let lane: OcrLane | undefined
          while (!(lane = [pool.popup, pool.screen].find(item => alive(item) && item.ready && !item.inFlight)) && Date.now() < until)
            await new Promise(resolve => setTimeout(resolve, 40))
          if (!lane) { frame.close(); return null }
          const reader = lane, requestId = ++ocrRequestId.current
          reader.inFlight = true
          reader.since = Date.now()
          reader.activeRequest = requestId
          return new Promise(resolve => {
            tapePending.set(requestId, resolve)
            const profile = profileRef.current
            try {
              reader.worker.postMessage({ type: 'recognize', requestId, frame, detSide: profile.fullFrameDetSide, grid: profile.fullFrameGrid,
                tileScale: profile.fullFrameTileScale }, [frame])
            } catch (error) {
              tapePending.delete(requestId)
              dropInFlight(reader)
              frame.close()
              plog('post-failed', String(error))
              resolve(null)
            }
            setTimeout(() => {
              const done = tapePending.get(requestId)
              if (!done) return
              tapePending.delete(requestId)
              if (reader.activeRequest === requestId) reader.inFlight = false
              done(null)
            }, 4000)
          })
        }
        promptExplore = () => { void explore() }
        const handle = (lane: OcrLane) => (event: MessageEvent<{ type: string; requestId?: number; text?: string; words?: OcrWord[];
          floorText?: string; themeReads?: OcrWord[][]; engine?: string; adapter?: string; loading?: boolean; reason?: string;
          header?: string; label?: string; labelWords?: OcrWord[]; labels?: PopupLabelRead[]; body?: string; lexicon?: { id?: unknown } | null }>) => {
          if (!alive(lane)) return
          const result = event.data
          // a kept frame's read goes back to its replay, not into the live screen state
          const replay = typeof result.requestId === 'number' ? tapePending.get(result.requestId) : undefined
          if (replay && (result.type === 'result' || result.type === 'error')) {
            tapePending.delete(result.requestId!)
            if (lane.activeRequest === result.requestId) lane.inFlight = false
            replay(result.type === 'result' && typeof result.text === 'string' && Array.isArray(result.words) ? { text: result.text, words: result.words } : null)
            flushOcrPopup()
            return
          }
          const mine = result.requestId === lane.activeRequest && lane.inFlight
          if (mine && (result.type === 'result' || result.type === 'popupResult' || result.type === 'exploreResult')) {
            lane.failures = 0
            ocrRebuilds.current = ocrRebuildsAfterRead(ocrRebuilds.current, ocrBuiltAt.current, Date.now())
          }
          if (result.type === 'error' && typeof result.requestId === 'number') {
            // An answer to a read already given up on changes nothing.
            if (!mine) return
            if (ocrErrorAction(lane.failures) === 'skip') {
              // One frame the worker could not read: drop it and let the timers ask again.
              lane.failures += 1
              dropInFlight(lane)
              flushOcrPopup()
              return
            }
          }
          if (result.type === 'backend') {
            lane.engine = { engine: result.engine === 'paddle' ? 'paddle' : 'tesseract',
              adapter: result.engine === 'paddle' && typeof result.adapter === 'string' ? result.adapter.slice(0, 60) : '',
              loading: result.engine !== 'paddle' && result.loading === true,
              ...(typeof result.reason === 'string' ? { reason: result.reason.slice(0, 40) } : {}) }
            publishEngine()
          } else if (result.type === 'ready') {
            lane.ready = true
            // The worker reports its backend just after this, once it has asked for a GPU adapter: until then its text
            // is read by Tesseract while the GPU models may still load (so no CPU fallback is decided yet).
            lane.engine ??= { engine: 'tesseract', adapter: '', loading: true }
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
              screenReadMs = Date.now() - capture.at
              dlog('ocr', { ms: Date.now() - capture.at, timing: (result as { timing?: unknown }).timing ?? null, scene: latestLabel.current,
                text: result.text.replace(/\s+/g, ' ').slice(0, 160) })
              const matches = ocrReferences.current ? { ...matchOcrCandidates(document, ocrReferences.current),
                ...eventScreenEvidence(document, ocrReferences.current) }
                : { gifts: [], events: [], choices: [], scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }
              const want = detectionRef.current
              if (want.events && capture.width && capture.height) {
                // the game's list is right of the middle (its name lines start at 0.57 of the width): lines elsewhere are
                // not its buttons (a whole-screen share also holds the terminal and its PiP)
                const ocrWidth = capture.width * Math.min(1, 1920 / capture.width)
                const boxes = distinctBoxes(('choiceBoxes' in matches ? matches.choiceBoxes ?? [] : [])
                  .filter(box => box.left >= 0.45 * ocrWidth && box.left <= 0.75 * ocrWidth))
                // how many options of that event can be read (a name of 4 or more glyphs): one of several alone is the one taken
                const choice = boxes.length ? ocrReferences.current?.choices.find(item => item.id === boxes[0].choiceId) : undefined
                const options = choice ? new Set(ocrReferences.current!.choices.filter(item => item.eventId === choice.eventId)
                  .map(item => gameTextPieces(item.texts[0] ?? '').join('')).filter(text => [...text].length >= 4)).size : 0
                const resultPage = result.words.some(word => RESULT_HEADERS.has(word.text.trim()))
                if (boxes.length) {
                  const shown = listShown(pickState.current, choiceBands(boxes, capture.width, capture.height, Math.min(1, 1920 / capture.width)), capture.at, { resultPage, options })
                  pickState.current = shown.state
                  if (shown.pick) setEventPick(shown.pick)
                  if (boxes.length === 1) dlog('alone', boxes[0].choiceId, 'header', resultPage, 'options', options)
                  dlog('bands', JSON.stringify(pickState.current.bands.map(band => [band.choiceId, ...[band.left, band.top, band.right, band.bottom].map(Math.round)])))
                  // a click before this read: the cursor readings since a second before it
                  for (const sample of cursorSamples.current) if (sample.at >= capture.at - 1000) pickState.current = cursorSeen(pickState.current, sample)
                } else {
                  const listFrom = pickState.current.shownAt
                  const settled = listMissing(pickState.current, capture.at)
                  pickState.current = settled.state
                  if (settled.pick) setEventPick(settled.pick)
                  // the list went and nothing named what was taken: the kept frames are read again
                  else if (listFrom && settled.state === EMPTY_PICK) void replayRoom(listFrom - 500, capture.at)
                }
              }
              setOcrCandidates({ ...matches, ...(want.gifts ? {} : { gifts: [] }),
                ...(want.events ? {} : { events: [], choices: [], scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }),
                observedAt: capture.at, expiresAt: capture.at + 6000, floor: capture.floor })
              const headerFloor = themeSelectionHeaderFloor(result.text)
              if (headerFloor !== null && want.themes) { setThemeSelectionFloor({ floor: headerFloor, observedAt: capture.at }); selectionHeader.current = headerFloor }
              // the pack names under the cards, for the CLEAR BONUS rows read by the icons
              if (want.themes && want.gifts && latestLabel.current === 'theme_select' && capture.width && capture.height) {
                const factor = capture.width / Math.min(capture.width, 1920)
                const names = bonusCardThemes(result.words, [...BONUS_PLACES.odd, ...BONUS_PLACES.even], capture.width, capture.height,
                  themeReferences.current ?? [], factor, bonusTitleBar.current)
                if (names.size) {
                  bonusNames.current = { names, at: capture.at }
                  setClearBonus(current => current && named(current.cards, names) !== current.cards ? { ...current, cards: named(current.cards, names) } : current)
                }
              }
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
              if (showsBlessingScreen(result.text)) {
                blessingAt.current = Math.max(blessingAt.current, capture.at)
                setScene(current => current?.label === BLESSING_SCENE || current?.label === 'gift_acquired' ? current : { label: BLESSING_SCENE, since: capture.at })
              }
              // the dungeon's end screen, by its own words (the classifier barely knows it)
              if (showsRunEndScreen(result.text)) {
                runEndAt.current = Math.max(runEndAt.current, capture.at)
                setScene(current => current?.label === RUN_END_SCENE ? current : { label: RUN_END_SCENE, since: capture.at })
              }
              screenReads.current = [...screenReads.current.filter(item => capture.at - item.at < 10_000), { at: capture.at, fusion: fusionScreen }]
              // OCR positions are on the reading canvas (at most 1920 px wide); the slot crops use full-size frames.
              const factor = capture.width ? capture.width / Math.min(capture.width, 1920) : 1
              const box = (rect: { left: number; top: number; width: number; height: number }) =>
                ({ left: rect.left * factor, top: rect.top * factor, width: rect.width * factor, height: rect.height * factor })
              // Read before the waiting results below, so a result that waited for the wheel's look is read with this one.
              if (isFusionSelectionScreen(result.text)) {
                // Where the wheel is on this capture (window title bar, scaling), for the crops kept from now on.
                const found = fusionWheelAnchors(result.words)
                if (found && (!wheelAnchors.current || capture.at >= wheelAnchors.current.at)) {
                  wheelAnchors.current = { anchors: { title: box(found.title), wish: box(found.wish) }, at: capture.at }
                }
                const shown = wheelFrames.current.find(item => item.at <= capture.at + 100 && capture.at <= item.lastAt + 200)
                if (shown?.band) wheelReference.current = shown.band
              }
              // A result with no dialog seen (dialoglessFusionResult): its materials come from the wheel states before it,
              // read like a dialog's, with the capacity of this session's earlier dialog.
              for (const pending of dialoglessResults.current.filter(item => item.capturedAt < capture.at)) {
                // A dialog still being read (an earlier fusion) finishes first; the result waits for a later screen read.
                if (fusionDialog.current && !fusionDialog.current.published && capture.at - pending.capturedAt < 8000) continue
                // The wheel's look is not known yet: wait for a read of the selection screen (the states are kept WHEEL_KEEP_MS).
                if (!wheelReference.current && capture.at - pending.capturedAt < WHEEL_KEEP_MS - 1000) continue
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
                // States first seen under the popup before this one (a fusion's own result before its bonus gift) are left out.
                const uncovered = popupEndBefore(popupEnds.current, pending.capturedAt)
                const wheel = wheelReadOrder(wheelFrames.current.filter(item => item.at < pending.capturedAt && item.at > uncovered && item.lastAt > after &&
                  item.lastAt >= pending.capturedAt - DIALOGLESS_WHEEL_MS && showsWheel(item, wheelReference.current)), pending.capturedAt, 600)
                if (!wheel.length) continue
                // The session's shop capacity; before any dialog was seen, decided after reading the states in both layouts.
                const known = lastCapacity.current && capture.at - lastCapacity.current.at < CAPACITY_KEEP_MS ? lastCapacity.current.capacity : null
                const capacity = known ?? 3
                wheelFrames.current = wheelFrames.current.filter(item => !wheel.includes(item))
                for (const item of fusionDialog.current?.wheel.splice(0) ?? []) item.frame.close()
                fusionDialog.current = { token: `${run}:fusion:${pending.capturedAt}`, count: capacity, capacity, firstAt: Math.min(...wheel.map(item => item.at)),
                  lastSeenAt: Math.max(...wheel.map(item => item.lastAt)),
                  reads: [], wheel, published: false, dialogless: true, undecided: known === null, resultAt: pending.capturedAt }
                takeWheelReads(fusionDialog.current)
                if (!fusionDialog.current.published) fusionWanted.current = { count: capacity, capacity, at: Date.now() }
                lastDialogAt.current = Math.max(lastDialogAt.current, pending.capturedAt)
              }
              // The selection screen or an acquisition popup without the dialog: a dialog read after it is a new fusion.
              if (!confirmation && (isFusionSelectionScreen(result.text) || showsAcquiredHeader(result.text))) {
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
            const { ids: themeIds, certain } = themeReferences.current ? explorationThemeReads(reads, themeReferences.current) : { ids: [], certain: false }
            // A single exact pack read may confirm, but only under a floor number that is the current or next floor, or
            // that an earlier capture also read: one misread digit must not jump the run ahead.
            let floorAgreed = false
            if (capture && capture.requestId === result.requestId && floorSeen !== null) {
              const previous = lastFloorRead.current
              const elapsed = previous ? capture.at - previous.at : -1
              const runFloor = currentFloor.current
              floorAgreed = (runFloor !== null && (floorSeen === runFloor || floorSeen === runFloor + 1)) ||
                (previous?.floor === floorSeen && elapsed > 0 && elapsed <= 180000)
              if (previous?.floor === floorSeen && elapsed >= 1000 && elapsed <= 60000) setObservedFloor(floorSeen)
              if (!previous || capture.at > previous.at) lastFloorRead.current = { floor: floorSeen, at: capture.at }
            }
            // Unreadable captures neither confirm nor break the chain; a different readable scene restarts it.
            if (capture && capture.requestId === result.requestId && floorSeen !== null && themeIds.length &&
              (!lastExploration.current || capture.at > lastExploration.current.observedAt)) {
              const observation = { floor: floorSeen, themeIds, observedAt: capture.at, certain: certain && floorAgreed }
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
      // The text reader needs the catalog (gift, event and pack names); one that comes after connecting builds it then
      // (useEffect below), as a failed reader's rebuild does
      let disposePool: (() => void) | null = null
      const buildIfReady = () => {
        if (!ocrReferences.current || !Object.values(ocrReferences.current).some(items => items.length > 0)) return
        try {
          disposePool = buildOcrPool()
        } catch {
          for (const lane of ocrPool.current?.lanes ?? []) lane.worker.terminate()
          ocrPool.current = null
          setOcrStatus('error')
        }
      }
      rebuildOcr.current = () => {
        if (run !== generation.current) return
        disposePool?.()
        disposePool = null
        buildIfReady()
      }
      buildIfReady()
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
        markBusy()
        try {
          if (retained) {
            // The frame the dialog was read from goes first; later captures may already show the result.
            fusionFrameToRead.current = null
            if (run !== generation.current || !worker.current) { retained.frame.close(); inFlight.current = false; return true }
            const requestId = ++ocrRequestId.current
            fusionRequest.current = { requestId, at: retained.at, count: retained.count, token: fusionDialog.current?.token ?? '', view: 'dialog' }
            worker.current.postMessage({ type: 'fusion-slots', requestId, frame: retained.frame, count: retained.count, capacity: retained.capacity,
              anchors: retained.anchors, candidates: fusionCandidates() }, [retained.frame])
            return true
          }
          const at = Date.now()
          const frame = await grabBitmap()
          if (run !== generation.current || !worker.current) { frame.close(); return true }
          const requestId = ++ocrRequestId.current
          fusionRequest.current = { requestId, at, count: wanted.count, token: fusionDialog.current?.token ?? '', view: 'dialog' }
          worker.current.postMessage({ type: 'fusion-slots', requestId, frame, count: wanted.count, capacity: wanted.capacity, anchors: wanted.anchors,
            candidates: fusionCandidates() }, [frame])
        } catch { inFlight.current = false }
        return true
      }
      let wheelBusy = false
      /** Keeps a small crop of the selection wheel while the fusion screen is up (bounded ring, no inference here). */
      let lastThumb: Float32Array | null = null
      let changeBusy = false
      const sampleChange = async () => {
        if (changeBusy) return
        const source = openFrame()
        if (!source) return
        changeBusy = true
        try {
          const bitmap = await createImageBitmap(source.source, { resizeWidth: THUMB_WIDTH, resizeHeight: THUMB_HEIGHT, resizeQuality: 'high' })
          const canvas = new OffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT)
          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (!context) { bitmap.close(); return }
          context.drawImage(bitmap, 0, 0)
          bitmap.close()
          const thumb = greyThumb(context.getImageData(0, 0, THUMB_WIDTH, THUMB_HEIGHT).data)
          if (lastThumb && thumbDifference(lastThumb, thumb) > SCREEN_CHANGE) { screenChangedAt.current = Date.now(); promptEventOcr() }
          lastThumb = thumb
        } catch { /* a missed copy only delays the next read to its timer */ } finally { source.release(); changeBusy = false }
      }
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
          if (last && sameWheelSignature(last.signature, signature) && last.origin.x === crop.x && last.origin.y === crop.y && sameAnchors(last.anchors, anchors)) {
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
        markBusy()
        try {
          const frame = await createImageBitmap(state.frame)
          if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return true }
          const requestId = ++ocrRequestId.current
          wheelRequest.current = { requestId, state, capacity }
          worker.current.postMessage({ type: 'fusion-wheel', requestId, frame, capacity, origin: state.origin, scale: state.scale,
            frameSize: state.frameSize, anchors: state.anchors, candidates: fusionCandidates() }, [frame])
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
        if (inFlight.current && Date.now() - busySince.current > SCENE_WATCHDOG_MS) {
          // a request the scene worker never answered (a stalled GPU): given up, so reading goes on; its late answer, if
          // any, names a request no longer waited for and is ignored
          plog('scene-watchdog', Date.now() - busySince.current)
          inFlight.current = false
        }
        // A queued acquisition icon goes before any fusion read (those take a few hundred ms).
        if (popupVisionQueue.current.length && !inFlight.current) {
          flushVisionPopup()
          if (inFlight.current) return
        }
        const gifts = detectionRef.current.gifts
        if (gifts && fusionWanted.current && await readFusionSlots()) return
        if (gifts && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20 && await preReadWheel()) return
        // The shop shelf while the shop is on screen, between scene reads (every 0.7 s; one request at a time)
        if (gifts && !inFlight.current && latestLabel.current === 'shop' && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (shelfRequest.current?.at ?? 0) >= 700 && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            shelfRequest.current = { requestId, at: Date.now() }
            worker.current.postMessage({ type: 'shop-shelf', requestId, frame }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // The owned list while the sell window is on screen, the same way
        if (gifts && !inFlight.current && latestLabel.current === 'sell' && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (gridRequest.current?.at ?? 0) >= 700 && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            gridRequest.current = { requestId, at: Date.now() }
            worker.current.postMessage({ type: 'owned-grid', requestId, frame }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // The cursor over a ? room's choice list while it is on screen (every 150 ms, only that region: a few ms)
        const bands = pickState.current.bands
        if (bands.length && !inFlight.current && latestLabel.current === 'event' && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (cursorRequest.current?.at ?? 0) >= 150 && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            cursorRequest.current = { requestId, at: Date.now() }
            // the buttons and a margin around them (the cursor's hot spot is its tip; the nib hangs below and right)
            const margin = 60 * Math.min(frame.width / 1920, frame.height / 1080)
            const left = Math.min(...bands.map(band => band.left)) - margin, top = Math.min(...bands.map(band => band.top)) - margin
            const region = { x: left, y: top, width: Math.max(...bands.map(band => band.right)) + margin - left, height: Math.max(...bands.map(band => band.bottom)) + margin - top }
            worker.current.postMessage({ type: 'cursor', requestId, frame, region }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // The Star Blessing screen's cards, every second while it shows
        if (gifts && !inFlight.current && onBlessingScreen(blessingAt.current, Date.now()) && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (blessingRequest.current?.at ?? 0) >= 1000) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            blessingRequest.current = { requestId, at: Date.now() }
            worker.current.postMessage({ type: 'blessings', requestId, frame }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // The theme pack selection's CLEAR BONUS rows, every second while it shows
        if (gifts && !inFlight.current && latestLabel.current === 'theme_select' && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (bonusRequest.current?.at ?? 0) >= 1000 && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            bonusRequest.current = { requestId, at: Date.now() }
            worker.current.postMessage({ type: 'clear-bonus', requestId, frame }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // The formation from the bottom bar while the shop is on screen
        if (gifts && !inFlight.current && latestLabel.current === 'shop' && hasFrame() && !popupVisionQueue.current.length &&
          Date.now() - (formationRequest.current?.at ?? 0) >= 2000 && Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20) {
          markBusy()
          try {
            const frame = await grabBitmap()
            if (run !== generation.current || !worker.current) { frame.close(); inFlight.current = false; return }
            const requestId = ++ocrRequestId.current
            formationRequest.current = { requestId, at: Date.now() }
            worker.current.postMessage({ type: 'formation', requestId, frame }, [frame])
          } catch { inFlight.current = false }
          return
        }
        // Popup icons go first, but scene inference still runs at least every 3s.
        if (inFlight.current || Date.now() - inferredAt < profileRef.current.sceneIntervalMs - 20 ||
          (popupVisionQueue.current.length && Date.now() - inferredAt < 3000) || !hasFrame()) return
        inferredAt = Date.now()
        markBusy()
        try {
          const frame = await grabBitmap()
          if (run !== generation.current || !worker.current) {
            frame.close()
            return
          }
          visualCapture.current = { at: Date.now(), floor: currentFloor.current }
          worker.current.postMessage({ type: 'infer', frame }, [frame])
        } catch (reason) {
          if (run === generation.current) sceneReadFailed(reason instanceof Error ? reason.message : 'Frame capture failed')
        }
      }
      const sceneReadFailed = (message: string) => {
        if (visionReady && ++visionFailures < SCENE_READ_FAILURES) {
          inFlight.current = false
          visualCapture.current = null
          return
        }
        fail(message)
      }
      vision.onmessage = (event: MessageEvent<{ type: string; label?: string; confidence?: number; gifts?: unknown;
        events?: unknown; requestId?: number; message?: string; provider?: string; adapter?: string }>) => {
        if (run !== generation.current) return
        const result = event.data
        if (result.type === 'ready') {
          visionReady = true
          setInference({ provider: result.provider === 'webgpu' ? 'webgpu' : 'wasm',
            adapter: typeof result.adapter === 'string' ? result.adapter.slice(0, 60) : '' })
          setStatus('running')
          every(timer, 250, () => { void capture() })
          every(wheelTimer, 150, () => { void sampleWheel() })
          every(changeTimer, 100, () => { void sampleChange() })
          // the capture's last seconds, a frame every 100 ms scaled to 960 px, kept by their own worker
          const keeper = new Worker('/models/assist-scene/frame-tape-worker.js', { type: 'module' })
          keeper.onmessage = (event: MessageEvent<{ type: string; requestId?: number; frames?: { at: number; bitmap: ImageBitmap }[]; kept?: number; bytes?: number; keepMs?: number; dropped?: number }>) => {
            const answer = event.data.type === 'frames' && typeof event.data.requestId === 'number' ? tapeAnswers.get(event.data.requestId) : undefined
            if (event.data.type === 'frames') dlog('tape', event.data.frames?.length, 'of', event.data.kept, 'kept,',
              Math.round((event.data.bytes ?? 0) / 1e5) / 10, 'MB,', event.data.keepMs, 'ms a frame,', event.data.dropped, 'dropped')
            if (answer) { tapeAnswers.delete(event.data.requestId!); answer(event.data.frames ?? []) } else for (const frame of event.data.frames ?? []) frame.bitmap.close()
          }
          tape.current = keeper
          // development only: the kept seconds read again on demand (the live test triggers a replay with it)
          if (isVerbose()) Object.assign(window, { __assistReplay: (ms = 8000) => replayRoom(Date.now() - ms, Date.now()) })
          let feeding = false
          every(tapeTimer, TAPE_EVERY_MS, () => {
            if (feeding || !tape.current) return
            const source = openFrame()
            if (!source) return
            feeding = true
            const scale = Math.min(1, TAPE_WIDTH / source.width)
            void createImageBitmap(source.source, { resizeWidth: Math.round(source.width * scale), resizeHeight: Math.round(source.height * scale), resizeQuality: 'medium' })
              .then(frame => { if (tape.current) tape.current.postMessage({ type: 'frame', at: Date.now(), frame }, [frame]); else frame.close() })
              .catch(() => {}).finally(() => { source.release(); feeding = false })
          })
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
          visionFailures = 0
          latestLabel.current = result.confidence >= 0.5 ? result.label : latestLabel.current
          if (latestLabel.current !== 'event' && (pickState.current.bands.length || pickState.current.alone)) {
            const listFrom = pickState.current.shownAt
            const settled = listMissing(pickState.current, Date.now(), true)
            pickState.current = settled.state
            if (settled.pick) setEventPick(settled.pick)
            else if (listFrom) void replayRoom(listFrom - 500, Date.now())
          }
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
              // So does a recent read of the starlight screen, which the classifier learned in its old red colours only.
              const label = held.label === 'gift_acquired' ? held.label : onFusionScreen(null, fusionTitleAt.current, Date.now()) ? 'fusion'
                : onBlessingScreen(blessingAt.current, Date.now()) ? BLESSING_SCENE : onRunEndScreen(runEndAt.current, Date.now()) ? RUN_END_SCENE : held.label
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
        } else if (result.type === 'shop-shelf' && shelfRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const slots = parseShopShelf((result as { slots?: unknown }).slots)
          const at = shelfRequest.current?.at ?? Date.now()
          if (slots && latestLabel.current === 'shop') setShopShelf({ slots, observedAt: at })
          flushVisionPopup()
        } else if (result.type === 'cursor' && cursorRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const cursor = (result as { cursor?: { x?: unknown; y?: unknown; pressed?: unknown } | null }).cursor
          if (cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number' && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
            const sample = { at: cursorRequest.current?.at ?? Date.now(), x: cursor.x, y: cursor.y, pressed: cursor.pressed === true }
            cursorSamples.current = [...cursorSamples.current.filter(item => sample.at - item.at < 4000), sample]
            pickState.current = cursorSeen(pickState.current, sample)
            dlog('cursor', Math.round(sample.x), Math.round(sample.y), sample.pressed, pickState.current.hits.length)
          } else dlog('cursor', 'none')
          flushVisionPopup()
        } else if (result.type === 'formation' && formationRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const ids = (result as { ids?: unknown }).ids
          const at = formationRequest.current?.at ?? Date.now()
          if (Array.isArray(ids) && ids.length === 12 && ids.every(id => id === null || typeof id === 'string') && latestLabel.current === 'shop')
            setFormation({ ids: ids as (string | null)[], observedAt: at })
          flushVisionPopup()
        } else if (result.type === 'blessings' && blessingRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const levels = (result as { levels?: unknown }).levels
          if (Array.isArray(levels) && levels.length === 10 && levels.every(level => Number.isInteger(level) && level >= 0 && level <= 3)) {
            const key = levels.join('')
            if (key === lastBlessingRead.current)
              setBlessings(current => current && current.levels.join('') === key ? current
                : { levels: levels as number[], spent: blessingSpent(levels as number[]), observedAt: blessingRequest.current?.at ?? Date.now() })
            lastBlessingRead.current = key
          } else lastBlessingRead.current = ''
          flushVisionPopup()
        } else if (result.type === 'clear-bonus' && bonusRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const { cards, titleBar } = result as { cards?: unknown; titleBar?: unknown }
          if (typeof titleBar === 'number' && Number.isFinite(titleBar)) bonusTitleBar.current = titleBar
          const valid = Array.isArray(cards) && cards.every(card => card && typeof card.place === 'number' && Array.isArray(card.gifts) &&
            card.gifts.every((gift: unknown) => typeof gift === 'string'))
          // a read with no gifts at all (cards still sliding in, or every row empty) changes nothing
          if (valid && latestLabel.current === 'theme_select' && (cards as ClearBonusCard[]).some(card => card.gifts.length)) {
            const key = offerKey(cards as ClearBonusCard[])
            if (key === lastBonusRead.current) {
              const names = bonusNames.current && Date.now() - bonusNames.current.at < 15_000 ? bonusNames.current.names : null
              const read = names ? named(cards as ClearBonusCard[], names) : cards as ClearBonusCard[]
              setClearBonus(current => current && offerKey(current.cards) === key && current.floor === selectionHeader.current ? current
                : { floor: selectionHeader.current, cards: read, observedAt: bonusRequest.current?.at ?? Date.now() })
            }
            lastBonusRead.current = key
          } else lastBonusRead.current = ''
          flushVisionPopup()
        } else if (result.type === 'owned-grid' && gridRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const gifts = (result as { gifts?: unknown }).gifts
          const at = gridRequest.current?.at ?? Date.now()
          if (Array.isArray(gifts) && gifts.every(gift => typeof gift === 'string') && latestLabel.current === 'sell')
            setOwnedGrid({ gifts: gifts as string[], observedAt: at })
          flushVisionPopup()
        } else if (result.type === 'fusion-slots' && wheelRequest.current?.requestId === result.requestId) {
          inFlight.current = false
          const { state, capacity } = wheelRequest.current!
          wheelRequest.current = null
          const slots = parseFusionSlots((result as { slots?: unknown }).slots, capacity)
          state.reads[capacity] = { view: 'wheel', slots: slots ?? [], observedAt: state.at }
          flushVisionPopup()
          // A fusion waiting for its wheel states reads the next one now, not at the next tick (a read takes ~10 ms).
          if (fusionWanted.current && !inFlight.current) void capture()
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
          sceneReadFailed('Invalid scene prediction')
        } else if (result.type === 'error') {
          sceneReadFailed(result.message ?? 'Scene classification failed')
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
      setShopShelf(null); setOwnedGrid(null); setFormation(null); setEventPick(null); pickState.current = EMPTY_PICK; cursorSamples.current = []
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
      giftId: name => ocrReferences.current ? sellGiftId(name, ocrReferences.current.gifts) : null, giftPrice: id => giftPriceRef.current?.(id) })
    saleState.current = step.state
    // One sale is one sample group: settled by a sale, uploaded when its dialog could not be read.
    if (step.state.dialog || isSellWindow(text)) sampleRecorder.current?.begin('sale')
    if (step.sold.length) settleSample('sale', 'sale', null)
    else if (!step.state.dialog && sellQuestion(text)) settleSample('sale', 'sale', { reason: 'sale-unresolved' })
    if (step.sold.length) setGiftSales(items => [...items, ...step.sold.map(sale =>
      ({ giftId: sale.giftId, token: `sell:${sale.at}:${sale.giftId}`, capturedAt: sale.at }))].slice(-8))
  }

  // Reports also leave with the page and every 15 minutes of a long capture.
  useEffect(() => {
    const interval = setInterval(flushReport, 15 * 60_000)
    window.addEventListener('pagehide', flushReport)
    return () => { clearInterval(interval); window.removeEventListener('pagehide', flushReport) }
  }, [])
  // The workers found no GPU to load their models on after all: the capture stops rather than read on the CPU.
  const settledOnCpu = status === 'running' ? cpuFallback(ocrEngine, inference) : null
  useEffect(() => {
    if (!settledOnCpu) return
    stop()
    setGpu(settledOnCpu)
  }, [settledOnCpu, stop])
  /** The run's inventory changed; edits by hand (not inside CompanionPanel's automatic records) become report labels. */
  const reportInventoryChange = useCallback((before: readonly string[], after: readonly string[]) => {
    reportTally.current?.inventoryChanged(before, after)
  }, [])

  return { supported, status, error, prediction, visualCandidates, ocrCandidates, ocrStatus,
    popupAcquisitions, floorThemeObservation, observedFloor, scene, themeSelectionFloor, queueStatus, mobile, gpu, inference, ocrEngine,
    ocrWorkers, fusionEvidence, giftSales, skillExchange, shopShelf, ownedGrid, formation, blessings, clearBonus, eventPick, start, stop, reportInventoryChange }
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
