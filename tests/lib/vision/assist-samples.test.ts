import { expect, it, vi } from 'vitest'
import { AssistSampleRecorder, parseSampleMeta, readSampleConsent, SAMPLE_DAILY_LIMIT, SAMPLES_STORAGE_KEY, screenChanged, takeDailySample } from '@/lib/vision/assist-samples'
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

it('allows a limited number of samples per local day and starts over the next day', () => {
  const storage = memory()
  const day = new Date(2026, 8, 25, 23, 0)
  for (let index = 0; index < SAMPLE_DAILY_LIMIT; index++) expect(takeDailySample(storage, day)).toBe(true)
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

function recorderHarness() {
  let clock = 0
  let shade = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 400))
  vi.stubGlobal('window', { localStorage: memory() })
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1280, height: 720, close() {} }))
  vi.stubGlobal('OffscreenCanvas', class {
    getContext(kind: string) {
      return kind === '2d' ? { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(64 * 36 * 4).fill(shade) }) } : { transferFromImageBitmap() {} }
    }
    async convertToBlob() { return new Blob(['frame' + shade], { type: 'image/jpeg' }) }
  })
  const uploads: { reason: string; frames: string[] }[] = []
  const recorder = new AssistSampleRecorder(() => ({ scene: null, mode: 'quality', detection: { gifts: true, themes: true, events: true },
    inference: null, ocr: null, dpr: 1, userAgent: 't', build: null, floor: 1 }), async (meta, frames) => {
    uploads.push({ reason: meta.reason, frames: await Promise.all(frames.map(frame => frame.text())) })
  })
  const frame = { displayWidth: 1920, displayHeight: 1080, clone: () => ({ displayWidth: 1920, displayHeight: 1080, close() {} }) } as unknown as VideoFrame
  const offer = async (next: number) => {
    shade = next
    recorder.offer(frame)
    for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return { recorder, uploads, offer }
}

it('tells a changed screen from a still one', () => {
  const still = new Uint8Array(64 * 36).fill(80)
  const cursor = still.slice(); cursor[5] = 200
  const popup = still.slice(); popup.fill(200, 0, 40)
  expect(screenChanged(null, still)).toBe(true)
  expect(screenChanged(still, still.slice())).toBe(false)
  expect(screenChanged(still, cursor)).toBe(false)
  expect(screenChanged(still, popup)).toBe(true)
})

it('discards the frame group of an action that was read', async () => {
  const { recorder, uploads, offer } = recorderHarness()
  recorder.begin('popup:1')
  await offer(40); await offer(80)
  recorder.end('popup:1', null)
  for (const shade of [120, 160, 200, 240]) await offer(shade)
  expect(uploads).toEqual([])
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})

it('uploads the whole group of a failed action with the frames just before and after it', async () => {
  const { recorder, uploads, offer } = recorderHarness()
  await offer(40)
  recorder.begin('fusion')
  await offer(80); await offer(80); await offer(120)
  recorder.end('fusion', { reason: 'fusion-materials', candidates: ['9108'] })
  await offer(160); await offer(200)
  expect(uploads).toEqual([])
  await offer(240)
  expect(uploads).toEqual([{ reason: 'fusion-materials', frames: ['frame40', 'frame80', 'frame120', 'frame160', 'frame200', 'frame240'] }])
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})
