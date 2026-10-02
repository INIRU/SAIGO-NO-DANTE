/**
 * Opt-in recognition samples. Assist keeps the frames of each action it reads (one fusion, one acquisition popup, one
 * sale) as a group in this browser: only frames where the screen changed, JPEG, 1280 px wide. A group read in full is
 * discarded; a group whose read failed is uploaded whole, with a few frames after it, so the recognizer can be retrained
 * on real hard cases. Off unless the user chose it; never tied to an account.
 */
import { DETECTION_KINDS, type DetectionSettings } from './detection-settings'
import { isSessionId } from './assist-report'

// v3: the frames train the recognizer and are no longer deleted after 180 days; everyone who opted in before is asked again.
export const SAMPLES_STORAGE_KEY = 'limbus-assist-samples-v3'
/** The consent text a sample was sent under, in its metadata. Samples without it were promised deletion after 180 days. */
export const SAMPLE_CONSENT = 3
export const SAMPLE_KEEP_MS = 180 * 86_400_000
export const SAMPLES_DAILY_KEY = 'limbus-assist-samples-daily'
export const SAMPLE_REASONS = ['popup-unresolved', 'fusion-materials', 'fusion-dialogless', 'sale-unresolved'] as const
export type SampleReason = typeof SAMPLE_REASONS[number]
/** Frames kept per group (latest first) plus the frames after it. */
export const SAMPLE_GROUP_FRAMES = 45
export const SAMPLE_AFTER_FRAMES = 3
export const SAMPLE_MAX_FRAMES = SAMPLE_GROUP_FRAMES + SAMPLE_AFTER_FRAMES
export const SAMPLE_MAX_FRAME_BYTES = 400 * 1024
export const SAMPLE_BUCKET = 'assist-samples'
export const SAMPLE_DAILY_LIMIT = 15
// 300 ms마다 한 장을 보고, 화면이 바뀐 장면만 담는다
const SAMPLE_INTERVAL_MS = 300
const SAMPLE_COOLDOWN_MS = 20_000
// 이름판 글자를 학습에 쓸 만한 폭(960 px는 작은 글자가 뭉개졌다). JPEG 한 장 약 135 KB.
const SAMPLE_WIDTH = 1280
// 동작이 시작되기 직전 장면(팝업이 뜬 순간 등)으로 그룹 앞에 붙는 장수
const PREROLL_FRAMES = 3
// 이만큼 다시 보지 못한 그룹은 끝난 것으로 보고 버린다(합성하지 않고 나감, 판매 취소)
const GROUP_IDLE_MS = 20_000
// 변화 판정용 축소 화면: 64×36 회색조에서 16 이상 달라진 칸이 2개 이상이면 바뀐 장면이다
const THUMB_WIDTH = 64
const THUMB_HEIGHT = 36
const CHANGED_LEVEL = 16
const CHANGED_CELLS = 2

/** true/false once chosen in this browser, null while never asked. */
export function readSampleConsent(storage: Pick<Storage, 'getItem'> | null | undefined): boolean | null {
  try {
    const value = storage?.getItem(SAMPLES_STORAGE_KEY)
    return value === 'on' ? true : value === 'off' ? false : null
  } catch { return null }
}

/** Takes one of today's (local date) slots; false once the daily limit is reached or storage fails. */
export function takeDailySample(storage: Pick<Storage, 'getItem' | 'setItem'>, now: Date, limit = SAMPLE_DAILY_LIMIT): boolean {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  try {
    const stored = JSON.parse(storage.getItem(SAMPLES_DAILY_KEY) ?? 'null') as { day?: unknown; count?: unknown } | null
    const count = stored?.day === day && typeof stored.count === 'number' ? stored.count : 0
    if (count >= limit) return false
    storage.setItem(SAMPLES_DAILY_KEY, JSON.stringify({ day, count: count + 1 }))
    return true
  } catch { return false }
}

export interface SampleMeta {
  reason: SampleReason
  scene: { label: string; confidence: number } | null
  mode: string
  detection: DetectionSettings
  inference: { provider: string; adapter: string } | null
  ocr: { engine: string; adapter: string } | null
  width: number
  height: number
  dpr: number
  userAgent: string
  build: string | null
  floor: number | null
  candidates: string[]
  clientAt: number
  /** The capture's report session (lib/vision/assist-report.ts), linking the sample to hand corrections. */
  session?: string
  /** Game client language the capture read (Assist setting); absent on samples before 2026-09-29. */
  language?: 'ko' | 'en' | 'ja'
  /** SAMPLE_CONSENT when it was sent; absent on samples sent under the 180-day text. */
  consent?: number
}

