/**
 * Opt-in recognition report, sent with the samples consent: per action (acquisition popup, fusion, sale) how often Assist
 * read it or held back, and the gifts the user added or removed by hand while capturing. A removal of a gift Assist had
 * recorded marks a wrong read; a hand-added gift marks a missed one. A random session id, never an account, ties the
 * reports and samples of one capture together so the edits can label the samples.
 */
import { isUuid } from '@/lib/utils/uuid'

const REPORT_ACTIONS = ['popup', 'fusion', 'sale'] as const
export type ReportAction = typeof REPORT_ACTIONS[number]
const REPORT_MAX_CORRECTIONS = 200

interface AssistCorrection { op: 'add' | 'remove'; giftId: string; auto: boolean; clientAt: number }
/**
 * width/height: the shared capture's size when the report is taken (window captures carry title bars and odd ratios).
 * language: the game client's language chosen for recognition, so each client's read rate can be measured apart.
 */
interface ReportContext { build: string | null; mode: string; ocr: string | null; width?: number | null; height?: number | null; language?: ReportLanguage | null }
const REPORT_LANGUAGES = ['ko', 'en', 'ja'] as const
type ReportLanguage = typeof REPORT_LANGUAGES[number]
interface AssistReport extends ReportContext {
  width: number | null
  height: number | null
  language: ReportLanguage | null
  session: string
  counts: Record<ReportAction, { read: number; held: number }>
  corrections: AssistCorrection[]
}

export const isSessionId = (value: unknown): value is string => isUuid(value)

// Set while CompanionPanel applies a recognized action: inventory changes then come from Assist, not the user's hand.
let automatic = 0
export function recordingAutomatically<T>(run: () => T): T {
  automatic++
  try { return run() } finally { automatic-- }
}

const emptyCounts = () => Object.fromEntries(REPORT_ACTIONS.map(action => [action, { read: 0, held: 0 }])) as AssistReport['counts']

export class AssistReportTally {
  private counts = emptyCounts()
  private corrections: AssistCorrection[] = []
  private autoAdded = new Set<string>()
  constructor(private context: () => ReportContext, readonly session: string = crypto.randomUUID()) {}

  settle(action: ReportAction, read: boolean) {
    this.counts[action][read ? 'read' : 'held']++
  }

  inventoryChanged(before: readonly string[], after: readonly string[], now = Date.now()) {
    const left = [...before]
    const added: string[] = []
    for (const key of after) {
      const index = left.indexOf(key)
      if (index >= 0) left.splice(index, 1)
      else added.push(key)
    }
    if (automatic) { for (const key of added) this.autoAdded.add(key); return }
    for (const key of added) this.correct({ op: 'add', giftId: key, auto: false, clientAt: now })
    for (const key of left) this.correct({ op: 'remove', giftId: key, auto: this.autoAdded.has(key), clientAt: now })
  }

  /** What was gathered since the last call, or null when there is nothing to send. */
  take(): AssistReport | null {
    const empty = !this.corrections.length && REPORT_ACTIONS.every(action => !this.counts[action].read && !this.counts[action].held)
    if (empty) return null
    const context = this.context()
    const report = { session: this.session, ...context, width: context.width ?? null, height: context.height ?? null, language: context.language ?? null, counts: this.counts, corrections: this.corrections }
    this.counts = emptyCounts()
    this.corrections = []
    return report
  }

  private correct(item: AssistCorrection) {
    if (item.giftId.length <= 20 && this.corrections.length < REPORT_MAX_CORRECTIONS) this.corrections.push(item)
  }
}

const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100_000
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
/** A capture side in pixels; absent in reports from before the size was sent. */
const side = (value: unknown): number | null | false => value === undefined || value === null ? null
  : Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 16384 ? value as number : false

/** Rebuilds a report from known fields only; anything malformed rejects it. */
export function parseAssistReport(raw: unknown): AssistReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { session, build, mode, ocr, counts, corrections } = raw as Record<string, unknown>
  const width = side((raw as Record<string, unknown>).width), height = side((raw as Record<string, unknown>).height)
  if (width === false || height === false) return null
  const rawLanguage = (raw as Record<string, unknown>).language
  if (!(rawLanguage === undefined || rawLanguage === null || REPORT_LANGUAGES.includes(rawLanguage as ReportLanguage))) return null
  const language = (rawLanguage ?? null) as ReportLanguage | null
  if (!isSessionId(session) || !(build === null || text(build, 64)) || !text(mode, 20) || !(ocr === null || text(ocr, 20)) ||
    !counts || typeof counts !== 'object' || !Array.isArray(corrections) || corrections.length > REPORT_MAX_CORRECTIONS) return null
  const parsedCounts = emptyCounts()
  for (const action of REPORT_ACTIONS) {
    const item = (counts as Record<string, { read?: unknown; held?: unknown } | undefined>)[action]
    if (!item || !count(item.read) || !count(item.held)) return null
    parsedCounts[action] = { read: item.read, held: item.held }
  }
  const parsedCorrections: AssistCorrection[] = []
  for (const item of corrections as Record<string, unknown>[]) {
    if (!item || (item.op !== 'add' && item.op !== 'remove') || !text(item.giftId, 20) || typeof item.auto !== 'boolean' ||
      !(typeof item.clientAt === 'number' && Number.isFinite(item.clientAt) && item.clientAt >= 0 && item.clientAt <= 8.64e15)) return null
    parsedCorrections.push({ op: item.op, giftId: item.giftId, auto: item.auto, clientAt: item.clientAt })
  }
  return { session, build, mode, ocr, width, height, language, counts: parsedCounts, corrections: parsedCorrections }
}

/** Best effort; survives page unload. */
export function sendAssistReport(report: AssistReport) {
  const body = JSON.stringify(report)
  try {
    if (navigator.sendBeacon?.('/api/assist/reports', new Blob([body], { type: 'application/json' }))) return
    void fetch('/api/assist/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch {}
}
