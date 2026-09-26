import { expect, it } from 'vitest'
import { AssistReportTally, parseAssistReport, recordingAutomatically } from '@/lib/vision/assist-report'
import { parseSampleMeta } from '@/lib/vision/assist-samples'

const context = { build: 'abc', mode: 'balanced', ocr: 'paddle' }

it('REQ-ASSIST-039 counts read and held actions and sends each count once', () => {
  const tally = new AssistReportTally(() => context, 'b1946ac9-2c86-4e0e-9f3a-0c8a3d8e6f11')
  expect(tally.take()).toBeNull()
  tally.settle('popup', true); tally.settle('popup', true); tally.settle('popup', false); tally.settle('sale', true)
  const report = tally.take()!
  expect(report).toMatchObject({ session: 'b1946ac9-2c86-4e0e-9f3a-0c8a3d8e6f11', ...context,
    counts: { popup: { read: 2, held: 1 }, fusion: { read: 0, held: 0 }, sale: { read: 1, held: 0 } }, corrections: [] })
  expect(parseAssistReport(JSON.parse(JSON.stringify(report)))).toEqual(report)
  expect(tally.take()).toBeNull()
})

it('REQ-ASSIST-040 records hand edits as labels and marks removals of what Assist recorded', () => {
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

it('REQ-ASSIST-039 rejects malformed reports and links samples to their session', () => {
  const tally = new AssistReportTally(() => context)
  tally.settle('fusion', false)
  const report = tally.take()!
  for (const change of [{ session: 'x' }, { counts: { ...report.counts, popup: { read: -1, held: 0 } } }, { counts: { popup: report.counts.popup } },
    { corrections: [{ op: 'swap', giftId: '1', auto: false, clientAt: 1 }] }, { corrections: Array(201).fill({ op: 'add', giftId: '1', auto: false, clientAt: 1 }) },
    { mode: 'x'.repeat(21) }]) expect(parseAssistReport({ ...report, ...change })).toBeNull()
  expect(parseAssistReport({ ...report, email: 'x@y.z' })).toEqual(report)
  const meta = { reason: 'sale-unresolved', scene: null, mode: 'balanced', detection: { gifts: true, themes: true, events: true }, inference: null,
    ocr: null, width: 1920, height: 1080, dpr: 1, userAgent: 'Chrome', build: null, floor: 1, candidates: [], clientAt: 1 }
  expect(parseSampleMeta({ ...meta, session: report.session })?.session).toBe(report.session)
  expect(parseSampleMeta({ ...meta, session: 'not-a-uuid' })).toBeNull()
})
