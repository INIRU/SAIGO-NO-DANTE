import { expect, it } from 'vitest'
import { AssistReportTally, parseAssistReport, recordingAutomatically } from '@/features/assist/lib/assist-report'
import { parseSampleMeta } from '@/features/assist/lib/assist-samples'

const context = { build: 'abc', mode: 'balanced', ocr: 'paddle' }

it('counts read and held actions and sends each count once', () => {
  const tally = new AssistReportTally(() => context, 'b1946ac9-2c86-4e0e-9f3a-0c8a3d8e6f11')
  expect(tally.take()).toBeNull()
  tally.settle('popup', true); tally.settle('popup', true); tally.settle('popup', false); tally.settle('sale', true)
  const report = tally.take()!
  expect(report).toMatchObject({ session: 'b1946ac9-2c86-4e0e-9f3a-0c8a3d8e6f11', ...context,
    counts: { popup: { read: 2, held: 1 }, fusion: { read: 0, held: 0 }, sale: { read: 1, held: 0 } }, corrections: [] })
  expect(parseAssistReport(JSON.parse(JSON.stringify(report)))).toEqual(report)
  expect(tally.take()).toBeNull()
})

it('records hand edits as labels and marks removals of what Assist recorded', () => {
  const tally = new AssistReportTally(() => context)
  recordingAutomatically(() => tally.inventoryChanged([], ['9001', '9002'], 10))
  tally.inventoryChanged(['9001', '9002'], ['9001'], 20)            // undo of an automatic read: a wrong read
  tally.inventoryChanged(['9001'], ['9001', '9003'], 30)            // a missed acquisition added by hand
  tally.inventoryChanged(['9001', '9003'], ['9001'], 40)            // the user's own pick taken back
  recordingAutomatically(() => tally.inventoryChanged(['9001'], [], 50)) // sold: not a correction
  expect(tally.take()!.corrections).toEqual([
    { op: 'remove', giftId: '9002', auto: true, clientAt: 20 },
    { op: 'add', giftId: '9003', auto: false, clientAt: 30 },
    { op: 'remove', giftId: '9003', auto: false, clientAt: 40 },
  ])
})

it('rejects malformed reports and links samples to their session', () => {
  const tally = new AssistReportTally(() => context)
  tally.settle('fusion', false)
  const report = tally.take()!
  for (const change of [{ session: 'x' }, { counts: { ...report.counts, popup: { read: -1, held: 0 } } }, { counts: { popup: report.counts.popup } },
    { corrections: [{ op: 'swap', giftId: '1', auto: false, clientAt: 1 }] }, { corrections: Array(201).fill({ op: 'add', giftId: '1', auto: false, clientAt: 1 }) },
    { mode: 'x'.repeat(21) }]) expect(parseAssistReport({ ...report, ...change })).toBeNull()
  expect(parseAssistReport({ ...report, email: 'x@y.z' })).toEqual(report)
  // The game language separates English and Japanese clients' read rates; anything else rejects the report.
  const english = new AssistReportTally(() => ({ ...context, language: 'en' as const }))
  english.settle('popup', true)
  expect(parseAssistReport(JSON.parse(JSON.stringify(english.take())))?.language).toBe('en')
  expect(parseAssistReport({ ...report, language: 'fr' })).toBeNull()
  expect(report.language).toBeNull()
  const meta = { reason: 'sale-unresolved', scene: null, mode: 'balanced', detection: { gifts: true, themes: true, events: true }, inference: null,
    ocr: null, width: 1920, height: 1080, dpr: 1, userAgent: 'Chrome', build: null, floor: 1, candidates: [], clientAt: 1 }
  expect(parseSampleMeta({ ...meta, session: report.session })?.session).toBe(report.session)
  expect(parseSampleMeta({ ...meta, session: 'not-a-uuid' })).toBeNull()
})

it('reports the capture size so windowed and full-screen captures can be told apart', () => {
  const tally = new AssistReportTally(() => ({ ...context, width: 1602, height: 932 }))
  tally.settle('fusion', true)
  const report = tally.take()!
  expect(report).toMatchObject({ width: 1602, height: 932 })
  expect(parseAssistReport(JSON.parse(JSON.stringify(report)))).toMatchObject({ width: 1602, height: 932 })
  // Reports from builds before the size was added, or with the size unknown, are still accepted without it.
  const { width: _width, height: _height, ...older } = report
  expect(parseAssistReport(older)).toMatchObject({ width: null, height: null })
  for (const size of [{ width: 0, height: 932 }, { width: 1602.5, height: 932 }, { width: 1602, height: '932' }, { width: 20000, height: 932 }])
    expect(parseAssistReport({ ...report, ...size })).toBeNull()
})
