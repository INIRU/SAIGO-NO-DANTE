import { expect, it } from 'vitest'
import { parseSampleMeta, readSampleConsent, SAMPLES_STORAGE_KEY, takeDailySample } from '@/lib/vision/assist-samples'
import { checkRateLimit } from '@/lib/rate-limit'

const memory = () => {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) } }
}

it('stays off until chosen', () => {
  expect(readSampleConsent(memory())).toBeNull()
  expect(readSampleConsent({ getItem: key => key === SAMPLES_STORAGE_KEY ? 'on' : null })).toBe(true)
  expect(readSampleConsent({ getItem: () => 'off' })).toBe(false)
  expect(readSampleConsent({ getItem: () => { throw new Error('blocked') } })).toBeNull()
})

it('allows 30 samples per local day and starts over the next day', () => {
  const storage = memory()
  const day = new Date(2026, 8, 25, 23, 0)
  for (let index = 0; index < 30; index++) expect(takeDailySample(storage, day)).toBe(true)
  expect(takeDailySample(storage, day)).toBe(false)
  expect(takeDailySample(storage, new Date(2026, 8, 26, 0, 1))).toBe(true)
  expect(takeDailySample({ getItem: () => null, setItem: () => { throw new Error('full') } }, day)).toBe(false)
})

const valid = { reason: 'popup-unresolved', scene: { label: 'gift_acquired', confidence: 0.4 }, mode: 'balanced',
  detection: { gifts: true, themes: false, events: true }, inference: { provider: 'webgpu', adapter: 'nvidia' }, ocr: null,
  width: 2560, height: 1440, dpr: 1.25, userAgent: 'Chrome', build: null, floor: 3, candidates: ['9001'], clientAt: 1_790_000_000_000 }

it('keeps known metadata fields only and rejects malformed samples', () => {
  expect(parseSampleMeta({ ...valid, email: 'x@y.z', detection: { ...valid.detection, extra: true } })).toEqual(valid)
  expect(parseSampleMeta({ ...valid, scene: null, inference: null, floor: null })).toMatchObject({ scene: null, inference: null, floor: null })
  for (const change of [{ reason: 'other' }, { width: 0 }, { width: 1.5 }, { dpr: Infinity }, { floor: '3' }, { scene: { label: 'x', confidence: 2 } },
    { detection: { gifts: true } }, { candidates: Array(21).fill('1') }, { userAgent: 'x'.repeat(401) }, { ocr: { engine: 'paddle' } }])
    expect(parseSampleMeta({ ...valid, ...change })).toBeNull()
  expect(parseSampleMeta(null)).toBeNull()
  expect(parseSampleMeta([valid])).toBeNull()
})

it('limits sample posts to 30 a day per key', () => {
  for (let index = 0; index < 30; index++) expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(true)
  expect(checkRateLimit('assist-samples:test', 'sample').allowed).toBe(false)
})
