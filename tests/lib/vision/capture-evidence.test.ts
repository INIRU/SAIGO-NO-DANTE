import { expect, it } from 'vitest'
import { captureEvidence, type OcrCandidates } from '../../../lib/hooks/useAssistCapture'

const now = 10_000
const visual = (events: string[], observedAt = 9_000) =>
  ({ gifts: [], events: events.map(id => ({ id, score: 0.9 })), observedAt, expiresAt: observedAt + 3000, floor: 2 })
const ocr = (overrides: Partial<OcrCandidates> = {}): OcrCandidates => ({ gifts: [], events: [], choices: [], scopedChoices: [],
  outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [], observedAt: 9_500, expiresAt: 15_500, floor: 2, ...overrides })
const base = { status: 'running' as const }

it('shows the image-identified event from its short choices without event body text', () => {
  const result = captureEvidence({ ...base, visualCandidates: visual(['901062']),
    ocrCandidates: ocr({ scopedChoices: [{ id: '1', eventId: '901062', score: 1 }, { id: '2', eventId: '901047', score: 1 }] }) }, 2, now)
  expect(result.eventChoiceEvidence).toEqual({ eventId: 901062, observedAt: 9_500, floor: 2 })
})

it('ignores evidence from another floor, stopped capture, or expired candidates', () => {
  const inputs = { visualCandidates: visual(['901062']), ocrCandidates: ocr({ scopedChoices: [{ id: '1', eventId: '901062', score: 1 }] }) }
  expect(captureEvidence({ ...base, ...inputs }, 3, now).eventChoiceEvidence).toBeNull()
  expect(captureEvidence({ ...base, status: 'idle', ...inputs }, 2, now).eventChoiceEvidence).toBeNull()
  expect(captureEvidence({ ...base, ...inputs }, 2, 30_000).eventChoiceEvidence).toBeNull()
})

it('never opens a summary from a result page', () => {
  const outcome = captureEvidence({ ...base, visualCandidates: visual([]), ocrCandidates: ocr({ outcomeEventIds: ['901062'],
    scopedChoices: [{ id: '1', eventId: '901062', score: 1 }] }) }, 2, now)
  expect(outcome.eventChoiceEvidence).toBeNull()
})

it('previews one text-identified event on its narration page but not on its result page or by art alone', () => {
  const preview = captureEvidence({ ...base, visualCandidates: visual([]), ocrCandidates: ocr({ bodyEventIds: ['901007'] }) }, 2, now)
  expect(preview.eventChoiceEvidence).toEqual({ eventId: 901007, observedAt: 9_500, floor: 2 })
  expect(captureEvidence({ ...base, visualCandidates: visual([]),
    ocrCandidates: ocr({ bodyEventIds: ['901007'], outcomeEventIds: ['901007'] }) }, 2, now).eventChoiceEvidence).toBeNull()
  expect(captureEvidence({ ...base, visualCandidates: visual(['901007', '971033']), ocrCandidates: ocr() }, 2, now).eventChoiceEvidence)
    .toBeNull()
  expect(captureEvidence({ ...base, visualCandidates: visual([]),
    ocrCandidates: ocr({ bodyEventIds: ['901007'], choiceEventIds: ['901062'] }) }, 2, now).eventChoiceEvidence).toBeNull()
})