/** When a stored sample must be deleted (server and downloaded copies): 180 days after it was received, unless it was sent under the training consent. */
export function sampleExpiresAt(row: { created_at: string; meta: { consent?: unknown } | null }): number | null {
  const consent = row.meta?.consent
  return typeof consent === 'number' && consent >= SAMPLE_CONSENT ? null : Date.parse(row.created_at) + SAMPLE_KEEP_MS
}

const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
const num = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const int = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && num(value, min, max)
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const pair = (value: unknown, first: string, second: string) => {
  const item = record(value)
  return item && text(item[first], 20) && text(item[second], 80) ? item : null
}

/** Rebuilds client metadata from known fields only; anything malformed rejects the whole sample. */
export function parseSampleMeta(raw: unknown): SampleMeta | null {
  const meta = record(raw)
  if (!meta || !SAMPLE_REASONS.includes(meta.reason as SampleReason)) return null
  const scene = record(meta.scene)
  const detection = record(meta.detection)
  const inference = pair(meta.inference, 'provider', 'adapter')
  const ocr = pair(meta.ocr, 'engine', 'adapter')
  const { candidates, session, language, consent } = meta
  if ((meta.scene !== null && !(scene && text(scene.label, 40) && num(scene.confidence, 0, 1))) ||
    !text(meta.mode, 20) || !detection || !DETECTION_KINDS.every(kind => typeof detection[kind] === 'boolean') ||
    (meta.inference !== null && !inference) || (meta.ocr !== null && !ocr) ||
    !int(meta.width, 1, 16384) || !int(meta.height, 1, 16384) || !num(meta.dpr, 0, 16) || !text(meta.userAgent, 400) ||
    !(meta.build === null || text(meta.build, 64)) || !(meta.floor === null || int(meta.floor, 0, 99)) ||
    !Array.isArray(candidates) || candidates.length > 20 || !candidates.every(id => text(id, 20)) ||
    !num(meta.clientAt, 0, 8.64e15) || !(session === undefined || session === null || isSessionId(session)) ||
    !(language === undefined || language === 'ko' || language === 'en' || language === 'ja') ||
    !(consent === undefined || int(consent, 1, 99))) return null
  return {
    reason: meta.reason as SampleReason,
    scene: scene ? { label: scene.label as string, confidence: scene.confidence as number } : null,
    mode: meta.mode,
    detection: Object.fromEntries(DETECTION_KINDS.map(kind => [kind, detection[kind]])) as DetectionSettings,
    inference: inference ? { provider: inference.provider as string, adapter: inference.adapter as string } : null,
    ocr: ocr ? { engine: ocr.engine as string, adapter: ocr.adapter as string } : null,
    width: meta.width, height: meta.height, dpr: meta.dpr, userAgent: meta.userAgent,
    build: meta.build as string | null, floor: meta.floor as number | null, candidates: candidates as string[], clientAt: meta.clientAt,
    ...(isSessionId(session) ? { session } : {}),
    ...(language ? { language } : {}),
    ...(consent === undefined ? {} : { consent }),
  }
}

export type SampleContext = Omit<SampleMeta, 'reason' | 'width' | 'height' | 'candidates' | 'clientAt' | 'consent'>

