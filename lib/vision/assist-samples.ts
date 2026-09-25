/**
 * Opt-in recognition samples: when Assist is unsure, the 5 frames before and 5 after are sent (JPEG, 960 px wide) so
 * the recognizer can be retrained on real hard cases. Off unless the user chose it; never tied to an account.
 */
import { DETECTION_KINDS, type DetectionSettings } from './detection-settings'

export const SAMPLES_STORAGE_KEY = 'limbus-assist-samples'
export const SAMPLES_DAILY_KEY = 'limbus-assist-samples-daily'
export const SAMPLE_REASONS = ['popup-unresolved', 'fusion-materials', 'fusion-dialogless', 'sale-unresolved'] as const
export type SampleReason = typeof SAMPLE_REASONS[number]
export const SAMPLE_FRAMES_EACH_SIDE = 5
export const SAMPLE_MAX_FRAME_BYTES = 400 * 1024
export const SAMPLE_MAX_TOTAL_BYTES = 3 * 1024 * 1024
export const SAMPLE_DAILY_LIMIT = 30
// 판정은 팝업이 닫힌 뒤에야 끝나는 일이 많다: 5장 × 300 ms로 직전 약 1.5초를 담는다(100 ms일 때는 0.5초라 팝업이 빠졌다)
const SAMPLE_INTERVAL_MS = 300
const SAMPLE_COOLDOWN_MS = 20_000
const SAMPLE_WIDTH = 960

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
  const { candidates } = meta
  if ((meta.scene !== null && !(scene && text(scene.label, 40) && num(scene.confidence, 0, 1))) ||
    !text(meta.mode, 20) || !detection || !DETECTION_KINDS.every(kind => typeof detection[kind] === 'boolean') ||
    (meta.inference !== null && !inference) || (meta.ocr !== null && !ocr) ||
    !int(meta.width, 1, 16384) || !int(meta.height, 1, 16384) || !num(meta.dpr, 0, 16) || !text(meta.userAgent, 400) ||
    !(meta.build === null || text(meta.build, 64)) || !(meta.floor === null || int(meta.floor, 0, 99)) ||
    !Array.isArray(candidates) || candidates.length > 20 || !candidates.every(id => text(id, 20)) ||
    !num(meta.clientAt, 0, 8.64e15)) return null
  return {
    reason: meta.reason as SampleReason,
    scene: scene ? { label: scene.label as string, confidence: scene.confidence as number } : null,
    mode: meta.mode,
    detection: Object.fromEntries(DETECTION_KINDS.map(kind => [kind, detection[kind]])) as DetectionSettings,
    inference: inference ? { provider: inference.provider as string, adapter: inference.adapter as string } : null,
    ocr: ocr ? { engine: ocr.engine as string, adapter: ocr.adapter as string } : null,
    width: meta.width, height: meta.height, dpr: meta.dpr, userAgent: meta.userAgent,
    build: meta.build as string | null, floor: meta.floor as number | null, candidates: candidates as string[], clientAt: meta.clientAt,
  }
}

export type SampleContext = Omit<SampleMeta, 'reason' | 'width' | 'height' | 'candidates' | 'clientAt'>

/**
 * Browser side: offered every captured frame, keeps the last 5 (one per 100 ms, 960 px wide). A trigger takes those
 * plus the next 5 and posts them as JPEG. Every failure is silent and recognition never waits on it.
 */
export class AssistSampleRecorder {
  private ring: ImageBitmap[] = []
  private pending: { reason: SampleReason; candidates: string[]; frames: ImageBitmap[]; want: number } | null = null
  private lastFrameAt = 0
  private lastSampleAt = -Infinity
  private busy = false
  private closed = false
  private width = 0
  private height = 0
  constructor(private context: () => SampleContext) {}

  offer(frame: VideoFrame) {
    const now = performance.now()
    if (this.busy || this.closed || now - this.lastFrameAt < SAMPLE_INTERVAL_MS || !frame.displayWidth) return
    this.lastFrameAt = now
    this.busy = true
    this.width = frame.displayWidth
    this.height = frame.displayHeight
    const width = Math.min(SAMPLE_WIDTH, frame.displayWidth)
    const copy = frame.clone()
    createImageBitmap(copy, { resizeWidth: width, resizeHeight: Math.max(1, Math.round(frame.displayHeight * width / frame.displayWidth)) })
      .then(bitmap => {
        const pending = this.pending
        if (this.closed) bitmap.close()
        else if (pending) {
          pending.frames.push(bitmap)
          if (pending.frames.length < pending.want) return
          this.pending = null
          void this.send(pending)
        } else {
          this.ring.push(bitmap)
          while (this.ring.length > SAMPLE_FRAMES_EACH_SIDE) this.ring.shift()!.close()
        }
      })
      .catch(() => {})
      .finally(() => { copy.close(); this.busy = false })
  }

  /** At most one sample per 20 s and SAMPLE_DAILY_LIMIT per browser per day. */
  trigger(reason: SampleReason, candidates: readonly string[] = []) {
    const now = performance.now()
    if (this.closed || this.pending || now - this.lastSampleAt < SAMPLE_COOLDOWN_MS || !this.ring.length) return
    try { if (!takeDailySample(window.localStorage, new Date())) return } catch { return }
    this.lastSampleAt = now
    const frames = this.ring.splice(0)
    this.pending = { reason, candidates: candidates.slice(0, 20).map(String), frames, want: frames.length + SAMPLE_FRAMES_EACH_SIDE }
  }

  close() {
    this.closed = true
    for (const bitmap of [...this.ring, ...(this.pending?.frames ?? [])]) bitmap.close()
    this.ring = []
    this.pending = null
  }

  private async send({ reason, candidates, frames }: { reason: SampleReason; candidates: string[]; frames: ImageBitmap[] }) {
    try {
      const meta: SampleMeta = { ...this.context(), reason, candidates, width: this.width, height: this.height, clientAt: Date.now() }
      const body = new FormData()
      body.append('meta', JSON.stringify(meta))
      let total = 0
      for (const [index, bitmap] of frames.entries()) {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        canvas.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
        if (blob.size > SAMPLE_MAX_FRAME_BYTES || total + blob.size > SAMPLE_MAX_TOTAL_BYTES) continue
        total += blob.size
        body.append('frame', blob, `${index}.jpg`)
      }
      if (total) await fetch('/api/assist/samples', { method: 'POST', body })
    } catch { /* Samples are best effort. */ } finally {
      for (const bitmap of frames) bitmap.close()
    }
  }
}