/** Grayscale thumbnail used only to tell whether the screen changed. */
export function frameThumb(pixels: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(pixels.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = (pixels[i * 4] * 77 + pixels[i * 4 + 1] * 150 + pixels[i * 4 + 2] * 29) >> 8
  return out
}

export function screenChanged(previous: Uint8Array | null, next: Uint8Array): boolean {
  if (!previous || previous.length !== next.length) return true
  let cells = 0
  for (let i = 0; i < next.length; i++) if (Math.abs(next[i] - previous[i]) >= CHANGED_LEVEL && ++cells >= CHANGED_CELLS) return true
  return false
}

type Group = { frames: Blob[]; touchedAt: number }
type Outgoing = { reason: SampleReason; candidates: string[]; frames: Blob[]; after: number }

/**
 * Browser side: offered every captured frame (one per 300 ms is looked at). Changed frames are encoded once and shared by
 * every open group. A group is opened (or kept alive) by begin(key) and settled by end(key, failure). Every failure is
 * silent and recognition never waits on it.
 */
export class AssistSampleRecorder {
  private preroll: Blob[] = []
  private groups = new Map<string, Group>()
  private outgoing: Outgoing[] = []
  private lastThumb: Uint8Array | null = null
  private thumbCanvas: OffscreenCanvas | null = null
  private lastFrameAt = 0
  private lastSampleAt = -Infinity
  private busy = false
  private closed = false
  private width = 0
  private height = 0
  constructor(private context: () => SampleContext, private upload: (meta: SampleMeta, frames: Blob[]) => Promise<void> = uploadSample) {}

  offer(frame: VideoFrame) {
    const now = performance.now()
    if (this.busy || this.closed || now - this.lastFrameAt < SAMPLE_INTERVAL_MS || !frame.displayWidth) return
    this.lastFrameAt = now
    this.busy = true
    this.width = frame.displayWidth
    this.height = frame.displayHeight
    const copy = frame.clone()
    void this.look(copy, now).catch(() => {}).finally(() => { copy.close(); this.busy = false })
  }

  /** Opens the group of an action, or keeps it open. It starts with the frames just before. */
  begin(key: string) {
    if (this.closed) return
    const group = this.groups.get(key)
    if (group) group.touchedAt = performance.now()
    else this.groups.set(key, { frames: [...this.preroll], touchedAt: performance.now() })
  }

  /**
   * The action was read. Read in full (null): its group is discarded. Otherwise the group (or, if none was open, the
   * frames just before) is uploaded with the next few changed frames.
   */
  end(key: string, failure: { reason: SampleReason; candidates?: readonly string[] } | null) {
    const group = this.groups.get(key)
    this.groups.delete(key)
    if (!failure || this.closed) return
    const frames = group?.frames ?? [...this.preroll]
    if (!frames.length || !this.allow()) return
    this.outgoing.push({ reason: failure.reason, candidates: (failure.candidates ?? []).slice(0, 20).map(String), frames, after: SAMPLE_AFTER_FRAMES })
  }

  close() {
    this.closed = true
    this.groups.clear()
    this.outgoing = []
    this.preroll = []
  }

  /** At most one sample per 20 s and SAMPLE_DAILY_LIMIT per browser per day; takes the slot when allowed. */
  private allow(): boolean {
    const now = performance.now()
    if (now - this.lastSampleAt < SAMPLE_COOLDOWN_MS) return false
    try { if (!takeDailySample(window.localStorage, new Date())) return false } catch { return false }
    this.lastSampleAt = now
    return true
  }

  private async look(frame: VideoFrame, now: number) {
    for (const [key, group] of this.groups) if (now - group.touchedAt > GROUP_IDLE_MS) this.groups.delete(key)
    // Nothing would keep the frame: skip the work (the preroll still needs the latest changes).
    const canvas = this.thumbCanvas ??= new OffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(frame, 0, 0, THUMB_WIDTH, THUMB_HEIGHT)
    const thumb = frameThumb(context.getImageData(0, 0, THUMB_WIDTH, THUMB_HEIGHT).data)
    const changed = screenChanged(this.lastThumb, thumb)
    let blob: Blob | null = null
    if (changed) {
      this.lastThumb = thumb
      const width = Math.min(SAMPLE_WIDTH, frame.displayWidth)
      const height = Math.max(1, Math.round(frame.displayHeight * width / frame.displayWidth))
      const bitmap = await createImageBitmap(frame, { resizeWidth: width, resizeHeight: height })
      const jpeg = new OffscreenCanvas(width, height)
      jpeg.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap)
      blob = await jpeg.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      if (this.closed) return
      if (blob.size > SAMPLE_MAX_FRAME_BYTES) blob = null
    }
    if (blob) {
      this.preroll = [...this.preroll, blob].slice(-PREROLL_FRAMES)
      for (const group of this.groups.values()) {
        group.frames.push(blob)
        if (group.frames.length > SAMPLE_GROUP_FRAMES) group.frames.shift()
      }
    }
    // Uploads wait for the next few frames (changed ones are added), so the result on screen is included.
    for (const item of this.outgoing.splice(0)) {
      if (blob) item.frames.push(blob)
      if (--item.after > 0) { this.outgoing.push(item); continue }
      const meta: SampleMeta = { ...this.context(), consent: SAMPLE_CONSENT, reason: item.reason, candidates: item.candidates, width: this.width, height: this.height, clientAt: Date.now() }
      void this.upload(meta, item.frames).catch(() => {})
    }
  }
}

/** Asks the server for one signed upload per frame, then sends the frames straight to storage. */
async function uploadSample(meta: SampleMeta, frames: Blob[]) {
  const response = await fetch('/api/assist/samples', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ meta, sizes: frames.map(frame => frame.size) }) })
  if (!response.ok) return
  const { uploads } = await response.json() as { uploads: { path: string; token: string }[] }
  const { createClient } = await import('@/lib/supabase/client')
  const bucket = createClient().storage.from(SAMPLE_BUCKET)
  await Promise.all(uploads.slice(0, frames.length).map((upload, index) =>
    bucket.uploadToSignedUrl(upload.path, upload.token, frames[index], { contentType: 'image/jpeg' })))
}
